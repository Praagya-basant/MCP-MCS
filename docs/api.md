# Edge Functions & Notification Service

Three Supabase Edge Functions (`supabase/functions/`), all Deno. None take
extra secrets beyond what Supabase injects automatically
(`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`) except
`send-notification`, which also needs `RESEND_API_KEY` and the VAPID key
pair.

## `create-user`

Admin-only user creation — needs the Auth admin API (service-role key),
which must never reach the browser.

**Request body**
```json
{ "full_name": "...", "email": "...", "password": "...", "role": "super_admin|hall_manager|merchant|custom", "hall_id": "uuid|null", "custom_permissions": {} }
```

**Behavior**: verifies the caller's own JWT resolves to a `super_admin`
profile (checked via the service-role client, not RLS). Validates `role`
is one of the four values; requires `hall_id` if `role === 'hall_manager'`.
Calls `admin.auth.admin.createUser({email, password, email_confirm:
true})`, then inserts a matching `profiles` row — merchants are always
created with `buyer_id: null` (assigned later via the Edit Buyer form's
merchant-contacts multi-select). If the profile insert fails, the just-
created auth user is deleted so there's no orphaned login.

**Returns**: `{ profile }` on success, `{ error }` with 400/401/403/500 on
failure.

**Frontend caller**: `core/lib/usersApi.js` → `createUser()`.

## `manage-user`

Admin-only edit/password-reset/delete, bundled into one function behind a
single `super_admin` check.

**Request body**: `{ action, user_id, ...action-specific fields }`, where
`action` is one of:

- `"update"` — `{ full_name, role, hall_id, custom_permissions,
  is_disabled, password? }`. Builds a partial patch (only provided fields
  change) and updates the `profiles` row; if `password` is present (min 6
  chars), also calls `auth.admin.updateUserById()` first. This is how
  Edit User bundles a password reset into the same save as everything
  else — no separate "reset password" flow.
- `"reset_password"` — `{ password }` standalone.
- `"delete"` — removes the `profiles` row, then the `auth.users` row.

**Returns**: `{ profile }` (update), `{ success: true }`
(reset_password/delete), or `{ error }`.

**Frontend caller**: `core/lib/usersApi.js` → `updateUser()`,
`setUserDisabled()` (a plain RLS-scoped `profiles` update, doesn't need
this function since `is_disabled` doesn't touch `auth.users`), and
`deleteUser()`.

## `send-notification` — the central notification service

**The only** place any email/push actually gets sent from — the frontend
never talks to Resend or Web Push directly.
`core/notifications/notify.js`'s `sendNotification(type, payload)` is the
sole caller, fire-and-forget (never throws to its caller — a failed send
must not roll back a checkout/return/recall that already succeeded in the
database).

**Request body**: `{ type, payload }`. No caller-role check — it's an
internal service any authenticated session (or the `pg_cron` job, via the
anon key) can invoke.

**Every `type` case**:

| Type | Fired from | Recipients |
|---|---|---|
| `checkout` | Sample issued | Merchant contacts + destination hall managers |
| `forward` | Sample forwarded | Merchant contacts + old/new hall managers |
| `return` | Sample returned | Merchant contacts + hall managers |
| `recall` | Merchant raises a recall | Hall managers |
| `feedback` | Feedback submitted | Always the fixed address `praagya@basant.info` — no in-app notification row inserted for this one |
| `validity_alert` | `send_validity_alerts()` pg_cron job | Admins + relevant hall manager + merchant |
| `validity_requested` | Merchant raises a validity extension request | Admin (+ hall manager, since managers can now approve too) |
| `validity_extended` | A request is approved, or admin directly edits | Merchant |
| `shift_requested` | Manager or merchant raises a shift request | The *other* party (whichever of hall manager/merchant didn't raise it) + admin — raiser excluded |
| `shift_decided` | Admin approves/rejects | Origin + (on approval) destination hall managers + merchant |
| `panel_checkout` / `panel_forward` / `panel_return` | Panel movement events | Same shape as the sample equivalents |
| `panel_retired` | Admin retires a panel | Relevant merchant/hall manager |
| `panel_validity_requested` / `panel_validity_extended` | Panel validity workflow | Same shape as the sample equivalents |

Unknown `type` → 400. Each handler (except `feedback`) does three things
in sequence: `sendEmail()` (Resend, both HTML and plain-text via
`buildEmailHtml`/`buildEmailText`, from `BASANT <noreply@basant.info>`),
`insertNotifications()` (writes `notifications` rows via the service-role
client, bypassing RLS), and `sendWebPushToRecipients()`.

**Web Push**: VAPID-signed, **empty-body** pushes — no RFC 8291 payload
encryption (a deliberate scope decision to avoid implementing ECDH+HKDF+
AES-GCM from scratch). The service worker (`src/sw.js`) shows a fixed
generic "you have new activity" notification on any push; the app
supplies real content once opened.

**WhatsApp**: `sendWhatsApp()` exists in the same file as an explicit
no-op stub — no WhatsApp Business API credentials configured, never
called by any handler. The Settings page's API Keys card shows it as
"Not configured — stub ready" alongside Resend/Email's "Configured"
badge.

## In-app notification bell

No Supabase Realtime anywhere in the app — the unread count polls every
45 seconds (`core/components/NotificationBell.jsx`); the notification
list itself is lazy-fetched only the first time the dropdown opens, not
on mount. 380px dropdown, grouped by day, swipe-left (drag threshold
-80px) marks a row read, "Mark all read" button. The "View all
notifications" footer link (→ `/admin/notifications`) is shown only for
`role === super_admin` — not shown to `custom`, even though that route is
technically reachable to them via the shared admin route tree.

`core/notifications/notificationsApi.js`'s `getNotificationRoute(role,
itemType, itemId)` maps a notification's item back to that role's own
list page with `{ openSampleId | openPanelId }` in router state — used by
both the bell dropdown and the full `/admin/notifications` page.
