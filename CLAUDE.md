# BASANT MCSP — Claude Code Context

## What is this?
BASANT MCSP is a signed sample and counter panel management platform for a
furniture manufacturing company. Built with React 19 + Vite + Supabase
(Postgres + Auth + Storage + Edge Functions) + Vercel + Resend. Desktop-only
(1280px+, no mobile layout). Four roles — Admin, Manager (hall_manager),
Merchant, and a permission-configurable Custom role — share one codebase
split into two parallel modules: **MCS** (samples) and **MCP** (panels).

## Read before every session
- `docs/architecture.md` — folder structure, tech decisions, routing, auth
- `docs/database.md` — every table, column, RLS policy, RPC
- `docs/workflows.md` — complete user workflows per role
- `docs/design-system.md` — colors, typography, component patterns
- `docs/api.md` — edge functions, notification service
- `docs/roadmap.md` — what is built, what is pending

## Rules
- Never break existing Supabase logic or RLS policies
- Always run `npm run build` after changes
- Push to GitHub when done
- Update the relevant doc file after building any feature
- Desktop only — no mobile responsive code
- All notifications go through `src/core/notifications/`
- All permissions checked via `src/core/permissions/`
