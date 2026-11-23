---
name: linkyo-payments
description: Linkyo's selling flows under German law (service packages Start/Premium, Pro monthly, the § 312j checkout with Stripe elements, statutory button labels, the Stripe webhook, /widerruf, /kuendigen, contract e-mails, refunds) and how to test them in test mode without any Stripe account. Use when touching apps/web/src/features/payments/**, features/legal/**, features/email/**, /checkout/*, /service, /api/checkout/*, /api/stripe/webhook, /api/withdrawals, /api/cancellations, prices, VAT, delivery dates or the billing migration.
---

# Linkyo payments

Decision record: ADR 0066 (selling in Germany), ADR 0067 (legal pages and the live gate). Phase 1 is
**test mode**: no Stripe account, no publishable key, no live webhook, no real money, no real e-mail.
Every Stripe call in tests goes to the local mock; the legal texts are German drafts for the lawyer.
For legal questions also read the `gdpr-dsgvo` skill; for anything statutory, the lawyer decides.

## Map

| What | Where |
|---|---|
| Prices, VAT, revisions | `features/payments/prices.ts` (`PRICES`, `PRICE_CHANGELOG`, `VAT_MODE`, `vatCents`, `formatEuro`) |
| Delivery dates (pure, Berlin) | `features/payments/delivery.ts` (`deliveryPlan`, `dueOnBriefing`, `revisionDue`, `billingDay`, `periodEndContaining`) |
| Payments interface | `features/payments/types.ts` |
| Stripe (the only `stripe` import) | `features/payments/server/stripe-payments.ts`; `get-payments.ts` |
| Webhook handler | `features/payments/server/webhook.ts`; route `app/api/stripe/webhook/route.ts` |
| Withdrawal and cancellation rules | `features/payments/server/contracts.ts`; routes `app/api/withdrawals`, `app/api/cancellations` |
| Checkout routes | `app/api/checkout/{plan,service,pro,consent}` |
| Pages | `app/[locale]/service`, `app/[locale]/checkout/{layout,service,pro,done}`, `app/[locale]/(legal)/{impressum,datenschutz,agb,widerrufsbelehrung,widerruf}`, `app/[locale]/kuendigen`, `app/[locale]/app/orders/[id]` |
| Checkout UI | `features/payments/{checkout-service,checkout-pro,checkout-summary,payment-slot,stripe-js,test-banner,service-page}.tsx` |
| Legal texts, company data, gate | `features/legal/{texts,company,live-guard,legal-links,legal-page,withdraw-form,cancel-form}.ts(x)` |
| E-mail | `features/email/{send,types,capture-sender,console-sender,tem-sender}.ts`, templates in `features/email/templates/` |
| Flags | `lib/flags.ts` (`paymentsMode`, `paymentsEnabled`, `stripePublishableKey`) |
| Team decisions | `features/admin/orders/{contract-rules,order-rules}.ts` (what the panel offers), `app/api/admin/contracts/[kind]/[id]`, `app/api/admin/orders/[id]/{refund,deliver}` |
| Database | `supabase/migrations/20261123100200_billing.sql`, `…100400_review_fixes.sql` (`record_refund`, `has_pro`), `…100500_team_fixes.sql` (team decisions), `supabase/tests/billing.test.sql` |
| Stripe mock | `apps/web/e2e/mocks/stripe.handler.mjs` |
| E2E | `e2e/checkout-app.spec.ts`, `e2e/contracts-app.spec.ts`, `e2e/legal-a11y.spec.ts` |

## Rules that are law (never change without the lawyer)

- **Button labels, exactly:** "Zahlungspflichtig bestellen" (`checkout.submit`), "Vertrag widerrufen",
  "Widerruf bestätigen", "Verträge hier kündigen" (footer link to `/kuendigen`), "Jetzt kündigen".
  E2E asserts them.
- **§ 312j order:** title; payment methods and the payment slot; (service) the **unticked**
  early-start checkbox, separate from the terms; **the summary** (product, features, Gesamtpreis,
  VAT line, due date or Pro billing day and term); warranty line and terms links; the button. Only the
  terms links may stand between the summary and the button. No wallet or Express Checkout button
  acts as the order button.
- **Early start is fixed at consent:** the client sends the due date it shows to
  `/api/checkout/consent`; the server recomputes it and answers `409 {plan}` when it differs (the page
  shows the new date and confirms nothing). On `ok` it stores the exact checkbox text, the start and
  the promised date, and only then the client confirms the payment.
- **The confirmation e-mail comes first** (§ 312f): a paid order enters the team queue only after
  `mark_confirmation_sent`, which runs only after the e-mail was sent.
- **`/widerruf` never rejects** (§ 356a): no login, no reason field, two steps, always stored with the
  server's time, receipt on screen. Too many requests make it `suspect` (receipt held), never an
  error. A matched order becomes `withdrawal_pending`: no save, delivery, revision or team AI run.
- **`/kuendigen` contains only the form** (§ 312k): no footer, offer or "pause instead". Ordinary
  without a date or with a date ≤ period end → at the period end; later date → end of the billing
  period containing it (`periodEndContaining`, Stripe `cancel_at`); extraordinary → recorded,
  reviewed by the team.
- **Neutral receipts:** what goes to an address typed into a form never says whether an account or
  contract matched; the exact end date goes only to the matched account's own address. The form
  routes return only `{receivedAt, mailed}`.
- **No automatic money movement** for withdrawals and cancellations: refunds and contract ends are
  team actions (`billing.manage`), with the 14-day refund deadline (§ 357 Abs. 1 BGB) shown.
- **Prices:** gross, with the VAT line by `vatMode` (`standard19`: the founder is a registered sole
  trader in Hamburg charging 19 %); no struck-through price (a test fails if `priceAfterCents` is set
  without `introUntil`); no superlatives, no promised results. Customer copy says "Arbeitstag
  (Mo–Fr)", never "Werktag".
- **Voluntary money-back** "einmal pro Konto", within 14 days of delivery, the same words everywhere.
- **German-only contracts:** `/en` and `/ar` checkouts show `checkout.germanOnly.*` and take no order
  while `LEGAL_TEXT_LOCALES` lacks the locale. Contract e-mails use the order's locale.
- **Company data** lives only in `features/legal/company.ts` (read by the Impressum, the texts and the
  e-mails). Never copy it into docs, tests or other files.
- `NEXT_PUBLIC_PAYMENTS=live` fails the build without complete company data and `LEGAL_REVIEWED=1`.

## Technical rules

- **Stripe stays on the server and on `/checkout/*`:** the npm `stripe` package only in
  `stripe-payments.ts` (and tests); Stripe.js only through `stripe-js.tsx` (the only file that may
  contain `https://js.stripe.com`), loaded by a script tag. The static guard and e2e (no request to
  `js.stripe.com` on any other page) enforce it.
- **API version:** stripe 23.2.0 pins `2026-11-18.endive`. Read the period end from
  `items.data[0].current_period_end`, an invoice's subscription and metadata from
  `parent.subscription_details`, its payment intent from expanded `payments`; Checkout Sessions take
  `allowed_payment_method_types` and `ui_mode: "elements"`. Check every new field against the
  package's `.d.ts`, never cast a whole request.
- **Webhook idempotency = processed, not received:** insert into `stripe_events`, skip only when
  `processed_at` is set, set it after the handler succeeded, answer 500 on any failure so Stripe
  redelivers. Every handler must be idempotent by itself (`record_service_order` by session,
  `upsert_pro_subscription` from the subscription's current state, `refunded` is final).
  `customer.subscription.created/updated` never apply the event's snapshot: the handler reads the
  subscription from Stripe again (a redelivered event must not bring back an ended Pro).
- **Refunds (`record_refund`):** `charge.refunded` always reports kind `goodwill` with Stripe's
  cumulative amount. Only a withdrawal reverses a contract; a goodwill or voluntary refund leaves Pro
  as it is; a partial refund of an order is only noted (`partial`); a kind the team chose replaces
  an earlier `goodwill`; a `goodwill` report for a contract whose withdrawal the team accepted is
  that withdrawal's refund. The console's own record is tried three times (`RefundNotRecorded` →
  500, send it again).
- **Team decisions follow what is on record, not which button was pressed:**
  - an accepted withdrawal is finished (`handled_at`) only when its refund is recorded; until then
    the panel shows "Erstattung offen" with the deadline and offers "Erstattung abschließen"
    (`withdrawalStep` "finish": the amount on record, the key `contract-<id>-refund`);
  - one contract is withdrawn once: SQL refuses to accept a declaration for an order that is already
    withdrawn or refunded, or beside another accepted one; such a declaration is only filed;
  - "Erstatten" on an order goes through `admin_refund_order` (audit `order.refund`, timeline
    `refund_requested` with the member) and is refused while a withdrawal waits;
  - cancellations move only null → scheduled / ended / rejected and scheduled → resumed
    (`cancellation_step_allowed`, checked in `admin_resolve_cancellation` and `confirm_cancellation`);
    an ordinary one that was held is carried out with the action `schedule`;
  - `cancelNow` answers an already ended subscription instead of Stripe's refusal, so every step
    can run again after a failure.
- **Writes only through SQL functions** (`record_*`, `upsert_pro_subscription`, `admin_*`); tables
  revoke insert, update and delete from customers and the team. Team permissions reuse the table:
  orders `customers.view`, proposals `pages.edit`, refunds and contracts `billing.manage`.
- **Stripe host override** (`STRIPE_API_HOST`/`_PORT`/`_PROTOCOL`) is accepted only for a loopback
  host and only off Vercel. Without `STRIPE_SECRET_KEY` the checkout APIs answer `503 notConfigured`.
- **E-mail** goes through `getEmailSender()`: `capture` writes JSON files (tests; throws on Vercel),
  unset or `console` logs one content-free line, `tem` is Scaleway (unused in phase 1). Any other
  name throws, and with live payments only `tem` is handed out (the live build checks it too). HTML
  e-mails use inline layout only: no images, no tracking pixels, no remote fonts. A route that
  answers `mailed: false` must be said on screen (the team then tells the account itself).
- **Leaving the checkout unloads Stripe.js:** `StripeLeaveGuard` (in `stripe-js.tsx`, mounted in the
  checkout layout) makes every way out a full page load. A declined payment shows Stripe's reason
  (`checkout.payFailed` otherwise); a session that could not be opened shows the slot's alert.
- Website pages here are teal (no `data-console`); the order screen under `/app` is console.

## Test flow without any account

Nothing here needs a Stripe or Scaleway account:

1. Local stack: `pnpm db:start && pnpm db:reset` (the `linkyo-supabase` skill).
2. Build with `NEXT_PUBLIC_SUPABASE_URL`, the local publishable key and `NEXT_PUBLIC_PAYMENTS=test`
   (the test banner shows). Leave `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` unset: the payment slot shows
   "Zahlung im Testmodus noch nicht eingerichtet" and the button stays disabled. That is the expected
   phase 1 state.
3. Run with the mock: `E2E_MOCKS=1`, `STRIPE_SECRET_KEY=sk_test_local`,
   `STRIPE_WEBHOOK_SECRET=whsec_local_test`, `STRIPE_API_HOST=127.0.0.1`,
   `STRIPE_API_PORT=$MOCK_STRIPE_PORT`, `STRIPE_API_PROTOCOL=http`, `EMAIL_TRANSPORT=capture`,
   `EMAIL_CAPTURE_DIR=$PWD/.mail` (all variables: the `linkyo-qa-release` skill).
4. A paid session is simulated by a **signed webhook**: build the event JSON and sign it with
   `Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_local_test" })`, then POST it
   to `/api/stripe/webhook` (see `checkout-app.spec.ts`). The mock's `POST /__subscriptions/:id` and
   `POST /__invoices/:id` register Stripe state; `GET /__requests` shows what the app sent (filter by
   your own ids: tests run in parallel).
5. Read the e-mails from `EMAIL_CAPTURE_DIR` (`readCapturedMail` in `e2e/real.ts`).
6. pgTAP covers the SQL rules: `pnpm db:test` (`billing.test.sql`).

## Verify

```bash
cd apps/web
npx vitest run src/features/payments src/features/legal src/features/email src/lib/static-guard.test.ts
# then the real-mode e2e with the mocks (linkyo-qa-release), and pnpm db:test
```
