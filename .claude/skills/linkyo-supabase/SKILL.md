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
| Schema, RLS, functions | `supabase/migrations/*.sql`: core (profiles, sites, history, public_page), security (sign_ins, blocked_ips, retention), team (roles, audit, billing, notes, `admin_*` functions), referrals (the invite program, ADR 0064: codes, `referrals`, `rewards`, `verification_requests`, `settle_referral`, hourly cron); v7: `public_pages` (`block_is_public`, the filtered `public_page`, reserved names), `media` (Storage buckets `media`/`briefing`/`deliverables`, their policies, `storage_purge`), `billing` (entitlements, orders, proposals, checkout intents, Stripe events, withdrawals, cancellations, `has_pro`, two daily jobs; ADR 0066), `ai` (settings, runs, budget, usage, `ai_reserve_run`/`ai_settle_run`, 5-minute cleanup; ADR 0065); after the v7 review: `review_fixes` (`legal_is_complete`, the stricter `public_page`, `has_pro`, `record_refund`) and `team_fixes` (`admin_refund_order`, `settle_withdrawal`, the withdrawal and cancellation decisions, `team_may_upload_for`, `story_handed_to_me` and their Storage policies) |
| Notice and action | `20261128100000_reports.sql`: `reports`, `moderation_decisions`, `submit_report` (service role only), `admin_reports`, `admin_moderation_target`, `admin_moderate`, `admin_lift_moderation`, `admin_moderation_counts`, `my_moderation`, `moderation_digest`, the nightly `moderation_purge` (reporters' details after 180 days); `public_page()` without restricted content; tests `reports.test.sql` |
| DB tests (pgTAP) | `supabase/tests/access.test.sql`, run as customer, visitor, server, owner and viewer; `supabase/tests/referrals.test.sql` (codes, sign-up attribution, the abuse checks, counting, rewards, verification, team writes, privacy); one file per v7 migration: `public_pages.test.sql`, `media.test.sql`, `billing.test.sql`, `ai.test.sql` |
| Storage (v7, ADR 0067) | `features/app/media-upload.ts` (`uploadToBucket`, `storePreparedImage`), `features/account/media-migrate.ts` (data URLs → Storage on save), `lib/server/storage-purge.ts` (`removePrefix`, `drainStoragePurge`), `app/api/maintenance/storage-purge`, `app/api/account/delete`, `app/api/admin/customers/[id]/delete` |
| Server helpers (v7) | `lib/server/user.ts` (`requireUser`: RPCs as the user, so SQL enforces team permissions), `lib/server/ip-hash.ts` (daily-salted HMAC) |
| Public pages (v7) | `features/creator/public-page.ts`, `app/u/[username]/*`, `lib/creator-path.ts`, `proxy.ts` |
| Real-mode e2e helpers | `apps/web/e2e/real.ts` (per-test IP and mock tag, `createRealAccount`, `signIn` without e-mail, `grantPro`, `addTeamMember`, `readCapturedMail`, `setAiEnabled`) |
| Email templates | `supabase/templates/{confirmation,magic_link,email_change}.html` (de/en/ar by `.Data.locale`; the first two carry the 6-digit `{{ .Token }}` and the one-click link), wired in `supabase/config.toml` |
| Clients | `apps/web/src/lib/supabase/{config,browser,server,json}.ts`, `database.types.ts` (generated) |
| Server routes | `app/api/auth/code` (sends the code; checks sign-ups), `app/api/auth/verify` (code → session, security log, first page), `app/api/auth/confirm` (the emailed link) + `features/account/server/{auth,first-site}.ts` |
| Store | `features/account/supabase-store.ts` (same contract as `local-store.ts`) |
| Console | `features/admin/{live,actions}.ts`; screens call `useConsoleActions()`, never `overrides` directly |
| E2E (real) | `apps/web/e2e/supabase.spec.ts` (skipped unless `E2E_SUPABASE=1`) |
| Founder setup | `docs/SUPABASE_SETUP.md` |

## Sign-in is a code, never a password (ADR 0035)

- `requestCode` → `/api/auth/code` → `signInWithOtp` (new accounts with `{ username, locale, invite, start }`
  as metadata; the `handle_new_user` trigger checks the name). Same answer whether or not the
  address has an account.
- `verifyCode` → `/api/auth/verify` → `verifyOtp({ type: "email" })`, then `ensureFirstSite` (the
  prepared page or a starter, from the metadata) and the security log.
- The demo store mirrors this: the code comes back as `demoCode` and is shown on screen.
- Real-account e2e reads codes from Mailpit (`clearMail` before asking, `mail()` to wait).

## Invite program (ADR 0064)

- **The word is "referral" in code, data and URLs** (`?ref=`, `referrals`, `features/referrals/*`).
  "invite" already means the team's prepared-page invite (`?invite=`, `SignUpInput.invite`,
  `invites.manage`, ADR 0015). Never mix them: `findPrepared()` reads `invite`, `handle_new_user`
  reads `ref`.
- **Sign-up:** `/i/<code>` → 307 to `/<locale>/signup?ref=<code>` (no cookie). The sign-up page
  sends any well-formed `ref` (the `referral_inviter` lookup only shows the "invited by" line);
  `/api/auth/code` drops a malformed one, puts it in the user metadata and in the emailed link
  (`/api/auth/confirm?…&ref=`); `handle_new_user` writes a `pending` referral for a new account only.
- **Settling:** after `recordSignIn` in `/api/auth/verify` (the code step sends `signUp.ref`) and in
  `/api/auth/confirm` (the link's `ref`; not for an email change), `settleReferral(service, id, ref)`
  (`features/account/server/referrals.ts`) calls `settle_referral(invitee, ref)`. **The confirming
  browser must carry the pending row's code**: without it, or with another one, the row is dropped
  (`'dropped'`), so nobody attaches their code to someone else's address by asking for its sign-up
  code first. It never throws and never fails a sign-in; the hourly `linkyo-settle-referrals` job
  drops pending rows confirmed over 15 minutes ago (no browser showed the code), clears
  `referrals.network` after `cluster_days` and gives rewards owed to inviters active again.
- **Checks** (`settle_referral`, in order): `self` (same `email_identity`), `repeat` (the same
  mailbox already has a row of this inviter: `referrals.mailbox_hash`, sha256 hex of
  `email_identity`, kept after the invitee is deleted), `sameDevice`, `disposable`,
  `inviteeSuspended` → rejected; `noSignals`, `sameNetwork` (network **and** signature), `cluster`
  (3rd from one network within 7 days, read from `referrals.network`, not the deleted invitees'
  sign-ins) → held. A suspended invitee that is deleted takes its row along (`referrals_forget`).
- **`rewards`**: customers may select only `profile_id, kind, source, granted_at, revoked_at`;
  `revoked_by` and `revoke_reason` are the team's (via `admin_customer_referrals`).
- **Rewards are not subscriptions.** `grant_referral_rewards()` writes `rewards` at
  `referral_rule('verification_at')` and `('pro_for_life_at')`. Nothing in the program writes
  `subscriptions` or `invoices`. A removed reward is never given again automatically.
- **The numbers live in `features/referrals/rules.ts`;** `referral_rule()` mirrors them and
  `rules.test.ts` reads the migration to compare.
- **Customers read only through functions** (`my_referrals`, `my_verification_requests`,
  `referral_inviter`, `request_verification`); the team through `admin_customer_referrals`,
  `admin_referral_queue`, `admin_set_referral`, `admin_set_reward`, `admin_review_verification`
  (`features/referrals/team.ts`). Both stores implement the same contract; the demo applies the
  self and repeat checks only, and its `teamReview` refuses the signed-in account's own request.

## Rules

- **RLS in the same migration** as the table. No table without policies or an explicit "functions
  only" note.
- **Functions that bypass RLS** are `security definer set search_path = ''`, name every object
  with its schema, check the caller first, and get an explicit `revoke … from public, anon` plus
  a `grant` to the role that may call them.
- **Team actions** go through one `admin_*` function each:
  - `perform public.require_permission('…')` first;
  - `perform public.audit(…)` after the change. A team action that moves money is recorded as the
    member **before** the route calls Stripe (`admin_refund_order`, `admin_resolve_withdrawal`).
  - Lock the contract first (order or entitlement), then the declaration: `record_refund` and the
    withdrawal functions take them in that order.
  - Mirror any change to roles in `role_permissions` and in `features/admin/types.ts`; the
    pgTAP role-count test catches drift.
- **The badge and the username on a page** come from `profiles` (the `sites_guard` trigger).
  Never trust page JSON for them.
- **The secret key only in server routes** (`serviceSupabase()`), never `NEXT_PUBLIC_`.
- **Optional function arguments get `default null`**, so generated types make them optional.
- **Production has the migrations now.** The real project (Central EU, Frankfurt) got the first
  eight migrations through the Management API on 2026-11-22; `20261123100400_review_fixes.sql` and
  `20261123100500_team_fixes.sql` are local only until the founder says go. **Never edit a migration
  in place any more**: every change is a new migration. The project is not connected to Vercel yet (Auth e-mails
  need custom SMTP, which needs a domain; `docs/SUPABASE_SETUP.md`). Never run anything against the
  hosted project without the founder's go-ahead.
- **Files are deleted only through the Storage API.** SQL never deletes from `storage.objects`;
  queue a folder or object in `public.storage_purge` (service only) and let
  `/api/maintenance/storage-purge` (bearer `MAINTENANCE_SECRET`) or the account-deletion routes
  remove it with `removePrefix`. Paths always start with the owner's account id
  (`media/<uid>/…`, `briefing/<uid>/<order>/…`, `deliverables/<customer>/<order>/…`), which is what
  the policies check.
- **A proposal's pictures are the customer's.** The team's proposal editor uploads page pictures
  into `media/<customer>/…` (`MediaOwnerProvider`, policy "media insert team for a customer's
  order"), never into the team member's folder: they are purged with the customer's account and
  stay when the member leaves. A customer reads only the story pictures of proposals that were
  handed over (`story_handed_to_me`); a story picture taken out of a draft is deleted through the
  Storage API unless a delivered round still lists it (`storyRemovable`).
- **Service-only tables** (`storage_purge`, `stripe_events`, `checkout_intents`, `ai_settings`,
  `ai_budget_days`, `ai_usage`, `form_limits`, `service_settings`) have RLS on, no policy and
  `revoke all` from `authenticated` and `anon`. Billing and AI tables revoke insert, update and
  delete from everyone but the service role: writes go through functions.
- **Mirrored numbers:** `ai_settings` ↔ `features/ai/limits.ts`, `RESERVED_USERNAMES` ↔ the
  `reserved_usernames` inserts, `referral_rule()` ↔ `features/referrals/rules.ts`,
  `legal_is_complete()` ↔ `missingLegalFields()` in `features/app/legal.ts`. Each pair has a
  test that reads the migrations; change both sides together.
- **"Today" and "this month" are Europe/Berlin** (`(now() at time zone 'Europe/Berlin')::date`).

## Workflow

```bash
pnpm db:start        # local stack (Docker): Postgres, Auth, REST, Storage, Mailpit on :54324
pnpm db:reset        # apply migrations from scratch
pnpm db:test         # pgTAP
pnpm db:lint         # plpgsql_check (catches ambiguous names before they crash at runtime)
pnpm db:types        # regenerate apps/web/src/lib/supabase/database.types.ts
```

- **Storage now runs locally:** `db:start` no longer excludes `storage-api` (the bucket policies and
  uploads need it). `next.config.ts` allows the local `127.0.0.1:54321` Storage URL through
  `/_next/image` (`dangerouslyAllowLocalIP` only for a loopback Supabase URL).
- **Raised local Auth rate limits:** `supabase/config.toml` sets `sign_in_sign_ups = 1000` and
  `token_verifications = 1000` under `[auth.rate_limit]`, because the real-mode suites sign in far
  more than 30 accounts per 5 minutes from one address. The hosted project keeps its dashboard
  limits.
- Only one local stack runs per machine: when several worktrees work in parallel, only one of them
  may run `db:*` commands at a time.

Real-account e2e: build and start the app with the local keys printed by `db:start`, then run
`E2E_SUPABASE=1 SUPABASE_SECRET_KEY=… pnpm exec playwright test e2e/supabase.spec.ts --project desktop`.
The v7 real-mode suites (`@real`, `@global`) need more variables and the mocks: see the
`linkyo-qa-release` skill. Afterwards rebuild without the keys before running the regular (demo)
suite.

In cloud sessions Docker may need starting first (`dockerd &`). Images come from
public.ecr.aws.
