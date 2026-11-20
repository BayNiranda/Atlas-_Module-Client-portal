@AGENTS.md

# Atlas Advisory CEMS

Client Engagement Management System for Atlas Advisory: public site, client portal, staff admin.
Design: `docs/DESIGN.md` (source of truth for tables, roles, permission matrix, roadmap).

## Stack
Next.js 16 (App Router, `src/`, `proxy.ts` replaces middleware), TypeScript, Tailwind v4, Supabase (Postgres + RLS, Auth, Storage), Zod, Vitest. Hosting: Vercel (later).

## Working rules (owner-approved)
- Owner is learning programming: explain decisions in plain language.
- Before each module: mini-design (requirement, solution, tables, permissions, security risks, acceptance criteria), then wait for approval.
- One module at a time. After each: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`; report files changed, how to test, known limits.
- Never silently remove existing functionality.
- Never use real client information. Seed and test data are invented. The parent folder holds real client files: never read them into this app or commit them.
- No production deploy without explicit approval.

## Security rules
- Every table has RLS on. Clients reach rows only via `public.is_org_member(org_id)`; staff via `public.is_staff()` (requires MFA, aal2).
- Roles are read from tables (`profiles.staff_role`, `organization_members.role`), never from user-editable metadata.
- `SUPABASE_SERVICE_ROLE_KEY` is only used in `src/lib/supabase/admin.ts` (marked `server-only`).
- Server code re-checks permission before every change (`src/lib/auth/guards.ts`), even though RLS also enforces it.
- Database changes are new files in `supabase/migrations/`; never edit an applied migration.

## Environment
- Windows PowerShell blocks `npx.ps1`/`npm.ps1`: use `npx.cmd` / `npm.cmd` in the owner's terminal.
- Dev database: Supabase project `ffwedanozfenocaxumre` (Seoul region; fake data only). Apply migrations with `npx supabase db push --remote`. Production will be a separate project in Singapore.
- `npm test` runs RLS tests against the dev project; fixtures refuse to run unless `NEXT_PUBLIC_SITE_URL` is localhost.

## Layout
- `src/app/` routes: `(public)`, `login`, `auth/confirm`, `admin`, `portal`
- `src/modules/<topic>/` business modules (actions.ts, queries.ts, schema.ts)
- `src/lib/supabase/` clients (browser, server, admin) and session refresh
- `src/lib/auth/` guards
- `supabase/migrations/`, `supabase/seed.sql`, `tests/` (RLS isolation tests run against the dev project)
