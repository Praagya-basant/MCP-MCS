# BASANT SSM/MCP — Architecture Reference

This file orients future Claude Code sessions (and humans) working in this
repo. Read it before making structural changes.

## What this is

BASANT is a multi-tenant desktop web app (1280px+, no mobile layout) for
tracking physical product samples ("BT codes", Module 1 — **MCS**) and
counter panels (Module 2 — **MCP**) that move in and out of BASANT's
exhibition halls. Both modules are built and live side by side under one
codebase, switched via a pill toggle in the sidebar — see
[Module boundary](#module-boundary-mcs-vs-mcp) below.

Four roles, one codebase:

- **Admin** (role `super_admin` in the DB) — full visibility, manages buyers/halls/users/settings.
- **Manager** (role `hall_manager` in the DB) — scoped to one hall; adds
  samples/panels, issues/returns them, can approve a merchant's pending
  validity-extension request for items in their own hall.
- **Merchant** — scoped to one or more buyers, read-only + comments/recalls/export/shift & validity requests.
- **Custom** (role `custom`) — no fixed permission set of its own; an
  admin toggles what a specific custom user can see (View All Buyers,
  Manage Users, View Movements, Export Data, Manage Samples, Manage
  Panels) via `profiles.custom_permissions`. Routed into the admin shell
  (`/admin/*`) but with the sidebar and RLS both narrowed to their
  toggles — see `core/permissions/index.js` and `has_custom_permission()`
  in `schema.sql`. For assistants/directors/read-only users.

Role *display* labels ("Admin", "Manager") live in `ROLE_LABELS`
(`core/utils/constants.js`) and are intentionally shorter than the DB
`role` values (`super_admin`, `hall_manager`) — never rename the DB
values to match, always go through `ROLE_LABELS`.

## Tech stack

| Layer     | Choice                                              |
|-----------|------------------------------------------------------|
| Frontend  | React 19 + Vite + React Router v6 (desktop-only, no responsive breakpoints) |
| Styling   | Tailwind CSS v3 (custom design tokens, no UI kit) + Framer Motion for animation |
| Backend   | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Email     | Resend, called only from an Edge Function             |
| Hosting   | Vercel (frontend) + Supabase (backend)                |

## Folder structure

```
src/
  main.jsx                  Entry point
  index.css                 Tailwind directives + design-token base styles
  pages/                    Routes with no role: Login, NotFound, SampleRedirect
  app/                      App shell — not role- or module-specific
    Router.jsx               Route tree (all roles), providers (was App.jsx)
    Layout.jsx                Self-sufficient shell: <Sidebar/> + <Topbar/> + <Outlet/>
    Sidebar.jsx                240px/56px-collapsed, MCS/MCP pill switcher,
                                role+permission-aware nav, bottom user dropdown
    Topbar.jsx                  Context label + theme toggle + notification bell
  core/                      Everything role-agnostic and module-agnostic
    auth/                     AuthContext, ProtectedRoute
    components/               UI kit: Button, Input, Modal, Table, Toast, ...
    context/                  ThemeContext, ToastContext, FeedbackContext
    hooks/                    useAsyncData, useTableControls, useCountUp
    notifications/            notify.js (sendNotification — the ONLY caller
                               of the send-notification edge function),
                               notificationsApi, notificationMeta, pushApi
    permissions/              index.js — PERMISSIONS map, hasPermission(),
                               CUSTOM_PERMISSION_TOGGLES (see Access control below)
    lib/                      supabaseClient, excelExport, extractSpreadsheetImages,
                               feedbackApi, validityApi, appSettingsApi, auditLog,
                               and the cross-module data APIs: buyersApi, hallsApi,
                               usersApi, shiftRequestsApi (NOT MCS-specific — both
                               modules and every role need buyers/halls/users, so
                               these don't live under modules/mcs/ the way
                               samples/movements-specific APIs do)
    utils/                    constants.js (enums), formatters.js, cn.js
  admin/                     Cross-module admin platform pages (not MCS- or
                             MCP-specific business data — Samples/Movements
                             stay in their own module, see below)
    dashboard/, team/, halls/, settings/, feedback/,
    shift-requests/, validity-requests/, notifications/, reports/
    components/               AddBuyerModal, CreateUserModal, EditUserModal,
                               UsersPanel, BuyersPanel, HallFormModal, ...
  modules/
    mcs/                      Module 1 — Master Counter Sample
      api/                    samplesApi, movementsApi, recallsApi, commentsApi
                               (buyers/halls/users/shift-requests moved to core/lib — see above)
      components/              Cross-role MCS UI: SampleDetailDrawer, IssueSampleModal,
                               ForwardSampleModal, SampleThumbnail, ActivityFeed
      hooks/                   useOpenSampleFromLocation
      utils/                   activity.js — merges movements+recalls into
                               one timestamp-sorted dashboard feed
      pages/
        admin/                 Samples.jsx, Movements.jsx (admin's full-visibility
                               view of MCS data — not the cross-module admin/ pages above)
        hall/                  AddSample, Dashboard, Movements, Samples
        merchant/              Dashboard, Export, History, Recalls, Samples
    mcp/                      Module 2 — Master Counter Panel (mirrors mcs/ exactly)
      api/                    panelsApi, panelMovementsApi
      components/              PanelDetailDrawer, IssuePanelModal, ForwardPanelModal,
                               PanelThumbnail, RetirePanelModal
      hooks/                   useOpenPanelFromLocation
      pages/admin|hall|merchant/  Same shape as mcs/pages/
supabase/
  sql/schema.sql             Full DB schema, RLS, RPCs, storage — the
                              complete, current reference; every migration
                              gets inlined here too (see migrations/ below)
  migrations/                 Numbered, additive-only migration files —
                              every new DB change from here forward goes in
                              a new migration file AND gets appended to
                              schema.sql, so schema.sql never goes stale
  functions/
    send-notification/       All transactional email (Resend) + WhatsApp
                              stub, service-role only
    create-user/               Admin-only user creation (Auth admin API)
    manage-user/                Admin-only edit/password-reset/delete
                              (Auth admin API) — see Auth flow below
```

**Rule of thumb for new code:** if it's generic UI/infra usable by any
role or module, it goes in `core/`. If it's cross-module admin oversight
(not tied to one module's business data), it goes in `admin/`. If it's
specific to sample-tracking or panel-tracking business logic, it goes in
`modules/mcs/` or `modules/mcp/` respectively. **Module A never imports
directly from Module B** (`modules/mcp/*` never imports from
`modules/mcs/*` or vice versa) — anything both need belongs in `core/`.

**Desktop-only:** there is no mobile layout, no bottom navigation, no
responsive breakpoints below `lg`. Don't reintroduce `md:`/`sm:` responsive
pairs, mobile card-list fallbacks, or touch-target sizing — this was a
deliberate pivot away from an earlier mobile-first/PWA-installable design.
The PWA manifest/service worker (`vite.config.js`, `src/sw.js`) were left
in place (not part of what was asked to change) but the UI itself now only
targets 1280px+ desktop screens.

## Module boundary: MCS vs MCP

Both modules are fully built and coexist side by side:

- **Same shape, separate folders**: `modules/mcp/` mirrors `modules/mcs/`'s
  internal shape (`api/`, `components/`, `hooks/`, `pages/admin|hall|merchant/`)
  file-for-file. Neither imports from the other.
- **Shared shell, one Sidebar**: `app/Sidebar.jsx` renders a single
  self-sufficient sidebar for every role — it reads `role`/`profile` from
  `AuthContext` directly (no per-role wrapper layout components anymore;
  `AdminLayout`/`HallLayout`/`MerchantLayout` were retired when the
  restructure landed). The MCS/MCP pill switcher derives which module's
  nav list to show from the current URL (`/mcp/` in the path = MCP), not
  separate state — clicking a pill just navigates to that module's
  dashboard for the current role.
- **Same auth, same roles**: `AuthContext` and the `profiles` table are
  platform-wide, not MCS-specific. MCP reuses `useAuth()` as-is.
- **Own tables, own RLS**: MCP's tables (`panels`, `panel_movements`) have
  their own RLS policies following the same
  `current_role()/current_hall_id()/current_buyer_id()` helper functions
  MCS uses. MCS's tables are never altered to accommodate MCP.
- **Polymorphic cross-module tables**: `validity_requests`,
  `validity_changes`, and `shift_requests` all use `item_type` (`'sample'
  | 'panel'`) + `item_id` (no FK, since it points at either module's
  table) rather than duplicating one table per module. `review_shift_request`
  and `review_validity_request` (both `SECURITY DEFINER` RPCs in
  `schema.sql`) branch on `item_type` internally to update the right
  table (`samples`/`movements` vs `panels`/`panel_movements`).
- **Routes**: `/admin/mcp/*`, `/hall/mcp/*`, `/merchant/mcp/*` sit
  alongside the MCS routes in `app/Router.jsx`, all under the same
  `<Layout/>` element per role.

## Data model (see `supabase/sql/schema.sql` for the source of truth)

- `buyers` — companies whose samples/panels get signed in.
- `halls` — the physical halls, seeded once.
- `profiles` — one row per login, `id` = `auth.users.id`. `role` is
  `super_admin | hall_manager | merchant | custom`. `hall_id` set for hall
  managers. `buyer_id` set for merchants — but *not* at creation time; see
  merchant assignment note below. `is_disabled` (default false) — see
  [Disabling a user](#disabling-a-user) below. `custom_permissions` jsonb
  — only meaningful when `role = 'custom'`.
- `samples` — one row per physical sample (`bt_code` unique). `status` is
  `in_hall | checked_out`.
- `panels` — one row per physical panel (`panel_code` unique). `status` is
  `in_hall | issued | retired`. Extra fields: `panel_ref`, `panel_finish`,
  `finish_recipe`, `is_shared` (visible to every merchant, not scoped to
  one buyer), `retired_reason`/`retired_at`/`retired_by`.
- `movements` / `panel_movements` — one row per checkout, updated in place
  on return (`status: out -> returned`). `hop_number` + `from_hall_id`/
  `destination_hall_id` track multi-hop forwards. `panel_movements.quantity`
  (nullable int) tracks how many units moved in that leg.
- `merchant_contacts` — join table: which profiles receive email
  notifications for a given buyer.
- `validity_requests` / `validity_changes` — polymorphic (see Module
  boundary above). A merchant raises a request; admin can always approve
  it, and now so can a hall manager for an item in their own hall (see
  `review_validity_request` in schema.sql) — logged as "Extended by
  <name> (Manager)" vs admin's "Approved request: ...". Admin can also
  directly set any expiry date (including a past one — a pre-expire) via
  `admin_update_validity`, logged with a "Pre-expired: " prefix when the
  new date is in the past.
- `shift_requests` — polymorphic hall-transfer requests. Both the raiser's
  counterpart (manager or merchant, whichever didn't raise it) and admin
  get notified; admin approves/rejects via `review_shift_request`, which
  logs a movement row and updates the item's `hall_id` on approval.
- `audit_log` — append-only. `actor_id` defaults to `auth.uid()` server-
  side, so `core/lib/auditLog.js`'s `logAuditEvent(action, details)` never
  needs to look up the caller's own id. Insert-own/select-admin RLS.
- `app_settings` — a single admin-configurable row (sender identity,
  notification-event toggles, Vercel deploy hook URL, uploaded logo URL).
  **Never** stores real API keys (Resend/WhatsApp) — those stay as Edge
  Function secrets; this table only shows a configured/not-configured
  badge on the Settings page.
- `recall_requests` — merchant-raised requests to return a sample early.
- `sample_comments` — merchant comments on a sample, visible to admin/hall
  manager of that sample too.

### Merchant-to-buyer assignment lives entirely in the Buyer form

Add User no longer collects a buyer for merchant role — `create-user`
always inserts merchant profiles with `buyer_id: null`. The only place a
merchant gets connected to a buyer is the Add/Edit Buyer form's
"Merchant Contacts" checkbox multi-select (`admin/components/
MerchantSearchSelect.jsx`), backed by `buyersApi.syncMerchantContacts()`
(now `core/lib/buyersApi.js`). Checking a merchant there does two things
in one call: inserts a `merchant_contacts` row (email routing) *and* sets
that profile's `buyer_id` (actual RLS scoping — `current_buyer_id()` reads
this column, `merchant_contacts` alone does not grant access). Unchecking
does the reverse, clearing `buyer_id` only if it still points at that
buyer. A merchant profile has a single `buyer_id`, so this only supports
one "home" buyer per merchant even though `merchant_contacts` itself is a
many-to-many table.

### Why RPC functions instead of direct table writes

`checkout_sample`/`return_sample`/`forward_sample` (and their panel
mirrors `checkout_panel`/`return_panel`/`forward_panel`) — all `SECURITY
DEFINER` — are the *only* way `samples.status`/`panels.status` and their
movement rows change. They update status and insert/update the movement
row in one transaction (so the two can never drift out of sync) and
enforce hall-scoping themselves, so no separate RLS `UPDATE` policy is
needed for hall managers. Don't add direct `.update(...)` calls for
status changes — go through the RPCs.

`clear_movement_history()` follows the same pattern for a different
reason: `movements` has no DELETE policy at all, so wiping the audit
trail requires a `SECURITY DEFINER` function regardless. Frontend:
`modules/mcs/api/movementsApi.js` → `clearMovementHistory()`, wired to
the "Clear Test Data" button on `/admin/settings` (moved there from
Movements — `admin/components/ClearMovementHistoryDialog.jsx`, requires
typing "DELETE" to enable, a harder-to-misclick confirmation than the
standard `ConfirmDialog`).

### RLS model

Every table has RLS enabled. Scoping is driven by four `SECURITY DEFINER`
helper functions (`current_role()`, `current_hall_id()`,
`current_buyer_id()`, `is_super_admin()`) that read the caller's own
`profiles` row. **All four now fail closed for a disabled profile** — see
[Disabling a user](#disabling-a-user) — so disabling someone locks out
every policy in the schema in one place, rather than needing "and not
is_disabled" added to each individual policy. A fifth helper,
`has_custom_permission(key)`, grants read access on `buyers`/`samples`/
`movements`/`panels`/`panel_movements` when the caller is a `custom`-role
user with that specific toggle set — write access is never granted this
way, every insert/update policy still requires `is_super_admin()` or an
exact role match.

### Disabling a user

`profiles.is_disabled` (Admin → Team & Buyers → Users table, a click-to-
toggle Status badge) doesn't delete the account — it makes
`current_role()`/`current_hall_id()`/`current_buyer_id()`/
`is_super_admin()` all return null/false for that caller, which fails
every RLS policy that depends on them (nearly all of them). `AuthContext.
signIn()` also checks `is_disabled` right after a successful password
auth and immediately signs the user back out with a clear error if it's
set, so a disabled account never even briefly reaches the app shell on a
fresh login. An already-open session isn't force-terminated mid-session —
their next data fetch just starts coming back empty/erroring, not an
instant kick.

## Auth flow

1. `AuthProvider` (`core/auth/AuthContext.jsx`) wraps the app, listens to
   `supabase.auth.onAuthStateChange`, and loads the matching `profiles`
   row (with `hall`/`buyer` joined) whenever the session changes.
2. `ProtectedRoute` (`core/auth/ProtectedRoute.jsx`) gates a route
   subtree: no session → `/login?redirectTo=<path+search>`; wrong role →
   redirected to *their own* home via `ROLE_HOME` (never stuck on an
   error page). `custom` role is allowed alongside `super_admin` on every
   `/admin/*` route (see Sidebar/permissions for how visibility narrows
   from there). `Login.jsx` reads `redirectTo` back out (validated
   same-site — see `safeRedirect()`) and lands there after sign-in.
3. There is **no signup page** — admins create every account. Login reads
   `role` from `profiles` and `Router.jsx`'s `RootRedirect` sends the user
   to `/admin`, `/hall`, or `/merchant` accordingly (`custom` → `/admin`).

### Deep-linking a sample (`/sample/:btCode`)

The "View Sample" button in every notification email points at
`https://mcp-mcs.vercel.app/sample/<bt_code>`. That route
(`pages/SampleRedirect.jsx`, behind a bare `<ProtectedRoute />`) looks the
sample up via `samplesApi.getSampleByBtCode()` (RLS-scoped) and redirects
into that role's own `/*/samples` list with `state: { openSampleId }`.
Each role's Samples page picks that up via
`modules/mcs/hooks/useOpenSampleFromLocation.js` and opens the
`SampleDetailDrawer` for it.

### Creating and managing users (why they need Edge Functions)

Supabase's Auth admin API requires the service-role key, which must never
reach the browser.

- `supabase/functions/create-user/` — verifies the caller is
  `super_admin`, creates the auth user + matching `profiles` row
  (including `role: 'custom'` + `custom_permissions` when applicable).
  Frontend: `core/lib/usersApi.js` → `createUser()`.
- `supabase/functions/manage-user/` — same admin check, handles three
  actions via one function: `update` (name/role/hall/custom-permissions +
  an optional password reset, bundled so Edit User is one call),
  `reset_password` (standalone), `delete` (removes the auth user and
  profile row). Frontend: `usersApi.js` → `updateUser()`/`deleteUser()`.
  Disabling/enabling a user does **not** go through this function — it's
  a plain RLS-scoped `profiles` update (`setUserDisabled()`), since
  `is_disabled` doesn't touch `auth.users` at all.
- `admin_list_users_last_login()` (a `SECURITY DEFINER` SQL RPC, not an
  edge function) is the one narrow, read-only, admin-gated window into
  `auth.users.last_sign_in_at` the Users table needs — `auth.users` isn't
  otherwise exposed to the client.

## Email notifications

All notification flows live in `supabase/functions/send-notification/`.
The frontend never talks to Resend (or WhatsApp) directly —
`core/notifications/notify.js`'s `sendNotification(type, payload)` is the
**only** caller of that edge function anywhere in the codebase, and it's
fire-and-forget: a failed send must never fail or roll back a
checkout/return/recall that already succeeded in the database. If you add
a new email type, add a `case` in that function's `switch`, not a new
function. A `sendWhatsApp()` stub exists in the same file — no WhatsApp
Business API credentials configured yet, but the call site and message-
building shape are ready for when they are.

Every email is sent as both `html` and a plain-text fallback via the
shared `buildEmailHtml`/`buildEmailText({ heading, rows, btCode })`
helpers. Sender is `BASANT <noreply@basant.info>` by default (`app_settings.
sender_name`/`sender_email` are admin-editable on the Settings page, but
nothing reads them into the edge function automatically yet — the
`FROM_ADDRESS` constant in `send-notification/index.ts` is still the
actual source of truth for what Resend sends from).

`.env` / `.env.example` documents `VITE_RESEND_API_KEY` but no frontend
code reads it. The real key is an Edge Function secret: `supabase secrets
set RESEND_API_KEY=...`.

## Access control

`core/permissions/index.js` exports `PERMISSIONS` (the fixed action →
allowed-roles map — `sample.issue`, `panel.retire`, `user.manage`, etc.)
and `hasPermission(role, action, customPermissions)`. For the three fixed
roles this is a simple table lookup; for `custom` it's the table lookup
**or** a matching `customPermissions` flag, since the spec's own
`PERMISSIONS` table already lists `'custom'` as a baseline for a few
actions (`sample.view`, `shift.request`, `export.data`) independent of
that user's specific toggles. Components should call `hasPermission()`
rather than hardcoding a role-name check — this is enforced today mainly
in `app/Sidebar.jsx` (nav visibility) and is the pattern to extend to
individual action buttons going forward, not yet done exhaustively across
every mutation in the app. The real security boundary is always RLS
(`has_custom_permission()` in schema.sql), not the frontend check — a
hidden button is UX polish, not a permission grant.

## Frontend data-fetching pattern

- `core/hooks/useAsyncData(fetcher, deps)` — standard
  fetch/loading/error/reload wrapper used by every page. Returns
  `{ data, loading, error, reload, setData }`.
- `core/hooks/useTableControls(rows, { searchFields, initialSort })` —
  client-side search + filter + sort + pagination (20 rows/page, see
  `PAGE_SIZE` in `constants.js`). Also returns `filteredRows` (the full
  filtered-but-unpaginated set) for anything that needs "everything
  currently matching the filters," like a per-page Export button. If a
  table needs a date-range filter, pre-filter the rows array before
  passing it to the hook rather than extending the hook's filter matcher.

## Design system

Tokens live in `tailwind.config.js` (colors, radii, shadows, font sizes)
and `src/index.css` (base styles — every color resolves through a CSS var
so `ThemeContext` toggling the `dark` class on `<html>` re-themes the
whole app at once; no component branches on theme itself). Key
constraints:

- Font: Inter, weights 400/500/600/700.
- Spacing: stick to Tailwind's default scale values that land on the 8px
  grid — `2` (8px), `4` (16px), `6` (24px), `8` (32px), `10` (40px), `12`
  (48px).
- No spinners for data loading — use `Skeleton` / `TableSkeleton` /
  `StatCardSkeleton`.
- Toasts (bottom-right, 3s auto-dismiss) via `useToast()` from
  `core/context/ToastContext.jsx` — call `.success()`, `.error()`, or
  `.info()`, never render a toast manually.
- `Logo` (`core/components/Logo.jsx`) renders `public/logo-black.png`
  (light surfaces — sidebar) or `public/logo-white.png` (dark surfaces —
  login left panel, which is fixed `#1A1A1A` regardless of the app theme
  — it's brand chrome, not themed UI).
  `PillTabs` (`core/components/PillTabs.jsx`) is the segmented
  All/In&nbsp;Hall/Issued-style status filter used on every sample/panel
  list — prefer it over a `<Select>` for any status-shaped filter.
- `Modal` (centered, max-width 520px default) and `Drawer` (480px,
  slides in from the right) both animate open *and* close (mount vs.
  visible are separate state) — don't replace their conditional
  rendering with a plain `if (!open) return null`.
- Buyer names are shortened for display only (`shortenBuyerName()` in
  `core/utils/formatters.js`), applied at the API boundary so every
  component that renders `buyer.name` gets the short form automatically.
- `core/permissions`'s `CUSTOM_PERMISSION_TOGGLES` drives the toggle list
  shown in Create/Edit User when role is Custom — add a new toggle there
  (and a matching `has_custom_permission()` check in schema.sql if it
  should unlock real data) rather than inventing a new ad-hoc flag shape.

## Setup checklist (fresh Supabase project)

1. `cp .env.example .env`, fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
2. Run `supabase/sql/schema.sql` once in the Supabase SQL editor — it's
   the complete, current schema (every migration in `supabase/migrations/`
   is already inlined into it).
3. Deploy the edge functions and set the Resend secret:
   ```
   supabase functions deploy send-notification
   supabase functions deploy create-user
   supabase functions deploy manage-user
   supabase secrets set RESEND_API_KEY=your_resend_key
   ```
   Verify the `basant.info` sending domain in Resend so
   `noreply@basant.info` can send.
4. Create the first Admin manually (there's no signup flow):
   add a user in Supabase Auth → Users, then insert a matching row:
   ```sql
   insert into profiles (id, full_name, email, role)
   values ('<auth-user-uuid>', 'Your Name', 'you@basant.info', 'super_admin');
   ```
5. `npm install && npm run dev`. Log in as the admin, then use
   Admin → Team & Buyers to create hall managers and merchants —
   everything after step 4 happens through the UI.
6. Deploying to Vercel: set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   as project env vars. Nothing Resend-related belongs in Vercel's env —
   that only lives in Supabase's edge function secrets. If you want the
   Settings page's "Trigger Redeploy" button to work, create a Deploy
   Hook in Vercel (Project Settings → Git → Deploy Hooks) and paste its
   URL into Admin → Settings → Deployment.
