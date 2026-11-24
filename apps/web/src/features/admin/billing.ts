import { subscriptionSource, type Customer } from "./customers/model";

/**
 * Money in the team console (ADR 0073, team money through Stripe). A console button may say money
 * moved only when Stripe moved it: refunds, cancelling and resuming a Stripe subscription go through
 * our server (`/api/admin/customers/<id>/billing/<action>`), which checks the member's permission in
 * the database, asks Stripe and records Stripe's answer. Pro the team gave by hand involves no money
 * and stays a database change. The demo simulates everything in this browser.
 */

export type BillingAction = "refund" | "cancel" | "resume";

export type BillingError =
  /** NEXT_PUBLIC_PAYMENTS is off on this deployment: nothing was sent to Stripe. */
  | "paymentsOff"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  /** Not paid (or already refunded), or a state Stripe cannot change. */
  | "locked"
  /** An invoice without a payment to refund. */
  | "noPayment"
  /** The database does not have the money functions yet. */
  | "notAvailable"
  /** This server is not set up for it (no Stripe key, or no server key for the database). Nothing changed. */
  | "notConfigured"
  /** Stripe refused or could not be reached; nothing changed. */
  | "stripe"
  /** Stripe did it, but our record failed: send the same action again (Stripe will not do it twice). */
  | "notRecorded"
  /** The customer cancelled Pro themselves (/kuendigen): that is taken back under contracts, with their request. */
  | "customerCancelled"
  /** Something went wrong and it is not known whether Stripe was asked: check Stripe before sending it again. */
  | "server"
  | "invalid"
  | "network";

export type BillingAnswer = { ok: true; mailed: boolean; endsAt?: string | null } | { ok: false; error: BillingError };

const ERRORS: readonly BillingError[] = [
  "paymentsOff",
  "unauthorized",
  "forbidden",
  "notFound",
  "locked",
  "noPayment",
  "notAvailable",
  "notConfigured",
  "stripe",
  "notRecorded",
  "customerCancelled",
  "server",
  "invalid",
  "network",
];

export interface BillingContext {
  /** Real accounts (Supabase); false in the demo. */
  live: boolean;
  /** Contracts can be made on this deployment (NEXT_PUBLIC_PAYMENTS). */
  payments: boolean;
  /** The member may change plans and refund (`billing.manage`). */
  manage: boolean;
}

export interface BillingActions {
  /** Free ↔ "Pro geben (Team)" by hand: never over a Stripe subscription. */
  manualPlan: boolean;
  /** 14 more trial days by hand: never over a Stripe subscription. */
  trial: boolean;
  /** "stripe": at the end of the paid period, through the server; "manual": the team's own Pro; "demo": this browser. */
  cancel: "stripe" | "manual" | "demo" | null;
  resume: "stripe" | "manual" | "demo" | null;
  /** Paid invoices: through Stripe, or in this browser (demo). */
  refund: "stripe" | "demo" | null;
  /** A Stripe subscription whose actions wait for payments to be switched on here. */
  waitingForPayments: boolean;
}

const NONE: BillingActions = { manualPlan: false, trial: false, cancel: null, resume: null, refund: null, waitingForPayments: false };

/** What the console offers for this customer's money, and how each action is carried out. */
export function billingActions(customer: Customer, context: BillingContext): BillingActions {
  if (!context.manage) return NONE;
  const sub = customer.subscription;
  const running = sub.plan === "pro" && sub.status !== null && sub.status !== "canceled";
  if (!context.live) {
    // The demo: everything happens in this browser, as before (no money anywhere).
    return {
      manualPlan: true,
      trial: true,
      cancel: running ? "demo" : null,
      resume: sub.status === "canceled" ? "demo" : null,
      refund: "demo",
      waitingForPayments: false,
    };
  }
  if (subscriptionSource(customer) === "stripe") {
    const ending = sub.cancelAtPeriodEnd === true;
    return {
      manualPlan: false,
      trial: false,
      cancel: context.payments && running && !ending ? "stripe" : null,
      // A customer's own cancellation is taken back under contracts, never here (the database refuses it too).
      resume: context.payments && running && ending && sub.cancelledByCustomer !== true ? "stripe" : null,
      refund: context.payments ? "stripe" : null,
      waitingForPayments: !context.payments,
    };
  }
  return {
    manualPlan: true,
    trial: true,
    cancel: running ? "manual" : null,
    resume: sub.plan === "pro" && sub.status === "canceled" ? "manual" : null,
    // Invoices of an earlier Stripe subscription can still be refunded through Stripe.
    refund: context.payments ? "stripe" : null,
    waitingForPayments: false,
  };
}

/** The date a Stripe subscription ends on, when it was cancelled for the end of its period. */
export const scheduledEnd = (customer: Customer): string | null =>
  customer.subscription.cancelAtPeriodEnd ? (customer.subscription.endsAt ?? customer.subscription.renewsAt ?? null) : null;

// ── Browser → our server ─────────────────────────────────────────────────────────────────────

export interface BillingDeps {
  token: () => Promise<string | null>;
  send: (path: string, init: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
}

/**
 * Reads a route's answer; anything unexpected (an HTML error page, an empty body, an unknown code) is
 * the generic "server" error, never a success and never "Stripe did it".
 */
export function readAnswer(ok: boolean, body: unknown): BillingAnswer {
  const value = (body ?? {}) as Record<string, unknown>;
  if (ok && value.ok === true) {
    return { ok: true, mailed: value.mailed === true, ...(typeof value.endsAt === "string" || value.endsAt === null ? { endsAt: value.endsAt } : {}) };
  }
  const error = ERRORS.find((candidate) => candidate === value.error);
  return { ok: false, error: error ?? "server" };
}

/** Asks our server to carry out a money action for a customer. Never throws. */
export async function sendBilling(customerId: string, action: BillingAction, body: Record<string, unknown>, deps: BillingDeps): Promise<BillingAnswer> {
  try {
    const token = await deps.token();
    if (!token) return { ok: false, error: "unauthorized" };
    const response = await deps.send(`/api/admin/customers/${encodeURIComponent(customerId)}/billing/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    return readAnswer(response.ok, parsed);
  } catch {
    return { ok: false, error: "network" };
  }
}

// ── Server: what a team function's refusal means ─────────────────────────────────────────────

/** A missing database function: PostgREST PGRST202 or Postgres 42883 (the hosted database is older). */
export const missingFunction = (error: { code?: string | undefined; message?: string | undefined }): boolean =>
  error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");

/** The HTTP answer for a refusal of `admin_pro_refund_target` / `admin_pro_subscription_target`. */
export function refusal(error: { code?: string | undefined; message?: string | undefined }): { status: number; error: BillingError } {
  const message = error.message ?? "";
  if (missingFunction(error)) return { status: 409, error: "notAvailable" };
  if (message.includes("linkyo:forbidden")) return { status: 403, error: "forbidden" };
  if (message.includes("linkyo:notFound")) return { status: 404, error: "notFound" };
  if (message.includes("linkyo:locked")) return { status: 409, error: "locked" };
  if (message.includes("linkyo:customerCancelled")) return { status: 409, error: "customerCancelled" };
  if (message.includes("linkyo:invalid")) return { status: 400, error: "invalid" };
  return { status: 500, error: "server" };
}

/** A database client as the routes hold it (structural: supabase-js `rpc`). */
interface RpcClient {
  rpc(fn: "admin_pro_money_done", args: { customer: string; action: BillingAction; ref: string }): PromiseLike<{ error: unknown }>;
}

/**
 * Writes what Stripe did into the activity log, as the member, once it is on record
 * (`admin_pro_money_done` checks the records itself). The money has moved by then, so a failure here
 * is reported in the server log and never turns the answer into an error.
 */
export async function logMoneyDone(db: RpcClient, customer: string, action: BillingAction, ref: string): Promise<void> {
  try {
    const { error } = await db.rpc("admin_pro_money_done", { customer, action, ref });
    if (error) console.error(JSON.stringify({ evt: "money_log_failed", action }));
  } catch {
    console.error(JSON.stringify({ evt: "money_log_failed", action }));
  }
}

/** Stripe's subscription status as the entitlement status we record; null for states we leave alone. */
export function recordedStatus(status: string): "active" | "past_due" | "canceled" | null {
  if (status === "active" || status === "past_due" || status === "canceled") return status;
  return null;
}

/** Stripe did it, but our record failed after every attempt: the route answers 500, the action is sent again. */
export class NotRecorded extends Error {
  override name = "NotRecorded";
}

const RECORD_ATTEMPTS = 3;

/** Money has moved at Stripe: a database hiccup must not lose it. Three attempts, a moment apart. */
async function recordSurely(record: () => Promise<void>, pause: (ms: number) => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await record();
      return;
    } catch (error) {
      if (attempt >= RECORD_ATTEMPTS) throw new NotRecorded(error instanceof Error ? error.message : String(error));
      await pause(attempt * 250);
    }
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** What the server's refund needs (structural: `Payments.refund` and `record_refund`). */
export interface RefundDeps {
  refund(input: { paymentIntentId: string; amountCents: number; key: string }): Promise<unknown>;
  /** `record_refund(payment_intent, 'goodwill', amount)` as the server; throws when it fails. */
  record(paymentIntent: string, amountCents: number): Promise<void>;
  pause?: (ms: number) => Promise<void>;
}

/** One refund per invoice at Stripe, however often the button is pressed or the request sent again. */
export const invoiceRefundKey = (invoiceId: string): string => `linkyo-invoice-${invoiceId}-refund`;

/**
 * Refunds a Pro invoice: Stripe first (idempotent per invoice), then the record, as Stripe's own
 * `charge.refunded` would write it ('goodwill': the invoice is refunded, Pro goes on). Whichever
 * arrives first, the webhook or this record, the invoice ends "refunded" once.
 */
export async function refundInvoice(target: { invoice: string; paymentIntent: string; amountCents: number }, deps: RefundDeps): Promise<void> {
  await deps.refund({ paymentIntentId: target.paymentIntent, amountCents: target.amountCents, key: invoiceRefundKey(target.invoice) });
  await recordSurely(() => deps.record(target.paymentIntent, target.amountCents), deps.pause ?? wait);
}

/** A subscription as Stripe answers it (structural: `SubscriptionState`). */
export interface StripeSubscriptionLike {
  status: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  customerId: string;
}

export interface SubscriptionDeps {
  cancelAtPeriodEnd(subscription: string): Promise<StripeSubscriptionLike>;
  resume(subscription: string): Promise<StripeSubscriptionLike>;
  /** `upsert_pro_subscription` as the server; throws when it fails. */
  record(input: { subscription: string; customer: string; next: "active" | "past_due" | "canceled"; periodEnd: string; cancelAtEnd: boolean; cancelAt: string | null }): Promise<void>;
  pause?: (ms: number) => Promise<void>;
}

/**
 * Cancels a Stripe subscription at the end of its paid period, or takes that back, then records
 * Stripe's answer (the webhook's customer.subscription.updated writes the same). Answers when Pro
 * ends (null when it goes on).
 */
export async function changeSubscription(
  action: "cancel" | "resume",
  target: { subscription: string; stripeCustomer: string | null },
  deps: SubscriptionDeps,
): Promise<{ endsAt: string | null }> {
  const state = action === "cancel" ? await deps.cancelAtPeriodEnd(target.subscription) : await deps.resume(target.subscription);
  const next = recordedStatus(state.status);
  if (!next) throw new NotRecorded(`subscription ${state.status}`);
  await recordSurely(
    () =>
      deps.record({
        subscription: target.subscription,
        customer: state.customerId !== "" ? state.customerId : (target.stripeCustomer ?? ""),
        next,
        periodEnd: state.periodEnd,
        cancelAtEnd: state.cancelAtPeriodEnd,
        cancelAt: state.cancelAt,
      }),
    deps.pause ?? wait,
  );
  return { endsAt: state.cancelAt ?? (state.cancelAtPeriodEnd ? state.periodEnd : null) };
}
