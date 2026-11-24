# Draft — Team money through Stripe, least privilege for editors, one revenue number

**Status.** Proposed (Stage 1, WP1.1). The integrator gives it its number.

**Context.** The Stage 1 audit (plan §2.4) found that the team console told the team money had moved when it had not:

- **A-01.** "Refund" ran `admin_refund_invoice`, which only wrote `status = 'refunded'`, while the dialog said the amount
  goes back to the customer. "Cancel" and the plan menu wrote `subscriptions`; the next Stripe webhook overwrote them
  and Stripe kept charging.
- **A-15.** Editors (who build pages and fulfil page-service orders) had `customers.view` and so saw every customer's
  e-mail address. Simply taking it away would have broken the page service: the order queue, one order and the
  orders' row-level security asked for `customers.view`.
- **A-14.** The CSV export was open to every role, unlogged, and a cell such as `=HYPERLINK(…)` ran as a formula.
- **A-09, A-10, A-08, A-21.** The MRR tile and the MRR chart used two rules (€200 against €192); "Other" appeared
  twice in Analytics; views were a hard-coded 0 for real accounts and the funnel's Pro step hung on them; the Pro
  price was a stale "assumed" €8.

**Decision.**

- **Money moves only through Stripe server routes.** `POST /api/admin/customers/<id>/billing/{refund,cancel,resume}`
  follow the orders refund: the member's decision first, as that member (`admin_pro_refund_target`,
  `admin_pro_subscription_target`: `billing.manage`, the activity log), then Stripe (a refund with one idempotency key
  per invoice; `cancel_at_period_end` set or cleared), then the record as the server (`record_refund` as Stripe's
  webhook writes it, `upsert_pro_subscription`), then the customer's e-mail (`refund-issued`,
  `cancellation-confirmation`). The console says "refunded" or "ends on …" only after that answer. A refusal by
  Stripe changes nothing; a record that fails after Stripe acted answers 500 and the same click is sent again (Stripe
  does not act twice).
- **`admin_refund_invoice` is the server's alone** (revoked from `authenticated`).
- **A refund waits while a withdrawal of that subscription is open**: that refund is decided under withdrawals and
  cancellations, as for orders.
- **Where Pro comes from is shown**: Stripe (paid), Team (by hand, free of charge) or Reward (Pro for life).
  "Pro geben (Team)", the trial extension and the manual cancel exist only without a Stripe subscription. The team's
  Pro is not revenue.
- **Payments off (production today):** the three routes answer 409 `paymentsOff` with an honest message and the
  console offers no Stripe action; a Stripe-backed customer shows "works once payments are switched on".
- **`orders.view`** (owner, admin, editor, viewer) gates the order queue, one order, the order tables' policies and
  the Referrals screen; **`customers.view` leaves the editor role**. Orders show the customer's address only to roles
  that may see customers, and the browser can no longer select `orders.customer_email` (column grants). Editors keep
  Overview and Analytics: `admin_customers()` gives `analytics.view` roles the rows without name, e-mail, city and notes.
- **`customers.export`** (owners and admins): the export is logged first (`customer.export`, with the row count;
  no log, no file), and cells starting with `= + - @`, a tab or a carriage return get a leading apostrophe.
- **One revenue rule**, `revenueAt(customer, t)`: a Stripe plan counts from its start (or the sign-up) while active or
  overdue, a canceled one until it was canceled; trials, the team's Pro and rewards count 0. `mrrAt` sums it; the tile
  is `mrrAt(now)` and the chart's last bar is the same call.
- **Views are "not measured yet"** for real accounts (tile, list column, detail, CSV); the funnel's Pro step no longer
  depends on them. The fold key for "everything else" is `__rest` ("All others").
- **The Pro price comes from `payments/prices.ts`**; the "price assumed" badge and footnote are gone.

**Consequences.**

- **E-mail:** production sends no refund or cancellation e-mail until a mail transport exists (founder decision F1,
  SMTP). The routes report `mailed: false`, and the console says the e-mail did not go out.
- **Hosted database:** the migration `20261124100100_admin_money.sql` must be applied before this code relies on it.
  Until then the money routes answer 409 `notAvailable` (never a database-only "refunded"); the export works unlogged
  as before; `admin_customers()` without `source` falls back to "invoices mean Stripe".
- **Stripe idempotency:** Stripe keeps the answer to an idempotency key for 24 hours, errors included. A refund Stripe
  refused (for example for lack of balance) gives the same refusal when sent again within that time; the team then
  refunds in the Stripe dashboard. The same holds for the existing order and withdrawal refunds.
- **Still open:** the activity screen needs a sentence and an icon for `customer.export` (it shows the raw name until
  then); `admin_deliver_proposal` still returns the customer's address to any `pages.edit` caller for the delivery
  e-mail (the deliver route could read it with the service client instead).

**Alternatives considered.** A masked e-mail view for editors (rejected: an editor never needs any part of it);
dropping `customers.view` without `orders.view` (rejected: it breaks the page service, plan critique 2).
