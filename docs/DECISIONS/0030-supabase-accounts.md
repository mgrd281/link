# 0030 — Real accounts on Supabase (Frankfurt), switched on by configuration

**Context.** The founder chose Supabase Pro ("the full version, not a free one") so that accounts,
pages and the team console work on real data with real enforcement. Phase 0 kept everything in
the browser behind one `AccountStore` contract (ADR 0014) and planned Postgres with row-level
security (ARCHITECTURE §4, ADR 0010).

**Decision.**

- **One switch.** With `NEXT_PUBLIC_SUPABASE_URL` and a publishable key, the app uses
  `SupabaseAccountStore`; without them, the demo stays.
  - Screens did not change; the contract became async where a server is involved (username
    check, email/username change, export, delete, sign-in log).
  - Demo notes disappear with real accounts.
- **The page is one JSON document per account** (`sites`): exactly the `Site` the editor edits.
  - It is saved in the background: debounced, retried with backoff, sent with `keepalive` when
    the tab goes away, and shown next to "Saved".
  - Splitting blocks into rows waits for realtime editing on iOS (Phase 2).
- **Sign-up and sign-in run on our server** (`/api/auth/sign-up`, `/api/auth/log-in`).
  - Blocked addresses, suspended accounts and password guessing (8 failures in 15 minutes) are
    refused there.
  - Every attempt is written to the 30-day security log with the address, the place (Vercel
    headers) and the device.
  - The browser then adopts the session.
  - The server re-checks names and passwords, and decides on a team-prepared page itself (the
    invite list never reaches the browser).
- **Email confirmation is on.**
  - Links carry a one-time token to `/api/auth/confirm`, so they work on any device.
  - The answer is "check your inbox" whether or not the address had an account (no enumeration).
  - Templates are in the account's language (de/en/ar).
  - A page goes public only once the address is confirmed; unconfirmed sign-ups are deleted
    after 7 days (the name is free again).
- **The badge and the address on a page come from the profile.** A trigger copies them in, so
  nobody can write "verified" into their own page.
- **The team console reads and writes only through team-only database functions.**
  - Each function checks the caller's permission (same role table as the app, tested) and
    writes the activity log.
  - Suspending ends every session.
  - "Sign out device" ends the sessions that device's sign-ins opened.
  - The first owner is made once with `make_owner()` in the SQL editor, never from a browser.
  - Prepared pages stay in the browser and are published by script for now; the rest of the
    console is live.
- **Security posture.**
  - RLS on every table, in the same migration; functions are SECURITY DEFINER with an empty
    search_path; the secret key exists only in server routes.
  - Sessions live in first-party cookies on the dashboard (strictly necessary); creator pages
    still set none.
  - Types are generated from the schema (`pnpm db:types`).

**Verification.**

- `pnpm db:test`: 76 pgTAP tests as customer, visitor, server, owner and viewer.
- `pnpm db:lint`: plpgsql_check clean.
- `e2e/supabase.spec.ts` against the local stack covers:
  - sign-up, email confirmation, the page saved on the server, the failed and successful
    sign-in log;
  - the live username check, password reset by email, suspended and blocked sign-ins, and
    account deletion;
  - the console as a non-member and as the owner (suspend, note, block and unblock, activity).
- The demo suite still passes.

**Consequences.**

- The founder creates the Pro project in Frankfurt and connects it to Vercel; then we apply the
  migrations, auth settings and templates, and make the owner (docs/SUPABASE_SETUP.md).
- Supabase's built-in mailer is for testing only. Production needs custom SMTP (Scaleway TEM,
  docs/SETUP_ACCOUNTS.md) before real sign-ups.
- Follow-ups:
  - public pages served from the database (`public_page()` is ready);
  - analytics events (views and clicks are 0 until the beacon lands);
  - Stripe writing `subscriptions` and `invoices`;
  - prepared pages in the database.
