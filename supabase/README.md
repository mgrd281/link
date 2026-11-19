# Supabase (EU · Frankfurt)

The database for real accounts (ADR 0030). Without Supabase settings the web app keeps running in
demo mode (everything in the browser), so nothing here is needed to work on the UI.

| Path | What it is |
|---|---|
| `config.toml` | Local stack settings: auth URLs, email confirmation on, passwords ≥ 8 characters |
| `migrations/` | The schema. Every table enables row-level security in the same migration |
| `tests/` | pgTAP tests, run as each kind of caller (customer, visitor, server, owner, viewer) |

## Run it locally

Needs Docker. From the repository root:

```bash
pnpm db:start   # Postgres, Auth, REST and Mailpit (emails: http://127.0.0.1:54324)
pnpm db:reset   # recreate the database from migrations/
pnpm db:test    # pgTAP: access rules and team functions
pnpm db:lint    # plpgsql_check over every function
pnpm db:stop
```

`db:start` prints the local URL and keys. Put them in `apps/web/.env.local` to run the app
against the local database. They are the standard local demo keys, not secrets.

## Tables

| Table | Holds | Who reads | Who writes |
|---|---|---|---|
| `profiles` | username, language, status, badge | the owner | sign-up trigger; owner (language only); team functions |
| `sites` | the page, look and settings (one JSON document) | the owner; visitors through `public_page()` | the owner, while active |
| `site_versions` | up to 30 earlier versions | the owner | trigger |
| `sign_ins` | sign-ins and failed attempts, 30 days | the owner; team with `security.view` | our server only (`record_sign_in`) |
| `blocked_ips` | blocked addresses | team with `security.view` | team functions |
| `subscriptions`, `invoices` | plan, status, payments | the owner; team with `billing.view` | team functions (Stripe later) |
| `customer_notes` | the team's notes | team with `customers.view` | team functions |
| `team_members`, `role_permissions` | who is on the team, what each role may do | team members | team functions; first owner: `make_owner()` |
| `audit_log` | every team action | team with `activity.view` | team functions |
| `reserved_usernames` | names nobody can take | functions only | migrations |

## First owner

After the first deploy, sign up on the site with your own email. Then run this once in the SQL
editor of the Supabase dashboard:

```sql
select public.make_owner('you@example.com');
```

From then on, the owner adds the rest of the team in the console.
