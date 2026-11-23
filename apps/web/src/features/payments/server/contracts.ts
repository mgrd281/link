import { z } from "zod";

import { cancellationCombined, cancellationConfirmation } from "@/features/email/templates/cancellation-confirmation";
import { cancellationReceipt } from "@/features/email/templates/cancellation-receipt";
import { emailTranslator, type EmailLocale, type EmailT } from "@/features/email/templates/render";
import { withdrawalReceipt } from "@/features/email/templates/withdrawal-receipt";
import type { EmailMessage } from "@/features/email/types";
import type { Db } from "@/lib/supabase/server";

import { berlinDay, periodEndContaining } from "../delivery";

import type { ServerPayments } from "./subscription";

/**
 * The statutory contract forms and what follows them (plan §0.3 #7, §1.6.1). Rules that never bend:
 * - a declaration is always stored with the server's time and always gets a receipt on screen; it is
 *   never refused (no "too many attempts", § 356a Abs. 5 BGB);
 * - a suspect declaration (many from one address, or many receipts to one mailbox) gets no e-mail
 *   and no Stripe call until the team has checked it;
 * - money never moves here: refunds and contract ends are team actions (`resolveWithdrawal`,
 *   `resolveCancellation`, used by the contracts panel's route);
 * - what goes to a typed address never reveals whether an account or contract matched; the exact
 *   end date goes only to the matched account's own address.
 */

// ─── Forms ──────────────────────────────────────────────────────────────────────────────────

const locale = z.enum(["de", "en", "ar"]);
const email = z.string().trim().max(254).pipe(z.email());

export const withdrawalFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email,
  contract: z.string().trim().min(1).max(80),
  locale,
});
export type WithdrawalForm = z.infer<typeof withdrawalFormSchema>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00Z`)));

export const cancellationFormSchema = z
  .object({
    kind: z.enum(["ordinary", "extraordinary"]),
    reason: z.string().trim().max(2000).optional(),
    name: z.string().trim().min(1).max(120),
    accountEmail: email,
    contract: z.literal("pro-monthly"),
    wantedDate: day.nullish(),
    confirmationEmail: email,
    locale,
  })
  // An extraordinary cancellation names its reason; an ordinary one needs none (and stores none).
  .refine((form) => form.kind === "ordinary" || (form.reason ?? "").length > 0, { path: ["reason"] });
export type CancellationForm = z.infer<typeof cancellationFormSchema>;

// ─── Storage ────────────────────────────────────────────────────────────────────────────────

export interface WithdrawalRecord {
  id: string;
  receivedAt: string;
  matched: boolean;
  suspect: boolean;
  /** The matched account's own address (server only, never sent to the browser). */
  accountEmail: string | null;
}

export interface CancellationRecord {
  id: string;
  receivedAt: string;
  matched: boolean;
  suspect: boolean;
  subscription: string | null;
  entitlementId: string | null;
  periodEnd: string | null;
  accountEmail: string | null;
}

export interface ContractsDb {
  recordWithdrawal(input: { name: string; email: string; contract: string; ipHash: string }): Promise<WithdrawalRecord>;
  recordCancellation(input: CancellationForm & { ipHash: string }): Promise<CancellationRecord>;
  confirmCancellation(id: string, decision: "scheduled" | "ended" | "rejected" | "resumed", effective: Date | null): Promise<void>;
  markReceiptSent(kind: "withdrawal" | "cancellation", id: string): Promise<void>;
  recordRefund(paymentIntent: string, kind: "voluntary" | "withdrawal" | "goodwill", amount: number | null): Promise<string>;
  updateProSubscription(subscription: string, next: "refunded" | "canceled"): Promise<void>;
}

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

async function rpc<T>(call: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

/** The contract functions of the billing migration, called with the service client. */
export function supabaseContractsDb(db: Db): ContractsDb {
  return {
    async recordWithdrawal(input) {
      const row = (await rpc(db.rpc("record_withdrawal", { name: input.name, email: input.email, contract: input.contract, ip_hash: input.ipHash }), "record_withdrawal")) as Record<string, unknown>;
      return { id: String(row.id), receivedAt: String(row.receivedAt), matched: row.matched === true, suspect: row.suspect === true, accountEmail: text(row.accountEmail) };
    },
    async recordCancellation(input) {
      const row = (await rpc(
        db.rpc("record_cancellation", {
          kind: input.kind,
          name: input.name,
          account_email: input.accountEmail,
          contract: input.contract,
          confirmation_email: input.confirmationEmail,
          ip_hash: input.ipHash,
          ...(input.kind === "extraordinary" && input.reason ? { reason: input.reason } : {}),
          ...(input.wantedDate ? { wanted: input.wantedDate } : {}),
        }),
        "record_cancellation",
      )) as Record<string, unknown>;
      return {
        id: String(row.id),
        receivedAt: String(row.receivedAt),
        matched: row.matched === true,
        suspect: row.suspect === true,
        subscription: text(row.subscription),
        entitlementId: text(row.entitlementId),
        periodEnd: text(row.periodEnd),
        accountEmail: text(row.accountEmail),
      };
    },
    async confirmCancellation(id, decision, effective) {
      await rpc(db.rpc("confirm_cancellation", { target: id, decision, ...(effective ? { effective: effective.toISOString() } : {}) }), "confirm_cancellation");
    },
    async markReceiptSent(kind, id) {
      await rpc(db.rpc("mark_receipt_sent", { kind, target: id }), "mark_receipt_sent");
    },
    async recordRefund(paymentIntent, kind, amount) {
      return (await rpc(db.rpc("record_refund", { payment_intent: paymentIntent, kind, ...(amount === null ? {} : { amount }) }), "record_refund")) ?? "notFound";
    },
    async updateProSubscription(subscription, next) {
      await rpc(db.rpc("update_pro_subscription", { subscription, next }), "update_pro_subscription");
    },
  };
}

// ─── E-mail ─────────────────────────────────────────────────────────────────────────────────

/** next-intl's translator over one locale's messages (server only: it loads the message file). */
export async function loadEmailTranslator(target: EmailLocale): Promise<EmailT> {
  const messages = (await import(`../../../messages/${target}.json`)) as { default: Record<string, unknown> };
  return emailTranslator(target, messages.default);
}

export interface ContractsDeps {
  db: ContractsDb;
  /** Throws PaymentsNotConfigured when Stripe is not set up (only called for a matched, normal request). */
  payments: () => ServerPayments;
  send: (message: EmailMessage) => Promise<unknown>;
  translator: (locale: EmailLocale) => Promise<EmailT>;
  /** One content-free line per problem (never an address or a name). */
  log?: (line: Record<string, unknown>) => void;
}

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

const logError = (deps: ContractsDeps, evt: string, error: unknown) =>
  (deps.log ?? ((line) => console.error(JSON.stringify(line))))({ evt, error: error instanceof Error ? error.message : String(error) });

/** What the browser learns: when it arrived and whether a receipt went out. Never `matched`. */
export interface FormAnswer {
  receivedAt: string;
  mailed: boolean;
}

/**
 * A withdrawal: stored (the order stops: `withdrawal_pending`), then, unless suspect, the receipt to
 * the typed address and, when a contract matched under another address, to the account's address too.
 */
export async function submitWithdrawal(form: WithdrawalForm, ipHash: string, deps: ContractsDeps): Promise<FormAnswer> {
  const record = await deps.db.recordWithdrawal({ name: form.name, email: form.email, contract: form.contract, ipHash });
  if (record.suspect) return { receivedAt: record.receivedAt, mailed: false };
  try {
    const t = await deps.translator(form.locale);
    const receipt = (to: string) => withdrawalReceipt({ to, locale: form.locale, name: form.name, contract: form.contract, email: form.email, receivedAt: new Date(record.receivedAt) }, t);
    await deps.send(receipt(form.email));
    if (record.matched && record.accountEmail && !same(record.accountEmail, form.email)) await deps.send(receipt(record.accountEmail));
    await deps.db.markReceiptSent("withdrawal", record.id);
    return { receivedAt: record.receivedAt, mailed: true };
  } catch (error) {
    // Stored all the same; the team sees the missing receipt (receipt_sent_at is empty).
    logError(deps, "withdrawal_receipt_failed", error);
    return { receivedAt: record.receivedAt, mailed: false };
  }
}

/**
 * The Stripe side of a cancellation, by kind and date (plan §1.6.1). Ordinary without a date, or with a
 * date on or before the period end: at the period end. Ordinary with a later date: at the end of the
 * billing period containing that date (Stripe `cancel_at`). Extraordinary, unmatched or suspect: no
 * Stripe call (the team decides). Answers when Pro ends, or null.
 *
 * A later date needs the subscription as Stripe has it: its period end, and its billing cycle anchor.
 * A subscription that started on the 29th to the 31st ends a short month on that month's last day
 * (31 Jan → 28 Feb → 31 Mar), so the period end alone would put the next boundary days too early
 * (28 Mar), and Stripe would end Pro before the paid period is over.
 */
export async function processCancellation(record: CancellationRecord, form: CancellationForm, deps: Pick<ContractsDeps, "db" | "payments">): Promise<{ endsAt: Date | null }> {
  if (record.suspect || !record.matched || !record.subscription || form.kind === "extraordinary") return { endsAt: null };
  const payments = deps.payments();
  let periodEnd = record.periodEnd ? new Date(record.periodEnd) : new Date((await payments.retrieveSubscription(record.subscription)).periodEnd);
  let target = periodEnd;
  if (form.wantedDate && form.wantedDate > berlinDay(periodEnd)) {
    const state = await payments.retrieveSubscription(record.subscription);
    const current = new Date(state.periodEnd);
    // `new Date(0)` stands for "no period end on the subscription": keep the one we stored.
    if (current.getTime() > 0) periodEnd = current;
    const anchor = state.billingAnchor ? new Date(state.billingAnchor) : periodEnd;
    target = periodEndContaining(periodEnd, form.wantedDate, Number.isNaN(anchor.getTime()) ? periodEnd : anchor);
  }
  if (target.getTime() === periodEnd.getTime()) {
    const state = await payments.cancelAtPeriodEnd(record.subscription);
    const endsAt = new Date(state.periodEnd);
    const effective = Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= 0 ? periodEnd : endsAt;
    await deps.db.confirmCancellation(record.id, "scheduled", effective);
    return { endsAt: effective };
  }
  const state = await payments.cancelAt(record.subscription, target);
  const effective = state.cancelAt ? new Date(state.cancelAt) : target;
  await deps.db.confirmCancellation(record.id, "scheduled", effective);
  return { endsAt: effective };
}

/**
 * A cancellation: stored, processed by kind and date, then (unless suspect) the neutral receipt to the
 * typed confirmation address and, when an account matched, the confirmation with the exact end date to
 * the account's own address. When both addresses are the same, one e-mail carries both.
 */
export async function submitCancellation(form: CancellationForm, ipHash: string, deps: ContractsDeps): Promise<FormAnswer> {
  const record = await deps.db.recordCancellation({ ...form, ipHash });
  let endsAt: Date | null = null;
  let processed = true;
  try {
    ({ endsAt } = await processCancellation(record, form, deps));
  } catch (error) {
    // Stored as received; the team finishes it in the contracts panel.
    processed = false;
    logError(deps, "cancellation_stripe_failed", error);
  }
  if (record.suspect) return { receivedAt: record.receivedAt, mailed: false };
  try {
    const t = await deps.translator(form.locale);
    const receivedAt = new Date(record.receivedAt);
    const receiptData = {
      to: form.confirmationEmail,
      locale: form.locale,
      kind: form.kind,
      wantedDate: form.wantedDate ?? null,
      name: form.name,
      accountEmail: form.accountEmail,
      receivedAt,
    } as const;
    // Only a decided end date is told; an ordinary cancellation Stripe did not take yet reads as being reviewed.
    const confirmed = form.kind === "ordinary" && processed ? endsAt : null;
    const toAccount = record.matched && record.accountEmail ? record.accountEmail : null;
    if (toAccount && same(toAccount, form.confirmationEmail)) {
      await deps.send(cancellationCombined({ ...receiptData, to: toAccount }, { endsAt: confirmed }, t));
    } else {
      await deps.send(cancellationReceipt(receiptData, t));
      if (toAccount) await deps.send(cancellationConfirmation({ to: toAccount, locale: form.locale, name: form.name, receivedAt, endsAt: confirmed }, t));
    }
    await deps.db.markReceiptSent("cancellation", record.id);
    return { receivedAt: record.receivedAt, mailed: true };
  } catch (error) {
    logError(deps, "cancellation_receipt_failed", error);
    return { receivedAt: record.receivedAt, mailed: false };
  }
}

// ─── Team decisions (the contracts panel's route, plan §1.7) ────────────────────────────────

type TeamDeps = Pick<ContractsDeps, "db" | "payments"> & {
  /** Waits between the attempts to record a refund (tests pass a no-op). */
  pause?: (ms: number) => Promise<void>;
};

const RECORD_ATTEMPTS = 3;

/** Stripe made the refund, but it could not be written to the database: the same action must be sent again. */
export class RefundNotRecorded extends Error {
  override name = "RefundNotRecorded";
}

/**
 * Records a refund Stripe already made. The money has moved, so a database hiccup must not lose the
 * kind the team chose: three attempts, a moment apart. `record_refund` is idempotent, and when
 * Stripe's `charge.refunded` got there first it replaces that event's "goodwill" with this kind. If
 * every attempt fails, `RefundNotRecorded` goes to the route (500); the same action can be sent
 * again, since the refund at Stripe is idempotent, too.
 */
async function recordRefundSurely(deps: TeamDeps, paymentIntent: string, kind: "voluntary" | "withdrawal", amount: number | null): Promise<void> {
  const pause = deps.pause ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; ; attempt++) {
    try {
      await deps.db.recordRefund(paymentIntent, kind, amount);
      return;
    } catch (error) {
      if (attempt >= RECORD_ATTEMPTS) throw new RefundNotRecorded(error instanceof Error ? error.message : String(error));
      await pause(attempt * 250);
    }
  }
}

/**
 * May the console refund this order (again)? Not once it is withdrawn or refunded under a kind the
 * team chose. An order Stripe's report marked "goodwill" stays open for one case: the console's own
 * refund went through at Stripe but could not be recorded, the webhook recorded it without a kind,
 * and the team sends the refund again. Stripe answers that repeat with the same refund (idempotency
 * key) and only then is the kind corrected; a refund that was really made in the Stripe dashboard
 * makes Stripe refuse, and nothing changes.
 */
export function orderRefundable(order: { status: string; refundKind: string | null }): boolean {
  if (order.status === "withdrawn") return false;
  return order.status !== "refunded" || order.refundKind === "goodwill";
}

/**
 * The voluntary money-back of a service order (after `admin_order_refund_target`): the full refund at
 * Stripe, then the record with kind `voluntary`, which uses up the once-per-account promise.
 */
export async function resolveOrderRefund(target: { paymentIntent: string; amountCents: number }, deps: TeamDeps): Promise<void> {
  await deps.payments().refund({ paymentIntentId: target.paymentIntent, amountCents: target.amountCents });
  await recordRefundSurely(deps, target.paymentIntent, "voluntary", target.amountCents);
}

/**
 * The Stripe and bookkeeping side of an accepted withdrawal (after `admin_resolve_withdrawal`):
 * - a service order: refund the amount the team set (none for 0) and record it as a withdrawal (the
 *   order becomes `withdrawn`);
 * - Pro: end the subscription at once, refund the latest paid invoice in full (D6), mark the
 *   entitlement refunded and record the refund.
 * Each Stripe step is idempotent (refunds carry a key derived from the payment and amount).
 */
export async function resolveWithdrawal(
  target: { kind: "order"; paymentIntent: string | null; refundCents: number } | { kind: "pro"; subscription: string; paymentIntent: string | null },
  deps: TeamDeps,
): Promise<{ refunded: boolean }> {
  const payments = deps.payments();
  if (target.kind === "order") {
    if (!target.paymentIntent || target.refundCents <= 0) return { refunded: false };
    await payments.refund({ paymentIntentId: target.paymentIntent, amountCents: target.refundCents });
    await recordRefundSurely(deps, target.paymentIntent, "withdrawal", target.refundCents);
    return { refunded: true };
  }
  await payments.cancelNow(target.subscription);
  if (target.paymentIntent) await payments.refund({ paymentIntentId: target.paymentIntent });
  await deps.db.updateProSubscription(target.subscription, "refunded");
  if (target.paymentIntent) await recordRefundSurely(deps, target.paymentIntent, "withdrawal", null);
  return { refunded: Boolean(target.paymentIntent) };
}

/**
 * The Stripe side of a team decision on a cancellation (after `admin_resolve_cancellation`): end now
 * (an accepted extraordinary cancellation), resume (the holder asked from the account's address), or
 * reject (no Stripe call). Answers the resulting end date (null when Pro goes on).
 */
export async function resolveCancellation(
  action: "endNow" | "resume" | "rejectCancellation",
  target: { id: string; subscription: string | null },
  deps: TeamDeps & { now?: () => Date },
): Promise<{ endsAt: Date | null; nextChargeAt: Date | null }> {
  if (action === "rejectCancellation") {
    await deps.db.confirmCancellation(target.id, "rejected", null);
    return { endsAt: null, nextChargeAt: null };
  }
  if (!target.subscription) throw new Error("linkyo:notFound");
  const payments = deps.payments();
  if (action === "endNow") {
    await payments.cancelNow(target.subscription);
    const now = (deps.now ?? (() => new Date()))();
    await deps.db.confirmCancellation(target.id, "ended", now);
    return { endsAt: now, nextChargeAt: null };
  }
  const state = await payments.resume(target.subscription);
  await deps.db.confirmCancellation(target.id, "resumed", null);
  return { endsAt: null, nextChargeAt: new Date(state.periodEnd) };
}
