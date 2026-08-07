# Database

Source of truth: `supabase/sql/schema.sql` (run once on a fresh project;
every migration in `supabase/migrations/` is inlined into it too, so it
never goes stale). This doc is a navigable summary of that file.

## RLS helper functions

Every policy gates on one of these five `SECURITY DEFINER` functions
(reading the caller's own `profiles` row, bypassing RLS recursion):

| Function | Returns | Notes |
|---|---|---|
| `current_role()` | caller's `role` | Excludes disabled profiles |
| `current_hall_id()` | caller's `hall_id` | Excludes disabled profiles |
| `current_buyer_id()` | caller's `buyer_id` | Excludes disabled profiles |
| `is_super_admin()` | boolean | True only for a non-disabled `super_admin` |
| `is_merchant_buyer(buyer_id)` | boolean | True if caller (via legacy `profiles.buyer_id` or the `merchant_buyers` join table) is tied to that buyer |
| `has_custom_permission(key)` | boolean | True if caller is a non-disabled `custom` role with `custom_permissions->>key` truthy |

**Disabled-user fail-closed pattern**: `current_role()`/`current_hall_id()`/
`current_buyer_id()`/`is_super_admin()` all filter `is_disabled is not
true` internally. Disabling a profile (`profiles.is_disabled = true`)
therefore locks that caller out of *every* policy that depends on these
helpers — nearly all of them — in one place, rather than needing `and not
is_disabled` bolted onto dozens of individual policies.

**NULL-comparison gotcha**: any authorization check comparing a nullable
column against one of these helpers must use `is distinct from`, not
`<>` — `v_hall_id <> current_hall_id()` silently evaluates to `false`
(no-op) when `current_hall_id()` is `NULL` (e.g. for a merchant), because
PL/pgSQL treats a NULL `IF` condition as false rather than raising. Every
RPC in this schema uses `is distinct from` for this reason.

## Tables

### `buyers`
`id` uuid PK · `name` text · `created_at`. Companies whose samples/panels
are signed in. RLS: `buyers_select` — admin, hall_manager (any), merchant
owning the buyer, or custom with `view_all_buyers`. Write: admin only.

### `halls`
`id` uuid PK · `hall_number` int unique · `name` text · `created_at`.
Seeded once. RLS: select — any authenticated user (hall names aren't
sensitive, needed app-wide for dropdowns). Write: admin only.

### `profiles`
`id` uuid PK (= `auth.users.id`) · `full_name` · `email` · `role` text
(check: `super_admin | hall_manager | merchant | custom`) · `hall_id` →
halls · `buyer_id` → buyers · `is_disabled` bool default false ·
`custom_permissions` jsonb default `{}` · `created_at`. One row per login.
`hall_id` only set for hall managers; `buyer_id` only meaningfully set for
merchants (and only via the Edit Buyer form's merchant-contacts
multi-select, never at creation). RLS: select own row or admin; write:
admin only (actual create/edit goes through the `create-user`/
`manage-user` edge functions using the service-role key, bypassing RLS
entirely).

### `samples`
`id` · `buyer_id` → buyers · `hall_id` → halls · `bt_code` text unique ·
`product_ref` · `product_name` · `image_url` · `status` (`in_hall |
checked_out`) · `created_at` · `buyer_code` · `collection_name` ·
`signed_by` · `signed_date` date · `validity_months` int · `expiry_date`
date · `date_added_to_hall` date. RLS: select — admin, own-hall manager,
owning merchant, or custom with `manage_samples`/`view_all_buyers`.
Insert — admin or own-hall manager. Update — admin only (all status
transitions go through RPCs instead, see below).

### `movements`
`id` · `sample_id` → samples · `picked_by_name`/`picked_by_email` ·
`destination` · `reason`/`reason_other` · `status` (`out | returned`) ·
`picked_at`/`returned_at` · `notes` · `logged_by` → profiles ·
`from_hall_id`/`destination_hall_id` → halls · `purchaser_name` ·
`supplier_name` · `photo_url` · `signature_url` · `hop_number` int
default 1. One row per checkout leg; a forward closes the current row and
opens a new one with `hop_number + 1`. RLS: select scoped via the parent
sample's hall/buyer, or custom with `view_movements`. **No insert/update
policy at all** — every write goes through `checkout_sample`/
`return_sample`/`forward_sample`.

### `merchant_contacts`
`id` · `buyer_id` → buyers · `profile_id` → profiles. Legacy buyer↔merchant
join table (email routing). Admin-only both directions.

### `merchant_buyers`
`id` · `profile_id` → profiles · `buyer_id` → buyers, unique pair. Newer,
more general multi-buyer-per-merchant mapping — `is_merchant_buyer()`
checks both this table and the legacy `profiles.buyer_id` pointer.
Admin-only (`"Admin full access"` policy).

### `recall_requests`
`id` · `sample_id` → samples · `requested_by` → profiles · `reason` ·
`status` (`pending | acknowledged | resolved`) · `created_at`. Merchant
raises, hall manager or admin actions it. Insert restricted to the
merchant owning the sample's buyer.

### `sample_comments`
`id` · `sample_id` → samples · `author_id` → profiles · `comment` ·
`created_at`. Visible to admin/hall manager of that sample too, not just
the commenting merchant.

### `feedback`
`id` · `sender_id` → profiles · `subject` · `message` · `is_read` bool ·
`created_at`. One-way user→admin mailbox. Insert: own row only. Select/
update: admin only.

### `panels`
`id` · `buyer_id` → buyers · `hall_id` → halls · `panel_code` text unique
not null · `panel_name` not null · `panel_ref` · `panel_finish` ·
`finish_recipe` · `collection_name` · `image_url` · `status` (`in_hall |
issued | retired`) · `is_shared` bool default false · `signed_by` ·
`signed_date` · `validity_months` · `expiry_date` · `date_added_to_hall` ·
`created_at` · `retired_reason` · `retired_at` · `retired_by` → profiles.
`is_shared` panels are visible to every merchant, not scoped to one
buyer. RLS: select — admin, own-hall manager, merchant (shared or
owning), or custom with `manage_panels`/`view_all_buyers`. Insert — admin
or own-hall manager. Update — admin only.

### `panel_movements`
Mirrors `movements` exactly, with `panel_id` instead of `sample_id`, plus
a `quantity` int column (nullable — how many units moved in that leg, not
every movement tracks it). RLS mirrors `movements` (scoped via parent
panel, or `view_movements` custom permission); no direct insert/update
policy.

### `shift_requests`
`id` · `item_type` (`sample | panel`) · `item_id` uuid (no FK — points at
either module's table) · `from_hall_id`/`to_hall_id` → halls ·
`requested_by` → profiles · `status` (`pending | approved | rejected`) ·
`admin_note` · `approved_by` → profiles · `approved_at` · `note` text ·
`created_at`. A manager or merchant requests moving an in-hall item's home
hall; admin approves/rejects via `review_shift_request`. Insert requires
the item currently be `in_hall` with a matching `from_hall_id`, and the
requester be admin/that hall's manager/the owning merchant.

### `validity_requests`
`id` · `item_type` (`sample | panel`) · `item_id` uuid · `requested_by` →
profiles · `requested_months` int · `requested_expiry_date` date ·
`reason` · `status` (`pending | approved | rejected`) · `approved_by` →
profiles · `approved_at` · `admin_note` · `created_at`. Merchant raises an
extension request; admin **or the item's own hall manager** can approve
(see `review_validity_request` below). Insert restricted to the merchant
owning the item's buyer (or a shared panel).

### `validity_changes`
`id` · `item_type` · `item_id` · `changed_by` → profiles ·
`old_expiry_date` · `new_expiry_date` · `reason` · `created_at`. Append-only
audit trail for every expiry-date change, whichever of
`admin_update_validity` or an approved `validity_requests` row caused it.
Select: admin only. No write policy — only the two RPCs insert here.

### `notifications`
`id` · `recipient_id` → profiles · `title` · `message` · `type` text ·
`item_type` · `item_id` uuid · `is_read` bool default false ·
`created_at`. In-app bell rows. Select/update: recipient or admin. No
insert policy — only written by the `send-notification` edge function
(service role) and `send_validity_alerts()` (SECURITY DEFINER).

### `push_subscriptions`
`id` · `profile_id` → profiles · `endpoint` text unique · `p256dh` ·
`auth` · `created_at`. One row per browser/device Web Push subscription.
All four policies (select/insert/update/delete) scoped to
`profile_id = auth.uid()`.

### `audit_log`
`id` · `actor_id` → profiles, **defaults to `auth.uid()` server-side** ·
`action` text · `details` jsonb · `created_at`. General admin-action
trail, viewed on the Settings → Audit Log page. Insert: any authenticated
user for their own `actor_id` (the default means the client never has to
look up its own id, see `core/lib/auditLog.js`'s `logAuditEvent()`).
Select: admin only. No update/delete — it's an audit trail.

### `app_settings`
Singleton (`id boolean primary key default true`, `check (id)`). `sender_name`
default `'BASANT'` · `sender_email` default `'noreply@basant.info'` ·
`deploy_hook_url` · `logo_url` · `notification_prefs` jsonb default `{}` ·
`updated_at`. **Never stores real API keys** (Resend/WhatsApp) — those
stay as Edge Function secrets; this table only holds non-secret config
plus what the Settings page needs to show a configured/not-configured
badge. Select: any authenticated user. Update: admin only.

### `storage.objects` (`sample-images` bucket)
Reused for sample photos, panel photos (`panels/` prefix), and movement/
panel-movement photo+signature captures — bucket-scoped RLS, not
path-scoped. Upload/update: admin, hall_manager, or merchant. Delete:
admin or hall_manager only.

## RPCs (all `SECURITY DEFINER`)

| Function | Purpose |
|---|---|
| `checkout_sample(...)` | Issues a sample (`in_hall`→`checked_out`) + opens a `movements` row, in one transaction |
| `return_sample(movement_id)` | Closes the open movement, sets the sample back to `in_hall` |
| `forward_sample(...)` | Closes the current leg, opens a new one to a new destination (`hop_number + 1`), updates the sample's current hall |
| `clear_movement_history()` | Admin-only: wipes all `movements`, resets checked-out samples to `in_hall` — used by Settings' "Clear Test Data" |
| `set_sample_image(sample_id, url)` | Admin or the owning merchant sets a sample's image |
| `delete_sample(sample_id)` | Admin-only hard delete, blocked while checked out; cascades recalls/comments/movements |
| `delete_buyer(buyer_id)` | Admin-only hard delete of a buyer + history, blocked if any sample is currently issued |
| `checkout_panel(...)` / `return_panel(...)` / `forward_panel(...)` | Panel mirrors of the sample RPCs, plus an optional trailing `p_quantity` param |
| `retire_panel(panel_id, reason)` | Admin-only; flips `status` to `retired`, blocked if issued or already retired |
| `set_panel_image(panel_id, url)` | Admin or owning/shared merchant sets a panel's image |
| `admin_update_validity(item_type, item_id, new_expiry_date, reason)` | Admin-only direct expiry edit (also how a pre-expire happens — same call with a past date; the logged `validity_changes.reason` gets a `"Pre-expired: "` prefix automatically when `new_expiry_date < current_date`) |
| `review_validity_request(request_id, approve, admin_note)` | Admin **or** the item's own hall manager approves/rejects a pending request; a manager approval logs `"Extended by <name> (Manager) — <reason>"` vs admin's `"Approved request: ..."` |
| `review_shift_request(request_id, approve, admin_note)` | Admin-only; branches on `item_type` (sample vs panel), updates the item's home hall, and inserts a closed `"Hall Shift"` movement row as the audit trail |
| `send_validity_alerts()` | pg_cron target — scans samples **and** panels expiring in exactly 30 or 15 days, inserts `notifications` rows, and calls the `send-notification` edge function (`validity_alert`) via `net.http_post` |
| `admin_list_users_last_login()` | Admin-only, read-only window into `auth.users.last_sign_in_at` (the one field the Team page's Users table needs — `auth.users` isn't otherwise exposed to the client) |

## pg_cron

`validity-alerts-daily` — `'0 9 * * *'` (09:00 UTC daily) →
`select public.send_validity_alerts();`. Requires the `pg_cron`/`pg_net`
extensions and a manually-set `app.settings.supabase_anon_key` DB
parameter (deliberately not hardcoded in the SQL file — set it once via
`alter database postgres set app.settings.supabase_anon_key = '<anon
key>';`). If never set, the job still writes the in-app `notifications`
rows but silently skips the email/push call.

## Why RPCs instead of direct table writes

Every sample/panel status transition goes through a `SECURITY DEFINER`
RPC rather than a direct `.update()`, so the status change and its
movement-row audit trail can never drift out of sync, and hall-scoping is
enforced server-side in one place instead of needing a separate RLS
`UPDATE` policy per role.
