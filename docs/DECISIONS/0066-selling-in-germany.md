# 0066 — Selling in Germany: two service packages, Pro, and the statutory flows

**Status.** Accepted (v7 phase 1, test mode). No Stripe account, publishable key, live webhook or
real payment exists yet; every test talks to a local Stripe mock. The legal texts are German drafts
for the lawyer ([ADR 0067](0067-going-live.md)).

**Context.** The founder decided:

- **Two service packages.** **Start, 24,99 €**: the AI drafts the page, a person from our team
  reviews and finishes it. **Premium, 79,99 €**: a person designs it, with a marketing kit and revision
  rounds. No struck-through price anywhere.
- **Pro, 8 € a month**, now with AI drafts (5 a month, [ADR 0065](0065-ai-page-builder.md)).
- **Test mode first**; `stripe` is approved as a server-side dependency, pinned at `23.2.0`.
- The seller is the founder as a **registered sole trader in Hamburg**, charging **19 % VAT** (not a
  Kleinunternehmer). Her Impressum data lives in one file, `apps/web/src/features/legal/company.ts`;
  docs never repeat it.

Selling to consumers in Germany brings hard rules: the order button and the summary above it
(§ 312j BGB), the confirmation on a durable medium (§ 312f), the withdrawal function (§ 356a), the
cancellation button for subscriptions (§ 312k), prices including VAT (PAngV), and pre-contract
information the customer can understand in the contract language.

**Decision.**

### 1. Products and prices

- `features/payments/prices.ts` is the one price config: `service-start` 2499, `service-premium`
  7999, `pro-monthly` 800 (cents, EUR, gross), with a `PRICE_CHANGELOG`. Prices carry a `vatMode`
  (`standard19` | `kleinunternehmer`); the default and the founder's case is `standard19` (VAT shown
  as included: 3,99 €, 12,77 €, 1,28 €). A test fails if a price has a "price after" without an
  intro date, so no struck-through price can render.
- **Revision rounds:** Start 1, Premium 3, each requested within 14 days of delivery and delivered
  within 2 working days.
- **Premium's marketing kit ships in phase 1:** an Instagram bio, a TikTok bio, a 4-week posting plan
  and 3 story pictures, stored with the proposal and delivered with it. A Premium proposal cannot be
  delivered without its kit (`linkyo:incomplete`).
- **Voluntary money-back** within 14 days of delivery, **once per account**, the same words
  everywhere (service page, conditions, e-mail, AGB, proposal screen); the customer keeps the page.
  It is a goodwill promise on top of the law ("gesetzliche Rechte bleiben unberührt").
- Pro has no trial and is monthly only. A withdrawal within 14 days gets a full refund; that is the
  legal consequence, so it is **not** advertised as a perk (UWG Annex No. 10). Pro lists only what
  ships (AI drafts); domain, selling and the e-mail list are shown as "planned".

### 2. Delivery promise in working days

`features/payments/delivery.ts` (pure, Berlin time through `Intl`, no library): an order **and its
briefing** in by 12:00 on a working day is due the next working day at 18:00; later, the working day
after. A working day is Monday to Friday except nationwide holidays (Easter computed); customer copy
says **"Arbeitstag (Mo–Fr)"**, never "Werktag" (which in German law usually includes Saturday). A
daily capacity (default 4) moves the date when a day is full. Without the early-start request the
work starts 14 days later. The briefing deadline is 12:00 of the working day before the due day; a
briefing that arrives on time keeps the promised date, a late one gets the next free day.

### 3. Contracts in German only until the texts are translated

The Widerrufsbelehrung, the Muster-Widerrufsformular and the AGB exist in German only. Because
pre-contract and withdrawal information must be understandable in the contract language, **`/en` and
`/ar` checkouts take no order**: while `LEGAL_TEXT_LOCALES` (`features/legal/texts.ts`, `["de"]`)
lacks the locale, the checkout shows a notice in the visitor's language with a link to the same
checkout under `/de`. Contract e-mails use the order's locale, which is therefore `de`. Adding a
locale to `LEGAL_TEXT_LOCALES` (after the lawyer approves the translated texts) is the only switch.

### 4. The checkout on our own page (§ 312j)

- `/checkout/service` and `/checkout/pro` are our pages with Stripe's Payment Element (Checkout
  Sessions with `ui_mode: "elements"`), not a redirect. Stripe.js loads from `js.stripe.com` **only
  on `/checkout/*`**, by a script tag in one file (`features/payments/stripe-js.tsx`; no npm package,
  statically guarded). Without a publishable key (all of phase 1) the payment slot says
  "Zahlung im Testmodus noch nicht eingerichtet" and the button stays disabled.
- Order of the page, phone first: title; payment methods and the payment slot; for the service the
  **unticked** early-start checkbox (separate from the terms); then **the § 312j summary** (product,
  features, Gesamtpreis, VAT line, due date or Pro billing day and term); the warranty line and the
  terms links; then the button, exactly **"Zahlungspflichtig bestellen"**. Only the terms links stand
  between the summary and the button. No wallet button acts as the order button.
- **Early start is fixed at consent:** before confirming, `/api/checkout/consent` recomputes the due
  date on the server; if it differs from the one shown, the page shows the new date and confirms
  nothing. Otherwise it stores the exact checkbox text (or none), the start and the promised due date.
  The date above the button, the stored date and the e-mailed date are the same.
- `/api/checkout/pro` answers `409 alreadyPro` for any account that has Pro (bought, team-set or
  "Pro für immer").

### 5. Webhook: idempotent by `processed_at`

`/api/stripe/webhook` (Node runtime, raw body, signature checked) records each event in
`stripe_events` and treats it as a duplicate only when `processed_at` is set; `processed_at` is set
only after the handler succeeded, and any failure answers 500 so Stripe redelivers. Every handler is
idempotent on its own. **A paid service order enters the team queue only after the confirmation
e-mail was sent** (§ 312f): it carries who we are, the order, the early-start record, the
Widerrufsbelehrung, the Muster-Widerrufsformular, a "Vertrag widerrufen" link and the AGB. Pro events
upsert one entitlement from the subscription's current state, so the event order does not matter; a
refunded entitlement is final.

**Stripe API version moves** (stripe 23.2.0 pins `2026-11-18.endive`, later than
`2025-03-31.basil`), each checked against the package's type definitions:

- a subscription's period end is `items.data[0].current_period_end`;
- an invoice's subscription and its metadata are under `parent.subscription_details`;
- an invoice's payment intent comes from its expanded `payments`, so `invoices` stores `subscription`
  and `payment_intent` itself;
- Checkout Sessions take `allowed_payment_method_types` (23.0.0 removed `payment_method_types`).

### 6. Withdrawal: `/widerruf` never rejects (§ 356a)

Two steps, no login, no reason field, the button exactly **"Widerruf bestätigen"**. The declaration
is always stored with the server's time and a receipt is shown (and can be saved as a PDF). A
matched service order is marked `withdrawal_pending`: work stops in SQL (no save, no delivery, no
revision, no team AI run) and the order moves to the top of the team queue. **Refunds are team
actions:** the contracts panel shows the § 357 Abs. 1 BGB deadline (received + 14 days) with an SLA
chip; accepting refunds (in full, or the § 357a value share for work done after an early-start
request) and ends the contract; a Pro withdrawal cancels the subscription at once and refunds the
latest invoice. There is no "too many attempts" error: above 10 declarations an hour from one IP hash
or 3 receipts a day to one address a request is stored as `suspect` and its receipt is held until the
team checks it.

### 7. Cancellation: `/kuendigen` by kind and date (§ 312k)

Only the logo header and the form (no footer, no offer, no "pause instead"); the footer link reads
exactly **"Verträge hier kündigen"** and the button **"Jetzt kündigen"**. An **ordinary** cancellation
without a date, or with a date on or before the period end, ends at the period end; with a later date
it ends at the end of the billing period that contains that date (Stripe `cancel_at`). An
**extraordinary** cancellation is recorded and reviewed by the team. **Receipts are neutral:** the
receipt to the typed address is the same whether or not an account matched (GDPR Art. 5(1)(f)); the
exact end date goes only to the matched account's own address. Withdrawal and cancellation never move
money automatically.

### 8. Visibility

Everything here needs `paymentsEnabled` (`NEXT_PUBLIC_PAYMENTS` = `test` or `live`, with real
accounts); in `test` mode a banner says so. `NEXT_PUBLIC_PAYMENTS=live` fails `next build` unless the
company data is complete and `LEGAL_REVIEWED=1` ([ADR 0067](0067-going-live.md)). The live demo
deployment sets neither, so it shows no service page, checkout, contract form or contract link.

**Consequences.**

- Statutory labels are asserted by e2e; changing them needs the lawyer.
- English and Arabic customers cannot order until translated, reviewed legal texts exist.
- Team actions (refunds, withdrawals, cancellations) reuse existing permissions: view orders =
  `customers.view`; work on proposals = `pages.edit`; refunds and contract requests =
  `billing.manage` (read: `billing.view`).
- How to work on this is in the `linkyo-payments` skill.
