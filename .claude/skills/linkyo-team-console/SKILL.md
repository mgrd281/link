---
name: linkyo-team-console
description: How Linkyo's team console (/[locale]/admin/*) works and how to change it safely (roles and permissions, demo vs real-account actions, the activity log, money only through Stripe server routes, CSV export safety, honest numbers, phone layouts). Use when touching apps/web/src/features/admin/**, app/[locale]/admin/**, app/api/admin/**, a team function (admin_*) or role_permissions in supabase/migrations, or the admin.* messages.
---

# Linkyo team console

Decision records: ADR 0016 (team area), 0028 (console v2), 0030 (real accounts), 0073 (team money through
Stripe). Data layer: the `linkyo-supabase` skill. Selling flows: the `linkyo-payments` skill. The console is part of
the team area: **teal**, not the dashboard's black and grey. Never put `data-console` anywhere under
`features/admin/**` or `app/[locale]/admin/**` (it would switch the screen to the dashboard's palette); the guard
`features/design-system/team-area-guard.test.ts` fails if it appears there.

## Map

| What | Where |
|---|---|
| Roles → permissions | `features/admin/types.ts` (`PERMISSIONS`, `ROLE_PERMISSIONS`, `can`) ↔ `public.role_permissions` |
| Who is signed in, "view as" | `features/admin/session.tsx` (`useAdmin().can` reads `ROLE_PERMISSIONS` of the role in view) |
| Navigation | `features/admin/shell.tsx` (`GROUPS`: one `permission` per item) |
| Every action | `features/admin/actions.ts` (`useConsoleActions()`); screens never write overrides or call RPCs directly |
| Real-account reads | `features/admin/live.ts` (`admin_me`, `admin_team`, `admin_activity`, `admin_customers`, `admin_blocked_ips`) |
| Customers (one shape for demo and real) | `features/admin/customers/{model,data,stats,sample,overrides,ui}.ts(x)` |
| Money | `features/admin/billing.ts` (what may happen, the browser call, the server's orchestration) and `app/api/admin/customers/[id]/billing/{refund,cancel,resume}/route.ts` |
| Orders, contracts, AI switch | `features/admin/orders/**`, `app/api/admin/orders/**`, `app/api/admin/contracts/**` |
| Messages | `admin.*` in `src/messages/{de,en,ar}.json`; Arabic Latin names and numbers in `<bdi>` (`bidi.tsx`, `arabic-bdi.test.ts`) |
| Tests | `features/admin/**/*.test.ts`, `supabase/tests/{access,admin_money,billing,referrals}.test.sql`, `e2e/admin.spec.ts` (demo), `e2e/admin-money-app.spec.ts`, `orders-app.spec.ts`, `team-fixes-app.spec.ts`, `contracts-app.spec.ts` (`@real`) |

## Adding a permission or a screen

1. Add the permission to `PERMISSIONS` and the roles in `ROLE_PERMISSIONS` (`types.ts`).
2. Mirror it in a **new** migration: `insert into public.role_permissions … on conflict do nothing` (and `delete` to take
   one away; that is a grant change, allowed with pgTAP and a rollback note).
3. Update the pgTAP role matrix: the counts in `access.test.sql` (last test) and the pairs in a test of your own.
   `customers.test.ts` checks the counts against `ROLE_PERMISSIONS` and that every permission appears in a migration.
4. Label it in `admin.permissions.<name_with_underscore>` in de, en and ar (the roles table on the Team screen lists
   every permission) and adjust the role descriptions in `admin.roles.*`.
5. A new screen: the route under `app/[locale]/admin/(shell)/`, a nav item in `shell.tsx` with its `permission`, and a
   guard in the screen itself (`can(...)` → a calm notice), because the address can be typed in. Example:
   `CustomersHidden` in `customers-list-screen.tsx`.

Current permissions to keep in mind: `customers.view` (owner, admin, viewer: people and their e-mail addresses),
`customers.export` (owner, admin), `orders.view` (every role: the page-service queue, one order, Referrals),
`analytics.view` (every role: the numbers; for roles without `customers.view`, `admin_customers()` returns the rows
without name, e-mail, city and notes).

## Demo vs real accounts

- **Demo** (`supabaseEnabled` false): team data and customer changes live in this browser (`adminStore`,
  `overrides`), sample customers are fictional (`example.com`, documentation IP ranges) and labelled (`DemoNote`).
  Money is simulated: say so (`admin.customer.billingNote`).
- **Real accounts:** one `admin_*` database function per action, `security definer`, `require_permission` first,
  `audit(...)` after; the console then calls `refreshLive()`. Reads go through functions too.
- **Prepared pages** (`/api/admin/prepared`): the demo sends the team token; real accounts send the member's own
  session, and the route checks the role as that member (`admin_me()`, `isTeamMember`). 401 without either, 403 off
  the team.
- **Customer source** on a customer's Overview: "Echtes Konto" for real accounts (`source: "live"`), "Dieses Gerät"
  and "Beispieldaten" only in the demo.
- A new database function must not break a database that does not have it yet: a missing function (`PGRST202` /
  `42883`, `missingFunction()` in `billing.ts`) means "behave as before"; any other error is shown honestly.

## Money moves only through Stripe

- Never write "refunded", "canceled" or a paid plan into the database from the browser. A money action is a route:
  1. the check as the member (`admin_pro_refund_target`, `admin_pro_subscription_target`, `admin_refund_order`):
     permission and locks (a withdrawal waits → `linkyo:locked`; a customer's own cancellation from /kuendigen →
     `linkyo:customerCancelled`: the console never takes that back, it is resumed under withdrawals and
     cancellations, where the cancellation is marked `resumed`);
  2. Stripe through `getPayments()` (only `stripe-payments.ts` talks to Stripe), with an idempotency key per decision;
  3. the record as the server (`record_refund`, `upsert_pro_subscription`), retried three times; failure → 500
     `notRecorded`, the same click is sent again;
  4. the activity log as the member (`admin_pro_money_done`, `logMoneyDone()`), which writes only what the records
     show, once per invoice;
  5. the e-mail to the account's own address (`refund-issued`, `cancellation-confirmation`) through `deliver()`
     (`features/admin/mail.ts`); report `mailed`, which is true only when a delivering transport took it
     (`emailDelivers()`: never the `console` stand-in that production has until F1).
- Only `notRecorded` may say "Stripe did it". Any other failure (an unknown database error, an HTML 502, a missing
  server key) is `server` or `notConfigured`: "check Stripe before sending it again", never "it happened".
- The console says it happened only after the route answers ok (`runBilling` in the customer screen) and names every
  error (`admin.customer.billingErrors.*`).
- `billingActions()` decides what is offered: a Stripe subscription → Stripe actions only (none while
  `NEXT_PUBLIC_PAYMENTS` is off, and a note says why); the team's own Pro and Free → "Pro geben (Team)", trial and the
  manual cancel; the demo → everything in this browser.
- Routes answer 409 `paymentsOff` when payments are off on the deployment.
- Pro the team gives and rewards are **never revenue**. `revenueAt(customer, t)` is the one rule; the MRR tile is
  `mrrAt(customers, now)` and the chart's last bar is the same call. Never compute revenue another way.

## The activity log

- Every team function writes `audit(action, target_id, target, details)`. A new action also needs:
  `ActivityEvent["action"]` in `types.ts`, an icon in `activity-screen.tsx` (`ICONS`), a sentence
  `admin.activity.actions.<action_with_underscore>` and, for customer actions, `admin.customer.historyLine.*`, in de,
  en and ar. An unknown action renders as its raw name (never a crash), but ship the sentence with it.
- A money action is logged **after** Stripe did it and it is on record, never before: the log says what happened.
  (The orders refund logs `order.refund`, "hat eine Erstattung angewiesen": a decision, worded as one.)

## Exports

- Behind `customers.export`. Log first (`admin_customers_exported(row_count)`); no log, no file.
- Every cell through `csvCell()` (`customers/stats.ts`): quoted, inner quotes doubled, and a leading apostrophe for
  `= + - @`, tab and carriage return.

## Honest numbers

- No invented numbers. Real accounts have no view counter yet: show "not measured yet" (`viewsMeasured`), hide the
  views column and sort, leave views out of the CSV. A funnel step never depends on an unmeasured number.
- Folds use the key `REST` (`__rest`, "All others"), never a word a value can be.
- Prices come from `features/payments/prices.ts` (`PLAN_PRICE`).

- "Free → Pro" is paying (Stripe) customers ÷ all customers; its hint says so. The team's Pro and rewards are not in it.
- A figure that could not be loaded is a dash or a notice, never a 0 (the prepared-pages count on Overview, the
  withheld customer figures below).

## Privacy

- Editors see no customer and no e-mail address: not in lists, details, orders, timelines or exports. In SQL, show an
  address only with `has_permission('customers.view')`; the browser cannot select `orders.customer_email`.
- Customer e-mail addresses never appear in the activity log.
- **Hosted database before `20261124100100_admin_money.sql`:** editors still hold `customers.view` there, so
  `admin_customers()` would hand them people. `customers/access.ts` decides from `admin_me()`: a role without
  `customers.view` (code map) on the old database (no `orders.view`), or wherever the database still grants it
  `customers.view`, gets no `admin_customers()` call; Overview and Analytics show `FiguresWithheld`. An owner
  viewing as an editor sees the same. Remove the interim once the migration is on production (ADR 0073).

## Phone patterns (current and planned)

- Today: card rows below `md` on the customer list, tab strips that scroll sideways inside the page, the bottom tab
  bar with "More", "View as" at the top of the overview on phones.
- Planned (Stage 3, WP3.4): card rows for every table, a Filter sheet with chips, paging at 25, "View as" in the
  account menu. Stage 5 adds MFA and step-up before delete, refund and role changes; Stage 2 moves prepared pages to the
  database. Update this skill when they land.

## Checklist before calling a console change done

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, the demo build, `e2e/admin.spec.ts` on desktop and mobile with axe.
- Database changes: `pnpm db:reset && pnpm db:test && pnpm db:lint`, `pnpm db:types`, then the `@real` specs that touch
  the console (`admin-money-app`, `orders-app`, `team-fixes-app`, `contracts-app`) as the `linkyo-qa-release` skill
  describes.
- de, en and ar for every text; Arabic mirrored; screenshots at 390 × 844 and 1440 × 900.
