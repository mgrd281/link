# 0028 — Team console: customers, subscriptions, security and analytics

**Context.** The founder asked for a complete admin dashboard:

- every permission for the admin;
- subscriptions;
- each customer's IP address and "fingerprint";
- settings on any customer;
- full analytics;
- a modern design.

The team area (ADR 0016) only covered prepared pages, members and activity. Phase 0 has no shared
database yet: accounts live in the browser (ADR 0014).

**Decision.**

- **One customer model** (`features/admin/customers/model.ts`) for the demo and for Phase 1. It
  covers the account, page usage, subscription with invoices, sign-in log and notes.
  - The demo merges two sources behind one hook (`useCustomers`):
    - **the accounts in this browser:** real accounts with their real sign-ins, marked "This
      device";
    - **240 seeded sample customers.**
  - The team's changes are kept as patches (`overrides.ts`) and every one is written to the
    activity log.
  - Phase 1 swaps both for team-only Postgres views and functions with row-level security.
- **Sample data that can't hurt anyone:**
  - fictional names and `example.com` addresses;
  - IPs only from the documentation ranges (RFC 5737, RFC 3849);
  - seeded, so the same customers return every time, which tests check.
  - A note on every console screen says what is sample data.
- **Screens:**
  - **Overview:** 8 KPIs over 7, 30 or 90 days; new customers per day; MRR per month; a "needs a
    look" list; countries, devices and newest customers.
  - **Customers:** search across name, email, address and IP; filters; sort; pagination; CSV
    export.
  - **Customer:** overview, subscription and invoices, devices and the 30-day sign-in log, notes
    and history. Actions:
    - change plan, extend trial, cancel or resume, refund;
    - verify, sign out one or all devices, suspend;
    - delete (by typing the username);
    - block an IP.
  - **Subscriptions:** MRR, ARR, ARPU, trials, failed payments, MRR over 12 months, plans and a
    status filter. Pro is priced at the €8 assumption from COSTS.md, labelled as such until
    pricing is decided.
  - **Security:** a sign-in log across all accounts with risk flags (new device, new country,
    failed-attempt burst, blocked address), blocked addresses, and a plain "what we keep and why".
  - **Analytics:** sign-ups per week, the funnel from sign-up to Pro, weekly retention cohorts,
    and countries, kinds, templates, systems, languages and browsers.
  - Charts follow the dataviz rules: one hue per series, hover and arrow-key readout, a table
    view, a sequential violet scale with AA text on every step.
- **Permissions.**
  - Eight new permissions: customers view, manage and delete; billing view and manage; security
    view and manage; analytics.
  - **Owner:** everything.
  - **Admin:** everything except the team itself and deleting customers.
  - **Editor:** customers and analytics, read-only.
  - **Viewer:** read-only.
  - Navigation and every action check the permission. Owners can "view as" any role.
- **IP and "fingerprint", within the law.** The founder asked for both, and we built them for
  account holders only, for account security:
  - **What is kept:** IP address, rough place from the host's headers (`/api/session/context`,
    nothing stored there, no geo-IP third party), device and browser type, a random device ID kept
    in that browser, and a short signature hash (browser, language, time zone, screen) to tell
    devices apart.
  - **What is not:** no covert cross-site fingerprinting, and no identification of creator-page
    visitors. Page analytics stay cookie-free and aggregated (ADR 0010, ARCHITECTURE.md).
  - **Legal basis:** GDPR Art. 6(1)(f), legitimate interest in preventing account takeover and
    abuse; § 25(2) no. 2 TDDDG, strictly necessary for the service the user asked for.
  - **Retention:** 30 days and at most 50 entries per account.
  - **Transparency:** owners see their own sign-ins under Settings → Recent sign-ins, and the log
    is part of their data export (Art. 15 and 20).
  - **Privacy policy:** it gets a paragraph on this before launch, on the legal checklist.
- **Enforcement.** In the demo, suspending, signing out and blocking are recorded and shown, but
  only enforced once accounts live on the server (Phase 1: Supabase Auth hooks reject blocked IPs
  and suspended accounts). Billing actions go to Stripe once Pro launches.

**Consequences.**

- Phone navigation keeps Overview, Customers and Creators as tabs, and the rest sits under "More".
  The e2e helper `go()` handles both.
- Tests:
  - unit: risk flags, revenue rules, seeded data privacy, stats, the UA parser, role
    permissions, and sign-in logging with export and delete;
  - e2e: customer actions landing in the activity log, a real sign-in IP that can be blocked,
    read-only viewers, and axe on every console page in en and ar.
