# Roadmap

Snapshot as of the `core/modules/admin/app` desktop rebuild (merged to
`main`). "Built" means the code exists and is wired end-to-end
(frontend + RLS); "Pending" means missing, stubbed, or only partially
wired — each pending item says exactly what's missing, not just that the
feature "isn't done."

## Built

**Foundation**
- Full restructure: `core/` (infra) + `modules/{mcs,mcp}/pages/{admin,hall,merchant}/`
  (business pages) + `admin/` (cross-module platform pages) + `app/`
  (shell). Desktop-only — no responsive breakpoints, no bottom nav, no
  mobile card-list fallbacks.
- Light/dark theme system, CSS-variable-driven, persisted to
  `localStorage`, toggle in Sidebar's account menu and Topbar.
- Auth: sign-in, disabled-user block (both at sign-in and via RLS
  fail-closed), role-based redirect home, no signup page (admin-created
  accounts only).

**MCS (samples) — full lifecycle**
- Add, issue, return, forward (multi-hop), delete (admin).
- Photo + signature capture on issue/forward.
- Bulk Excel import with flexible header parsing + fallback hall
  dropdown; bulk image upload matching filename to BT code.
- Validity: badges (valid/expiring-soon-30d-pulse/expiring-15d-faster-pulse/expired),
  merchant-raised extension requests, admin direct edit (extend or
  pre-expire), **and** hall-manager approval of a pending request scoped
  to their own hall.
- Recalls (merchant raises, hall manager/admin action) and per-sample
  comment threads.
- Hall shift requests: raise (manager or merchant), dual-party
  notification (raiser excluded), admin approve/reject, auto-logged
  movement + home-hall update on approval — works for **both** samples
  and panels (the RPC used to be sample-only despite the table always
  being polymorphic; fixed).

**MCP (panels) — mirrors MCS**
- Same lifecycle (add/issue/return/forward), plus panel-specific fields:
  Panel Ref, Panel Finish, Finish Recipe, Is Shared toggle, and a
  `quantity` field tracked per movement (issue/forward forms + shown in
  the movement timeline when set).
- Retirement (admin-only, reason required, blocked while issued) —
  retired panels stay visible in history, excluded from active lists.
- Panel validity alerts run through the same `send_validity_alerts()`
  cron job as samples (was sample-only, fixed).

**Admin platform**
- Team & Buyers: user CRUD (create/edit/delete via edge functions),
  disable/enable toggle, last-login column, buyer CRUD, merchant-contacts
  assignment.
- Custom role: creatable/editable with a 6-toggle permission set (View
  All Buyers, Manage Users, View Movements, Export Data, Manage Samples,
  Manage Panels) — see the Permissions gap below for what's actually
  enforced.
- Halls CRUD, Feedback inbox, full Notifications list page, Audit Log
  viewer, Settings (sender identity fields, notification-prefs storage,
  API-key configured/not-configured status badges, Vercel deploy-hook
  URL + trigger button, Clear Test Data).
- Excel export (samples/movements, styled — logo, header row, alternating
  rows, print-ready) from Admin Reports, Hall Movements, and Merchant
  Export pages.
- Dashboards (all 6 role×module combinations): animated stat-card
  counters, click-through to filtered lists, time-of-day greeting,
  Recharts bar/pie breakdowns.

**Notifications**
- Central `sendNotification()` entry point, 16 event types, email
  (Resend) + in-app bell + Web Push (unencrypted empty-body) on every
  type except `feedback` (email only).

## Pending

**Permissions enforcement gap** — `core/permissions/index.js`'s
`hasPermission()`/`PERMISSIONS` map is defined but not imported or called
anywhere in the frontend. Real custom-role enforcement currently happens
two other ways that don't fully agree with each other: `Sidebar.jsx`'s
own hand-rolled `customPermissions[key]` checks (nav visibility only),
and the database's `has_custom_permission()` RLS policies (wired into
`buyers_select`/`samples_select`/`movements_select`/`panels_select`/
`panel_movements_select` only). Concretely missing:
- `manage_users` and `export_data` toggles have **zero** enforcement
  consumer anywhere (they render as checkboxes in Create/Edit User and do
  nothing else).
- No page or button actually calls `hasPermission()` to gate an action —
  the fixed roles' write permissions are enforced by RLS alone (which is
  correct and sufficient security-wise), but the frontend doesn't use the
  `PERMISSIONS` map to hide/disable buttons a role can't use, so a
  hall_manager or merchant can still see (and get an RLS rejection from)
  action buttons that will never succeed for them in a few spots.

**WhatsApp** — `sendWhatsApp()` is an explicit no-op stub in
`send-notification/index.ts`. Needs: a WhatsApp Business API account,
credentials as Edge Function secrets, and the actual send call
implemented (the call site and message-building shape are ready).

**Realtime** — nothing in the app uses Supabase Realtime; the
notification bell polls every 45s instead of subscribing. Fine at
current scale, worth revisiting if notification volume grows.

**Panel "In Transit" display refinement** — samples get a display-only
`in_transit` status (distinct amber badge) when a movement's active leg
is its 2nd+ hop; panels don't have the equivalent refinement in
`getPanelDisplayStatus()` yet, even though `forward_panel()` and
`ForwardPanelModal.jsx` both already exist and work — it's purely the
badge-label nuance that's missing, not the underlying forwarding
functionality.

**pg_cron setup step** — `send_validity_alerts()`'s daily 9am job depends
on `app.settings.supabase_anon_key` being set manually per-project
(`alter database postgres set app.settings.supabase_anon_key = '...'`)
— not part of the idempotent `schema.sql` run, easy to forget on a fresh
project setup and fails silently (in-app notification still gets
written, just no email/push) if skipped.

**Deploy hook** — the Settings page's "Trigger Redeploy" button is real
and functional but requires an admin to manually paste in a Vercel
deploy-hook URL first (Vercel Project Settings → Git → Deploy Hooks) —
there's no automated setup for this.

**Testing coverage** — no automated test suite exists (no
Jest/Vitest/Playwright config found). Verification is `npm run build` +
manual QA only.
