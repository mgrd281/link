# Turning on real accounts (Supabase, Frankfurt)

What has to happen once, in order. Steps that need payment or accounts are the founder's; the rest
can be done by Claude with an access token given through the secure form, never in a chat.

## Where we are (2026-11-22)

| Step | State |
|---|---|
| 1. Project | **Done.** The real project exists in **Central EU (Frankfurt)**, on Supabase's Free plan for now. |
| 3. Schema | **Done.** All eight migrations (below) were applied with the Management API on 2026-11-22. |
| 4. Auth e-mails | **Blocked.** Sign-in needs our code e-mails, and those need **custom SMTP**: on the Free plan the e-mail templates cannot be edited while the default mailer is used, and the default mailer only reaches the project's team. Custom SMTP needs a sending **domain**, which the founder has not chosen yet. |
| 2. Keys into Vercel | **Not done, on purpose.** Connecting the project switches the live deployment from demo to real accounts; without working sign-in e-mails nobody could sign up. It waits for step 4. |
| 5–6. First owner, deploy | Wait for step 2. |

Until then the live deployment stays in demo mode (no Supabase keys), and v7 phase 1 is tested only
against the local stack (`pnpm db:start`): AI and Stripe go to local mocks, no e-mail leaves the
machine ([ADR 0067](DECISIONS/0067-going-live.md)).

## 1. The project (founder) — done

1. https://supabase.com/dashboard: sign up with the company email and turn on two-factor sign-in.
2. Create an organization. Free works for setting up; move to **Pro** ($25/month, includes the first
   project's compute) before real customers (backups, no pausing).
3. New project:
   - name `linkyo`;
   - region **Central EU (Frankfurt)**, which can't be changed later;
   - a strong database password, kept in a password manager.

## 2. Keys into Vercel (founder) — after step 4

Pick one:

- **Recommended:** in Vercel, go to the project, then Integrations, then Supabase, and connect the
  existing project. The keys are synced into the project's environment variables automatically.
- Or add them by hand, in Vercel → project → Settings → Environment Variables (Production and
  Preview):

| Variable | Where in Supabase | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → URL | yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → publishable | yes (works only within RLS) |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → secret | **no**: server only, never `NEXT_PUBLIC_` |
| `LINKYO_ADMIN_CODE_SHA256` | (ours) SHA-256 of the team code | **no**. Required: with real accounts on and this unset, the team code fails closed |

The app also accepts the integration's names (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`).

Setting the keys turns on real accounts **and** the public creator pages (`/<username>`). It does
not turn on payments or AI: those need `NEXT_PUBLIC_PAYMENTS`, `AI_ENABLED` and their keys
(`.env.example`), which phase 1 never sets on Vercel. `NEXT_PUBLIC_PAYMENTS=live` fails the build
unless the company data in `apps/web/src/features/legal/company.ts` is complete and
`LEGAL_REVIEWED=1`.

The launch build sets `LAUNCH=1` on the Vercel project (Production): it fails while a legal text
still has a bracketed marker, the company data is missing or `LEGAL_REVIEWED` is not `1` (ADR
0074). `LAUNCH`, `LEGAL_REVIEWED` and `EMAIL_TRANSPORT` are read while building, so they are
declared under `tasks.build.env` in `turbo.json`: Turborepo's strict env mode hands a build only the
variables declared there (and `NEXT_PUBLIC_*`). A new variable read at build time goes there too
(`features/legal/build-env.test.ts` checks it).

## 3. Schema — done

The migrations in `supabase/migrations/`, in order:

1. `20261119100000_core.sql` (profiles, sites, history, `public_page`);
2. `20261119100100_security.sql` (sign-ins, blocked IPs, retention, `pg_cron`);
3. `20261119100200_team.sql` (roles, audit, billing, notes, `admin_*` functions);
4. `20261121120000_referrals.sql` (the invite program, ADR 0064);
5. `20261123100000_public_pages.sql` (block filter for public pages, reserved names);
6. `20261123100100_media.sql` (Storage buckets and policies, `storage_purge`);
7. `20261123100200_billing.sql` (entitlements, orders, proposals, withdrawals, cancellations);
8. `20261123100300_ai.sql` (AI settings, runs, budget, usage).

Applied either with `npx supabase@2.122.1 link --project-ref <ref>` and
`npx supabase@2.122.1 db push`, or with the Management API
(`POST /v1/projects/<ref>/database/query`, one file at a time; this is how they were applied). A
migration that production has is never edited again: changes go into a new migration. Then
`pnpm db:test` can run against a branch or staging copy.

### Scheduled jobs (6)

The migrations schedule six jobs with pg_cron (enabled by the security migration); check them under
Database → Cron Jobs, or with `select jobname, schedule from cron.job;`:

| Job | When (UTC) | What |
|---|---|---|
| `linkyo-purge-sign-ins` | daily 03:17 | deletes sign-ins older than 30 days |
| `linkyo-purge-unconfirmed` | daily 03:27 | deletes sign-ups nobody confirmed within 7 days |
| `linkyo-settle-referrals` | hourly at :41 | the invite program (ADR 0064): settles invites the sign-in routes missed, and gives rewards an inviter reached while suspended |
| `linkyo-purge-form-limits` | daily 03:37 | deletes the withdrawal and cancellation form counters older than 1 day |
| `linkyo-service-maintenance` | daily 03:47 | completes delivered orders after 14 days, queues briefing photos for deletion and clears briefing text 30 days after an order ends, deletes withdrawal and cancellation records after 3 years |
| `linkyo-ai-cleanup` | every 5 minutes | fails AI runs stuck for 10 minutes and releases their budget, drops drafts after 7 days and the run log after 30 days, budget days after 90 |

### Storage buckets

The media migration creates three buckets with their policies (no dashboard step):

| Bucket | Public | Limit | For |
|---|---|---|---|
| `media` | yes | 5 MB; JPEG, WebP, PNG | page pictures, `media/<uid>/<yyyy>/<uuid>.<ext>` |
| `briefing` | no | 10 MB; JPEG, WebP, PNG, HEIC | photos a customer sends with an order |
| `deliverables` | no | 10 MB; JPEG, WebP, PNG | Premium story pictures |

Pictures are shown through the app's image optimizer (`/_next/image`); `next.config.ts` allows the
project's `/storage/v1/object/public/media/**` path from `NEXT_PUBLIC_SUPABASE_URL`.

**Files are deleted only through the Storage API**, never with SQL. SQL puts what should go into
`public.storage_purge`; `POST /api/maintenance/storage-purge` drains it. The route answers 404
unless `MAINTENANCE_SECRET` is set (server only, a long random value) and the request carries
`Authorization: Bearer <MAINTENANCE_SECRET>`. Phase 1 has no scheduler for it: at go-live, add a
daily Vercel Cron that calls it with the secret. Deleting an account removes its three folders at
once and queues only what failed.

### Other settings

The invite program needs no setting of its own. Invite links use `NEXT_PUBLIC_SITE_URL` when it is
set, otherwise the address the app is served from; set it once `linkyo.app` is live. The throwaway
domains the checks refuse are in `public.disposable_domains` (48 seeded); the team adds more with
SQL (`insert into public.disposable_domains values ('example.org');`).

The local stack raises the Auth rate limits (`sign_in_sign_ups`, `token_verifications` = 1000 in
`supabase/config.toml`) for the real-mode test suites. The hosted project keeps the limits set in
its dashboard.

## 4. Auth settings — waits for the domain

In Authentication → URL Configuration, or with `PATCH /v1/projects/<ref>/config/auth`:

- **Site URL:** the production address (today `https://link-web-one.vercel.app`, later the chosen
  domain).
- **Redirect URLs:** `https://link-web-one.vercel.app/**` (and the chosen domain's `/**` later).
- **Email (sign-in is a 6-digit code, no passwords, ADR 0035):**
  - email provider on, confirm email on;
  - secure email change on;
  - email OTP length 6, OTP expiry 600 seconds (10 minutes);
  - minimum interval between emails per user: 30 seconds (the app offers a new code after 30 s).
- **SMTP (first):** the built-in mailer sends only to the project's team, a few e-mails per hour,
  and on the Free plan it does not allow template edits. Set up custom SMTP with Scaleway TEM
  (`docs/SETUP_ACCOUNTS.md` row 5):
  1. the founder chooses the domain;
  2. verify it in Scaleway TEM (SPF, DKIM, DMARC, MX);
  3. Authentication → SMTP: host `smtp.tem.scaleway.com`, port 587 (STARTTLS), user = the Scaleway
     project ID, password = the secret key of an IAM API key, sender on the domain;
  4. raise the Auth e-mail rate limit (custom SMTP starts at 30 per hour).
- **Templates (after SMTP):** the three files in `supabase/templates/`, with the subjects from
  `supabase/config.toml`:
  - Confirm signup: `confirmation.html` (new accounts: the code and a one-click link);
  - Magic Link: `magic_link.html` (returning accounts: the same);
  - Change Email Address: `email_change.html`.

## 5. First owner

Sign up on the site with your own email and confirm it. Then, once, in the SQL editor:

```sql
select public.make_owner('you@example.com');
```

Everyone else is added in the console (Team), after they have signed up.

## 6. Deploy and check

Redeploy on Vercel (environment variables apply to new deployments). Then check:

- sign up, the email arrives, and the link opens the welcome flow;
- the page saves, and a picture uploaded in the editor is served from `/_next/image`;
- the page is public at `/<username>` once the welcome flow is finished;
- sign out, then sign in, and Settings → Recent sign-ins shows the device;
- `/admin` opens for the owner and shows the account under Customers and Security;
- an invite link (`/i/<code>`, the code is in `profiles.referral_code`) opened in a private
  window leads to the sign-up with "You were invited to Linkyo" (or the inviter's page name), and
  after the code is entered `select state from public.referrals order by created_at desc limit 1;`
  says `qualified`;
- `select jobname from cron.job;` lists the six jobs above.
