# Turning on real accounts (Supabase Pro, Frankfurt)

What has to happen once, in order. Steps 1–2 need the founder (payment and accounts); steps 3–6
can be done by Claude with an access token given through the secure form, never in a chat.

## 1. The project (founder)

1. https://supabase.com/dashboard: sign up with the company email and turn on two-factor sign-in.
2. Create an organization on the **Pro** plan ($25/month, includes the first project's compute).
3. New project:
   - name `linkyo`;
   - region **Central EU (Frankfurt)**, which can't be changed later;
   - a strong database password, kept in a password manager.

## 2. Keys into Vercel (founder)

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

The app also accepts the integration's names (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`).

## 3. Schema

The migrations in `supabase/migrations/`, in order. Either:

- `npx supabase@2.122.1 link --project-ref <ref>` then `npx supabase@2.122.1 db push`, or
- the Management API (`POST /v1/projects/<ref>/database/query`, one file at a time).

Then `pnpm db:test` can run against a branch or staging copy.

The migrations schedule three jobs with pg_cron (enabled by the security migration); check them
under Database → Cron Jobs, or with `select jobname, schedule from cron.job;`:

| Job | When | What |
|---|---|---|
| `linkyo-purge-sign-ins` | daily 03:17 | deletes sign-ins older than 30 days |
| `linkyo-purge-unconfirmed` | daily 03:27 | deletes sign-ups nobody confirmed within 7 days |
| `linkyo-settle-referrals` | hourly at :41 | the invite program (ADR 0064): settles invites the sign-in routes missed, and gives rewards an inviter reached while suspended |

The invite program needs no setting of its own. Invite links use `NEXT_PUBLIC_SITE_URL` when it is
set, otherwise the address the app is served from; set it once `linkyo.app` is live. The throwaway
domains the checks refuse are in `public.disposable_domains` (48 seeded); the team adds more with
SQL (`insert into public.disposable_domains values ('example.org');`).

## 4. Auth settings

In Authentication → URL Configuration, or with `PATCH /v1/projects/<ref>/config/auth`:

- **Site URL:** the production address (today `https://link-web-one.vercel.app`, later
  `https://linkyo.app`).
- **Redirect URLs:** `https://link-web-one.vercel.app/**` (and `https://linkyo.app/**` later).
- **Email (sign-in is a 6-digit code, no passwords, ADR 0035):**
  - email provider on, confirm email on;
  - secure email change on;
  - email OTP length 6, OTP expiry 600 seconds (10 minutes);
  - minimum interval between emails per user: 30 seconds (the app offers a new code after 30 s).
- **Templates:** the three files in `supabase/templates/`, with the subjects from
  `supabase/config.toml`:
  - Confirm signup: `confirmation.html` (new accounts: the code and a one-click link);
  - Magic Link: `magic_link.html` (returning accounts: the same);
  - Change Email Address: `email_change.html`.
- **SMTP:** the built-in mailer only sends a few test emails per hour. Before real sign-ups,
  set up custom SMTP (Scaleway TEM, docs/SETUP_ACCOUNTS.md row 5).

## 5. First owner

Sign up on the site with your own email and confirm it. Then, once, in the SQL editor:

```sql
select public.make_owner('you@example.com');
```

Everyone else is added in the console (Team), after they have signed up.

## 6. Deploy and check

Redeploy on Vercel (environment variables apply to new deployments). Then check:

- sign up, the email arrives, and the link opens the welcome flow;
- the page saves;
- sign out, then sign in, and Settings → Recent sign-ins shows the device;
- `/admin` opens for the owner and shows the account under Customers and Security;
- an invite link (`/i/<code>`, the code is in `profiles.referral_code`) opened in a private
  window leads to the sign-up with "You were invited to Linkyo" (or the inviter's page name), and
  after the code is entered `select state from public.referrals order by created_at desc limit 1;`
  says `qualified`.
