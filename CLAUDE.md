# BASANT SSM — Architecture Reference

This file orients future Claude Code sessions (and humans) working in this
repo. Read it before making structural changes.

## What this is

BASANT SSM (Signed Sample Management) is a multi-tenant web app for
tracking physical product samples ("BT codes") that move in and out of
BASANT's exhibition halls. **Module 1 (MCS — Master Counter Sample)** is
what's built here. A future **Module 2 (MCP — Master Counter Panel)** is
meant to plug in beside it without touching MCS code — see
[Module boundary](#module-boundary-mcs-vs-mcp) below.

Three roles, three separate app experiences, one codebase:

- **Admin** (role `super_admin` in the DB) — full visibility, manages buyers/halls/users.
- **Manager** (role `hall_manager` in the DB) — scoped to one hall; adds
  samples, issues/returns them.
- **Merchant** — scoped to one buyer, read-only + comments/recalls/export.

Role *display* labels ("Admin", "Manager") live in `ROLE_LABELS`
(`shared/utils/constants.js`) and are intentionally shorter than the DB
`role` values (`super_admin`, `hall_manager`) — never rename the DB
values to match, always go through `ROLE_LABELS`.

## Tech stack

| Layer     | Choice                                              |
|-----------|------------------------------------------------------|
| Frontend  | React 19 + Vite + React Router v6                    |
| Styling   | Tailwind CSS v3 (custom design tokens, no UI kit)     |
| Backend   | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Email     | Resend, called only from an Edge Function             |
| Hosting   | Vercel (frontend) + Supabase (backend)                |

## Folder structure

```
src/
  App.jsx                  Route tree (all roles), providers
  main.jsx                 Entry point
  index.css                Tailwind directives + design-token base styles
  pages/                   Routes with no role: Login, NotFound
  shared/                  Everything role-agnostic and module-agnostic
    components/            UI kit: Button, Input, Modal, Table, Toast, ...
    context/                AuthContext, ToastContext
    hooks/                  useAsyncData, useTableControls
    layouts/                Sidebar, Topbar, DashboardLayout (generic shell)
    lib/                    supabaseClient, notify (edge fn caller), excelExport
    routes/                 ProtectedRoute (role-gated route guard)
    utils/                  constants.js (enums), formatters.js, cn.js
  modules/
    mcs/                    Module 1 — Master Counter Sample (this build)
      api/                  Data access: buyersApi, hallsApi, usersApi,
                             samplesApi, movementsApi, recallsApi, commentsApi
      components/           Cross-role MCS UI: SampleDetailDrawer (the
                             drawer every sample row opens, tabbed
                             Details/Movement History/Comments, with
                             role-gated Issue/Return/Raise Recall footer
                             actions), IssueSampleModal, SampleThumbnail,
                             ActivityFeed
      utils/                activity.js — merges movements+recalls into
                             one timestamp-sorted dashboard feed
      admin/                Admin: AdminLayout, pages/, components/
      hall/                 Manager: HallLayout, pages/, components/
      merchant/             Merchant: MerchantLayout, pages/, components/
                             (RaiseRecallModal lives here but is imported
                             by the shared SampleDetailDrawer too — fine,
                             it's a same-module cross-role import)
    mcp/                    Module 2 — not built yet (see below)
supabase/
  sql/schema.sql            Full DB schema, RLS, RPCs, storage — run once
  functions/
    send-notification/      All transactional email (Resend), service-role only
    create-user/             Admin-only user creation (Auth admin API)
```

**Rule of thumb for new code:** if it's generic UI/infra usable by any
future module, it goes in `shared/`. If it's specific to sample-tracking
business logic, it goes in `modules/mcs/`.

## Module boundary: MCS vs MCP

MCS was built so MCP (Module 2, not yet started) can be added later as a
peer, not a rewrite:

- **New folder, not a fork**: MCP gets `src/modules/mcp/` mirroring MCS's
  internal shape (`api/`, `admin/`, `hall/`, `merchant/` or whatever roles
  it needs). It does not modify anything under `modules/mcs/`.
- **Shared shell, separate nav**: `DashboardLayout` (`shared/layouts/`)
  takes a `navSections` array. Each role's `*Layout.jsx` in MCS builds its
  own sections. MCP's layout does the same and can either reuse an
  existing role's layout (adding a second nav section alongside MCS's) or
  register its own routes under the same `ProtectedRoute` role gates.
- **Same auth, same roles**: `AuthContext` and the `profiles` table are
  platform-wide, not MCS-specific. MCP reuses `useAuth()` as-is — no new
  auth system, no new roles table.
- **Own tables, own RLS**: MCP should get its own Postgres tables in a new
  `supabase/sql/mcp_schema.sql`, with its own RLS policies following the
  same `current_role()/current_hall_id()/current_buyer_id()` helper
  functions already defined in `schema.sql`. Don't alter MCS's tables to
  accommodate MCP.
- **Routes**: add `/admin/mcp/*`, `/hall/mcp/*`, `/merchant/mcp/*` (or
  whatever MCP's own top-level paths are) as new `<Route>` blocks in
  `App.jsx`, alongside the existing MCS blocks — see the comment above the
  Admin route block in `App.jsx` for the exact insertion point.

## Data model (see `supabase/sql/schema.sql` for the source of truth)

- `buyers` — companies whose samples get signed in.
- `halls` — the 5 physical halls (2, 5, 8, 10, 11), seeded once.
- `profiles` — one row per login, `id` = `auth.users.id`. `role` is
  `super_admin | hall_manager | merchant`. `hall_id` set for hall
  managers, `buyer_id` set for merchants.
- `samples` — one row per physical sample (`bt_code` unique). `status` is
  `in_hall | checked_out` (displayed in the UI as "In Hall" / "Issued" —
  see `SAMPLE_STATUS_LABELS` in `constants.js`; the DB value is untouched).
- `movements` — one row per checkout, updated in place on return
  (`status: out -> returned`, `returned_at` set). This is the audit trail.
- `merchant_contacts` — join table: which profiles receive email
  notifications for a given buyer. **Auto-populated** when a merchant user
  is created via the `create-user` edge function — admins never manage
  this by hand.
- `recall_requests` — merchant-raised requests to return a sample early.
- `sample_comments` — merchant comments on a sample, visible to admin/hall
  manager of that sample too.

### Why two RPC functions instead of direct table writes

`checkout_sample(...)` and `return_sample(...)` (both `SECURITY DEFINER`
Postgres functions in `schema.sql`) are the *only* way `samples.status`
and `movements` rows change. They:

1. Update `samples.status` and insert/update the `movements` row in one
   transaction, so the two can never drift out of sync.
2. Enforce hall-scoping themselves (`current_hall_id()` check), so no
   separate RLS `UPDATE` policy is needed on `samples`/`movements` for
   hall managers.

Frontend callers: `modules/mcs/api/movementsApi.js` → `issueSample()` /
`returnSample()`. (The JS function is named `issueSample` to match the
"Issue" terminology used in the UI; the underlying RPC is still named
`checkout_sample` in Postgres — deliberately not renamed, since renaming
a `SECURITY DEFINER` function means touching `schema.sql`.) Don't add
direct `.from('samples').update(...)` calls for status changes — go
through the RPCs.

### RLS model

Every table has RLS enabled. Scoping is driven by three `SECURITY DEFINER`
helper functions (`current_role()`, `current_hall_id()`,
`current_buyer_id()`) that read the caller's own `profiles` row — defined
`SECURITY DEFINER` specifically so policies on `profiles` don't recurse
into themselves. Admin policies check `is_super_admin()` and bypass
all scoping.

## Auth flow

1. `AuthProvider` (`shared/context/AuthContext.jsx`) wraps the app,
   listens to `supabase.auth.onAuthStateChange`, and loads the matching
   `profiles` row (with `hall`/`buyer` joined) whenever the session
   changes.
2. `ProtectedRoute` (`shared/routes/ProtectedRoute.jsx`) gates a route
   subtree: no session → `/login`; wrong role → redirected to *their own*
   home via `ROLE_HOME` (never stuck on an error page).
3. There is **no signup page** — admins create every account. Login reads
   `role` from `profiles` and `App.jsx`'s `RootRedirect` sends the user to
   `/admin`, `/hall`, or `/merchant` accordingly.

### Creating users (why it needs an Edge Function)

Supabase's `auth.admin.createUser()` requires the service-role key, which
must never reach the browser. `supabase/functions/create-user/` verifies
the caller is a `super_admin` (via their own JWT), creates the auth user
server-side, inserts the `profiles` row, and — if the new user is a
merchant — inserts them into `merchant_contacts` too. Frontend entry
point: `modules/mcs/api/usersApi.js` → `createUser()`.

## Email notifications

All three notification flows (checkout — 2 emails, return — 1 email,
recall — 1 email) live in `supabase/functions/send-notification/`. The
frontend never talks to Resend directly — `shared/lib/notify.js` calls
the edge function via `supabase.functions.invoke('send-notification', ...)`
and is **fire-and-forget**: a failed email must never fail or roll back a
checkout/return/recall that already succeeded in the database. If you add
a new email type, add a `case` in that function's `switch`, not a new
function.

`.env` / `.env.example` documents `VITE_RESEND_API_KEY` but no frontend
code reads it — it's a placeholder for the name only. The real key is set
as an Edge Function secret: `supabase secrets set RESEND_API_KEY=...`.

## Frontend data-fetching pattern

- `shared/hooks/useAsyncData(fetcher, deps)` — standard
  fetch/loading/error/reload wrapper used by every page. Returns
  `{ data, loading, error, reload, setData }`; `setData` is used for
  optimistic local updates after a create (e.g. append a new buyer to the
  list without refetching).
- `shared/hooks/useTableControls(rows, { searchFields, initialSort })` —
  client-side search + filter + sort + pagination (20 rows/page, see
  `PAGE_SIZE` in `constants.js`). Data volumes here are modest (RLS-scoped
  to one hall or one buyer), so fetching once and slicing in-memory is
  simpler than server-side pagination and keeps every table's behavior
  identical. If a table ever needs a date-range filter, pre-filter the
  rows array before passing it to the hook (see `Movements.jsx` for the
  pattern) rather than extending the hook's filter matcher.

## Design system

Tokens live in `tailwind.config.js` (colors, radii, shadows, font sizes)
and `src/index.css` (base styles, skeleton shimmer, fade/slide keyframes).
Key constraints carried over from the design brief — keep these when
adding UI:

- Font: Inter, weights 400/500/600 only (never bold).
- Spacing: stick to Tailwind's default scale values that land on the 8px
  grid — `2` (8px), `4` (16px), `6` (24px), `8` (32px), `10` (40px), `12`
  (48px). Don't reach for `3`, `5`, `7` etc. in layout spacing.
- No spinners for data loading — use `Skeleton` / `TableSkeleton` /
  `StatCardSkeleton` / `CardListSkeleton`.
- Toasts (bottom-right, 3s auto-dismiss) via `useToast()` from
  `shared/context/ToastContext.jsx` — call `.success()`, `.error()`, or
  `.info()`, never render a toast manually.
- `Logo` (`shared/components/Logo.jsx`) renders `public/logo-black.png`
  (light surfaces — sidebar) or `public/logo-white.png` (dark surfaces —
  login left panel). Both are the wordmark only, tagline trimmed off;
  render the "furniture I lighting I homedecor" tagline as separate
  styled text where needed (see `Login.jsx`).
  `PillTabs` (`shared/components/PillTabs.jsx`) is the segmented
  All/In&nbsp;Hall/Issued-style status filter used on every sample list —
  prefer it over a `<Select>` for any status-shaped filter.
- `Modal` and `Drawer` (`shared/components/`) both animate open *and*
  close (mount vs. visible are separate state, unmount is deferred by a
  `setTimeout` matching the CSS transition duration) — don't replace
  their conditional rendering with a plain `if (!open) return null`, that
  brings back the "vanishes instantly on close" bug.
- Buyer names are shortened for display only (`shortenBuyerName()` in
  `shared/utils/formatters.js`, e.g. "Maison du Monde (MDM)" → "MDM"),
  applied at the API boundary (`buyersApi`, `samplesApi`, `movementsApi`,
  `usersApi`, `AuthContext`) so every component that renders `buyer.name`
  gets the short form automatically — don't shorten again in components,
  and don't touch the DB value.

## Setup checklist (fresh Supabase project)

1. `cp .env.example .env`, fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
2. Run `supabase/sql/schema.sql` once in the Supabase SQL editor.
3. Deploy both edge functions and set the Resend secret:
   ```
   supabase functions deploy send-notification
   supabase functions deploy create-user
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
   `/admin/users` to create hall managers and merchants — everything
   after step 4 happens through the UI.
6. Deploying to Vercel: set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   as project env vars. Nothing Resend-related belongs in Vercel's env —
   that only lives in Supabase's edge function secrets.
