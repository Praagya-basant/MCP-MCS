# Architecture

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + React Router v6, desktop-only (no responsive breakpoints below 1280px) |
| Styling | Tailwind CSS v3 (CSS-variable-driven tokens, light/dark theme) + Framer Motion for animation |
| Backend | Supabase — Postgres + Auth + Storage + Edge Functions |
| Email | Resend, called only from the `send-notification` edge function |
| Push | Web Push (VAPID), triggered from the same edge function |
| Charts | Recharts |
| Excel | `xlsx` (import/parsing) |
| Hosting | Vercel (frontend) + Supabase (backend) |

## Folder structure

```
src/
  main.jsx                Entry point
  index.css                Tailwind directives + design tokens (:root/.dark)
  pages/                    Role-agnostic route targets: Login, NotFound,
                            SampleRedirect (email "View Sample" deep link)
  app/                      App shell — role-agnostic
    Router.jsx                Full route tree, provider nesting
    Layout.jsx                 <Sidebar/> + <Topbar/> + <Outlet/>, desktop-only
    Sidebar.jsx                  240px/56px-collapsed, MCS/MCP pill switcher,
                                 role+permission-aware nav
    Topbar.jsx                    Context label + theme toggle + notification bell
  core/                      Shared infrastructure (no business logic)
    auth/                     AuthContext, ProtectedRoute
    components/               ~26 generic UI primitives: Button, Card, Modal,
                              Drawer, Table, Badge, Toast, NotificationBell,
                              SignaturePad, FileUpload, EmptyState, icons, etc.
    context/                  ThemeContext, ToastContext, FeedbackContext
    hooks/                    useAsyncData, useTableControls, useCountUp,
                              usePushSubscription
    lib/                      Cross-module Supabase data-access: supabaseClient,
                              buyersApi, hallsApi, usersApi, shiftRequestsApi,
                              validityApi, appSettingsApi, auditLog,
                              excelExport, extractSpreadsheetImages, feedbackApi
    notifications/            notify.js (sendNotification — the ONLY caller of
                              the send-notification edge function),
                              notificationsApi, notificationMeta, pushApi
    permissions/               PERMISSIONS map, hasPermission(),
                              CUSTOM_PERMISSION_TOGGLES (see "Permissions" below
                              for the gap between this file and what's actually
                              enforced)
    utils/                    constants.js (ROLES/enums), formatters.js, cn.js
  admin/                     Cross-module admin/platform pages — NOT tied to
                             one module's business data
    dashboard/, team/, halls/, settings/ (+ settings/AuditLog.jsx),
    feedback/, shift-requests/, validity-requests/, notifications/, reports/
    components/               Buyer/user/hall CRUD modals: AddBuyerModal,
                              CreateUserModal, EditUserModal, UsersPanel,
                              BuyersPanel, HallFormModal, MerchantSearchSelect,
                              ClearMovementHistoryDialog
  modules/
    mcs/                      Module 1 — samples
      api/                    samplesApi, movementsApi, recallsApi, commentsApi
      components/              Cross-role MCS UI: SampleDetailDrawer,
                              Issue/ForwardSampleModal, SampleThumbnail,
                              ActivityFeed, RaiseShiftRequestModal
      hooks/                   useOpenSampleFromLocation
      utils/                   activity.js (merges movements+recalls into one feed)
      pages/
        admin/                 Samples.jsx, Movements.jsx (admin's full-
                              visibility MCS view) + admin/components/
                              (BulkImageUploadModal, DeleteSampleModal,
                              EditSampleHallModal, UploadSamplesModal)
        hall/                  AddSample, Dashboard, Movements, Samples
        merchant/              Dashboard, Export, History, Recalls, Samples
                              + merchant/components/RaiseRecallModal
    mcp/                      Module 2 — panels (mirrors mcs/ exactly)
      api/                    panelsApi, panelMovementsApi
      components/              PanelDetailDrawer, Issue/ForwardPanelModal,
                              PanelThumbnail, PanelImageModal
      hooks/                   useOpenPanelFromLocation
      pages/admin|hall|merchant/  Same shape as mcs/pages/, plus
                              admin/components/RetirePanelModal
supabase/
  sql/schema.sql             Full DB schema, RLS, RPCs, storage — the
                              complete current reference; every migration
                              is inlined here too
  migrations/                 Numbered, additive-only migration files
  functions/
    send-notification/       All transactional email (Resend) + Web Push,
                             service-role only, single sendNotification() entry
    create-user/               Admin-only user creation (Auth admin API)
    manage-user/                Admin-only update/password-reset/delete
                              (Auth admin API)
```

**Rule of thumb for new code:** generic UI/infra usable by any role or
module → `core/`. Cross-module admin oversight (not tied to one module's
business data) → `admin/`. Sample- or panel-tracking business logic →
`modules/mcs/` or `modules/mcp/`. **Module A never imports directly from
Module B.** Anything both modules need belongs in `core/` — this is why
`buyersApi`/`hallsApi`/`usersApi`/`shiftRequestsApi` live in `core/lib/`
rather than `modules/mcs/api/`, even though they originated there: both
modules and every role need buyers/halls/users, so keeping them under
`mcs/` would have made `mcp/` import from `mcs/`.

## Desktop-only

There is no mobile layout, no bottom navigation, no responsive breakpoints
below 1280px. The Sidebar has a fixed 240px width (56px collapsed,
state persisted to `localStorage['basant-sidebar-collapsed']`), not a
drawer or bottom-nav pattern.

## Routing (`src/app/Router.jsx`)

Three top-level protected route trees, each wrapped in the same
`<Layout/>` (Sidebar + Topbar are self-sufficient — they read
`role`/`profile` from `AuthContext` directly rather than receiving nav
data as props, so every role's route tree can reuse one Layout element):

- `/admin/*` — `allowedRoles={[SUPER_ADMIN, CUSTOM]}`. Includes both the
  cross-module `admin/` pages (team, halls, settings, validity-requests,
  shift-requests, notifications, feedback, reports, audit-log) and MCS's
  admin-scoped business pages (`samples`, `movements`), plus `mcp/*`
  sub-paths for the panel module's admin view.
- `/hall/*` — `allowedRoles={[HALL_MANAGER]}`. `dashboard`, `samples`,
  `add-sample`, `movements`, plus `mcp/*` panel equivalents.
- `/merchant/*` — `allowedRoles={[MERCHANT]}`. `dashboard`, `samples`,
  `history`, `recalls`, `export`, plus `mcp/*` panel equivalents
  (merchant panel view has no separate movements page).

`ROLES.CUSTOM` shares the **entire** admin route tree with `SUPER_ADMIN` —
there's no separate `/custom` route tree. What a custom user actually sees
is narrowed by `Sidebar.jsx`'s nav filtering and by RLS
(`has_custom_permission()`), not by the router.

`/sample/:btCode` is a role-agnostic deep link (any authenticated role,
bare `<ProtectedRoute/>` with no `allowedRoles`) used by the "View Sample"
button in notification emails — see `SampleRedirect.jsx`.

## Auth flow (`src/core/auth/`)

1. `AuthProvider` listens to `supabase.auth.onAuthStateChange`; the
   listener is deliberately **not async** and defers profile loading via
   `setTimeout(..., 0)` to avoid a Supabase internal auth-lock deadlock
   that would otherwise silently break session rehydration on reload.
2. `loadProfile()` selects `profiles.*` joined with `hall`/`buyer`;
   `signIn()` checks `profiles.is_disabled` immediately after a
   successful password auth and signs the user back out with a clear
   error if set, so a disabled account never reaches the app shell on a
   fresh login. An already-open session isn't force-terminated
   mid-session — it's only blocked at the next sign-in attempt or the
   next RLS-gated query (RLS fails closed for disabled profiles too, see
   `docs/database.md`).
3. `ProtectedRoute` gates a route subtree: no session → `/login?redirectTo=<path>`;
   wrong role → redirected to *their own* home via `ROLE_HOME`.
4. There is no signup page — admins create every account via the
   `create-user` edge function (needs the Auth admin API / service-role
   key, which can never reach the browser).

## Permissions system — current state

`src/core/permissions/index.js` defines a `PERMISSIONS` map (action →
allowed roles) and `hasPermission(role, action, customPermissions)`, plus
`CUSTOM_PERMISSION_TOGGLES` (the six checkboxes shown when creating/editing
a Custom-role user: View All Buyers, Manage Users, View Movements, Export
Data, Manage Samples, Manage Panels).

**This is only partially wired in.** `hasPermission()`/`PERMISSIONS` are
not imported anywhere outside their own file — no page or button currently
calls `hasPermission()`. The two things that actually enforce
custom-role access are separate from this file:

- `Sidebar.jsx` hand-rolls its own `customPermissions[key]` checks to
  decide which nav items a custom user sees (using raw
  `profiles.custom_permissions` keys, not `hasPermission()`).
- The database's `has_custom_permission(key)` SQL function, wired into
  the `buyers_select`/`samples_select`/`movements_select`/
  `panels_select`/`panel_movements_select` RLS policies — this is the
  real security boundary regardless of what the frontend shows.

The `manage_users` and `export_data` toggles currently drive the Create/Edit
User checkbox UI only — no RLS policy or Sidebar check consumes them yet.
See `docs/roadmap.md` for what closing this gap would take.

## Notification architecture

`core/notifications/notify.js`'s `sendNotification(type, payload)` is the
**only** caller of the `send-notification` edge function anywhere in the
codebase — fire-and-forget, never throws to its caller, so a failed send
never rolls back a checkout/return/recall that already succeeded in the
database. See `docs/api.md` for the full event-type list and edge function
behavior.

## Theming

Every Tailwind color resolves through a CSS variable (`rgb(var(--color-x) /
<alpha-value>)`), redefined under a `.dark` class on `<html>` — see
`docs/design-system.md`. `ThemeContext` toggles that class and persists the
choice to `localStorage`; no component branches on theme itself.
