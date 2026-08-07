# User Workflows

## Admin (`super_admin`)

Full visibility, platform-wide. Lands on `/admin/dashboard` after login.

**Dashboard** — stat cards (Total Samples/In Hall/Issued/Buyers/
Merchants, click through to a filtered list or drawer), buyer-wise bar
chart, status pie chart, top-movements table, time-of-day greeting.

**Samples** (`/admin/samples`) — full sample list across every hall/buyer,
sortable columns, PillTabs status filter, camera-icon action to upload/
replace a sample's image, edit-hall action (reassign directly, no
approval needed), delete action (blocked if currently checked out), "Upload
Images" bulk action (batch-match filenames to BT codes). Clicking a row
opens `SampleDetailDrawer` (tabs: Details / Movement History / Comments;
footer actions: Issue if in-hall, Return if issued, Raise Recall, Manage
Validity).

**Movements** (`/admin/movements`) — full cross-hall/buyer movement log,
filterable, drawer with full movement detail including photo/signature
thumbnails.

**Team & Buyers** (`/admin/team`) — two pill tabs:
- *Users* — create/edit/delete accounts, disable/enable toggle, last
  login. Editing lets you change role/hall/reset password all in one
  save. Creating a `custom`-role user shows a 6-toggle permission panel
  (View All Buyers, Manage Users, View Movements, Export Data, Manage
  Samples, Manage Panels).
- *Buyers* — add/edit/delete (blocked if the buyer has active samples),
  merchant-contacts multi-select (this is the **only** place a merchant
  gets connected to a buyer — Create User doesn't collect one).

**Halls** (`/admin/halls`) — add/rename, blocked delete if not empty.

**Validity Requests** (`/admin/validity-requests`) — approve/reject
pending extension requests from merchants, for both samples and panels.

**Shift Requests** (`/admin/shift-requests`) — approve/reject pending
hall-reassignment requests; approval auto-logs a movement and updates the
item's home hall.

**Notifications** (`/admin/notifications`) — full history of every
system notification, grouped, mark-all-read (the bell dropdown is a
20-item preview of the same feed).

**Feedback** (`/admin/feedback`) — inbox of user-submitted feedback,
mark-read.

**Export** (`/admin/export`) — cross-module Excel export (samples,
movements, panels), styled (logo, header row, alternating shading,
print-ready A4).

**Settings** (`/admin/settings`) — sender identity (name/email),
notification-preference toggles, API key status badges (Resend
configured, WhatsApp "not configured — stub"), Vercel deploy-hook URL +
Trigger Redeploy button, Clear Test Data (types "DELETE" to confirm,
wipes all movement history), link to Audit Log.

**MCP mirror** — `/admin/mcp/dashboard`, `/admin/mcp/panels`,
`/admin/mcp/movements` — same shape as the MCS pages above, plus a
retire action (admin-only, requires a reason, blocked while issued).

## Manager (`hall_manager`)

Scoped to one hall (`profiles.hall_id`). Lands on `/hall/dashboard`.

**Dashboard** — hall-scoped stats, greeting.

**Samples** (`/hall/samples`) — samples currently in *their* hall
(and ones issued out from it). Can issue (fills out picker name,
destination, reason, optional photo/signature) and return. Clicking a
row opens the same `SampleDetailDrawer` as admin sees, scoped to what
RLS allows — can raise a shift request or approve a *pending* validity
request for an item in their own hall (cannot directly extend/pre-expire
without a prior merchant request — that's admin-only via
`admin_update_validity`).

**Add Sample** (`/hall/add-sample`) — create-sample form, always lands
the new sample in their own hall.

**Movements** (`/hall/movements`) — movement log scoped to their hall.

**MCP mirror** — `/hall/mcp/dashboard`, `/hall/mcp/panels`,
`/hall/mcp/add-panel`, `/hall/mcp/movements` — same shape, panel
equivalent (no retire — that's admin-only).

**Not available to a manager**: Team & Buyers, Halls, Settings, Feedback,
cross-hall visibility, direct validity extend/pre-expire, delete actions.

## Merchant

Scoped to one or more buyers (via `profiles.buyer_id` and/or the
`merchant_buyers` join table). Lands on `/merchant/dashboard`.

**Dashboard** — their samples' stats, recent activity feed (merges
movements + recalls into one timestamp-sorted feed).

**Samples** (`/merchant/samples`) — read-only list of their buyer's
samples (plus any `is_shared` panels in the MCP equivalent) across every
hall. Can open the drawer to view details/history/comments, add a
comment, raise a recall, or raise a validity extension request — cannot
issue/return/edit/delete.

**History** (`/merchant/history`) — their full movement history.

**Recalls** (`/merchant/recalls`) — list of recalls they've raised +
status, plus the "raise a recall" action (also reachable from a sample's
drawer).

**Export** (`/merchant/export`) — Excel export of their own samples +
movement history, same styled format as the admin export.

**MCP mirror** — `/merchant/mcp/dashboard`, `/merchant/mcp/panels` (no
separate movements page — panel movement history is viewed via each
panel's own drawer).

**Not available to a merchant**: any hall-scoped or cross-buyer data,
issue/return/edit/delete, direct validity changes (request-only), shift
requests are raisable but not approvable.

## Custom role

Shares the **entire admin route tree** (`/admin/*`) with `super_admin` —
there's no separate route tree, so what a custom user actually sees is
narrowed by two things:

1. **Sidebar nav filtering** (`app/Sidebar.jsx`): the MCS/MCP Movements
   nav item only shows if `custom_permissions.view_movements` is true.
   Of the cross-module admin section, **only** Team & Buyers and Halls
   are ever shown (gated by `custom_permissions.view_all_buyers`) —
   Validity Requests, Shift Requests, Notifications, Feedback, and
   Settings are never shown to a custom user regardless of their toggles
   (hardcoded admin-only in the nav item list), even though the routes
   themselves aren't blocked by the router.
2. **RLS** (`has_custom_permission()`): actually unlocks row-level read
   access to `buyers`/`samples`/`movements`/`panels`/`panel_movements`
   per the `view_all_buyers`/`manage_samples`/`manage_panels`/
   `view_movements` toggles. Write access is **never** granted this way —
   every insert/update policy in the schema still requires
   `is_super_admin()` or an exact role match, so a custom user can look
   but not touch beyond what's select-scoped, regardless of any toggle.

In practice, a custom user is a read-oriented role (assistant/director)
whose visibility is admin-shaped but permission-toggle-narrowed — see
`docs/roadmap.md`'s Permissions gap note for what isn't fully wired yet
(`manage_users`/`export_data` toggles currently do nothing).
