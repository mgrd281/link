---
name: linkyo-supabase
description: Work on Linkyo's real accounts and database (Supabase, Frankfurt). Use when changing tables, row-level security, team-console functions, sign-up/sign-in/email flows, the SupabaseAccountStore, or when a change must work both in demo mode and with real accounts. Covers migrations, pgTAP tests, generated types and the local stack.
---

# Linkyo on Supabase

Real accounts switch on when `NEXT_PUBLIC_SUPABASE_URL` and a publishable key are set; without
them the demo store runs. Both must keep working (ADR 0030).

## Map

| What | Where |
|---|---|
| Schema, RLS, functions | `supabase/migrations/*.sql`: core (profiles, sites, history, public_page), security (sign_ins, blocked_ips, retention), team (roles, audit, billing, notes, `admin_*` functions) |
| DB tests (pgTAP) | `supabase/tests/access.test.sql`, run as customer, visitor, server, owner and viewer |
| Email templates | `supabase/templates/*.html` (de/en/ar by `.Data.locale`), wired in `supabase/config.toml` |
| Clients | `apps/web/src/lib/supabase/{config,browser,server,json}.ts`, `database.types.ts` (generated) |
| Server routes | `app/api/auth/{sign-up,log-in,confirm}` + `features/account/server/auth.ts` |
| Store | `features/account/supabase-store.ts` (same contract as `local-store.ts`) |
| Console | `features/admin/{live,actions}.ts`; screens call `useConsoleActions()`, never `overrides` directly |
| E2E (real) | `apps/web/e2e/supabase.spec.ts` (skipped unless `E2E_SUPABASE=1`) |
| Founder setup | `docs/SUPABASE_SETUP.md` |

## Rules

- **RLS in the same migration** as the table. No table without policies or an explicit "functions
  only" note.
- **Functions that bypass RLS** are `security definer set search_path = ''`, name every object
  with its schema, check the caller first, and get an explicit `revoke … from public, anon` plus
  a `grant` to the role that may call them.
- **Team actions** go through one `admin_*` function each:
  - `perform public.require_permission('…')` first;
  - `perform public.audit(…)` after the change.
  - Mirror any change to roles in `role_permissions` and in `features/admin/types.ts`; the
    pgTAP role-count test catches drift.
- **The badge and the username on a page** come from `profiles` (the `sites_guard` trigger).
  Never trust page JSON for them.
- **The secret key only in server routes** (`serviceSupabase()`), never `NEXT_PUBLIC_`.
- **Optional function arguments get `default null`**, so generated types make them optional.
- **Not deployed yet?** Migrations may still be edited in place. Once production has them, add
  a new migration instead.

## Workflow

```bash
pnpm db:start        # local stack (Docker): Postgres, Auth, REST, Mailpit on :54324
pnpm db:reset        # apply migrations from scratch
pnpm db:test         # pgTAP
pnpm db:lint         # plpgsql_check (catches ambiguous names before they crash at runtime)
pnpm db:types        # regenerate apps/web/src/lib/supabase/database.types.ts
```

Real-account e2e: build and start the app with the local keys printed by `db:start`, then run
`E2E_SUPABASE=1 SUPABASE_SECRET_KEY=… pnpm exec playwright test e2e/supabase.spec.ts --project desktop`.
Afterwards rebuild without the keys before running the regular (demo) suite.

In cloud sessions Docker may need starting first (`dockerd &`). Images come from
public.ecr.aws.
