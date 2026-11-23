import { z } from "zod";

import { cancellationConfirmation } from "@/features/email/templates/cancellation-confirmation";
import { contractDecision, type ContractDecision } from "@/features/email/templates/contract-decision";
import type { EmailLocale, EmailT } from "@/features/email/templates/render";
import type { EmailMessage } from "@/features/email/types";
import { RefundNotRecorded, resolveCancellation, resolveWithdrawal, withdrawalRefundKey, withdrawalStep } from "@/features/payments/server/contracts";
import { contractsDeps, json, paymentsOff, readJson, siteOrigin, testMode } from "@/features/payments/server/get-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];

const body = z.object({
  action: z.enum(["handled", "acceptWithdrawal", "rejectWithdrawal", "schedule", "endNow", "rejectCancellation", "resume"]),
  note: z.string().trim().max(2000).optional(),
  refundCents: z.number().int().min(0).max(10_000_000).optional(),
});

const WITHDRAWAL_ACTIONS = new Set(["handled", "acceptWithdrawal", "rejectWithdrawal"]);
const CANCELLATION_ACTIONS = new Set(["handled", "schedule", "endNow", "rejectCancellation", "resume"]);
/** Decisions that must say why (SQL refuses them without a note, too). */
const NOTE_REQUIRED = new Set(["rejectWithdrawal", "endNow", "rejectCancellation", "resume"]);
const CANCELLATION_DECISION = { schedule: "scheduled", endNow: "ended", rejectCancellation: "rejected", resume: "resumed" } as const;

/** A team function's refusal as an HTTP answer. */
function refusal(message: string): Response {
  if (message.includes("linkyo:forbidden")) return json({ ok: false, error: "forbidden" }, 403);
  if (message.includes("linkyo:notFound")) return json({ ok: false, error: "notFound" }, 404);
  if (message.includes("linkyo:invalid")) return json({ ok: false, error: "invalid" }, 400);
  if (message.includes("linkyo:locked")) return json({ ok: false, error: "locked" }, 409);
  return json({ ok: false, error: "server" }, 500);
}

async function accountEmail(profileId: string | null): Promise<string | null> {
  if (!profileId) return null;
  const { data } = await serviceSupabase().auth.admin.getUserById(profileId);
  return data.user?.email ?? null;
}

/**
 * The team decides a withdrawal or a cancellation (the contracts panel). Each decision is recorded
 * by a team function called **as the team member** (SQL checks `billing.manage` and that the request
 * is still open for this decision); then, with the service side, Stripe (refund, schedule, end now,
 * resume) and the bookkeeping (`record_refund`, `update_pro_subscription`, `confirm_cancellation`);
 * then the decision e-mail to the account's own address. "Handled" only files a request.
 *
 * What keeps money and e-mails from going out twice:
 * - a decided request is refused by SQL (409 `locked`), so a second member's stale list does nothing;
 * - an accepted withdrawal whose Stripe step failed stays open and is finished by accepting it again
 *   (`withdrawalStep` "finish"): the amount on record, the withdrawal's own refund key at Stripe, and
 *   `cancelNow` that accepts an ended subscription. Once its refund is on record there is nothing to
 *   finish, and a contract that already ended is never refunded for a second declaration.
 */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const off = paymentsOff();
  if (off) return off;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { kind, id } = await params;
  if ((kind !== "withdrawal" && kind !== "cancellation") || !UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const { action } = parsed.data;
  const note = parsed.data.note?.trim() ?? "";
  if (!(kind === "withdrawal" ? WITHDRAWAL_ACTIONS : CANCELLATION_ACTIONS).has(action)) return json({ ok: false, error: "invalid" }, 400);
  if (NOTE_REQUIRED.has(action) && note === "") return json({ ok: false, error: "noteRequired" }, 400);
  const { db: asUser } = signedIn;

  if (action === "handled") {
    const { error } = await asUser.rpc("admin_mark_contract_handled", { kind, target: id, ...(note ? { note } : {}) });
    return error ? refusal(error.message) : json({ ok: true });
  }

  const service = serviceSupabase();
  const deps = contractsDeps();
  let message: (t: EmailT) => EmailMessage;
  let to: string | null;
  let locale: EmailLocale = "de";

  try {
    if (kind === "withdrawal") {
      const found = await service.from("withdrawals").select("received_at, contract, order_id, entitlement_id, profile_id, decision, refund_cents, handled_at").eq("id", id).maybeSingle();
      if (found.error) return json({ ok: false, error: "server" }, 500);
      if (!found.data) return json({ ok: false, error: "notFound" }, 404);
      const withdrawal = found.data;
      const receivedAt = new Date(withdrawal.received_at);
      const order = withdrawal.order_id
        ? (await service.from("orders").select("number, amount_cents, stripe_payment_intent, locale, status").eq("id", withdrawal.order_id).maybeSingle()).data
        : null;
      const entitlement = withdrawal.entitlement_id
        ? (await service.from("entitlements").select("stripe_subscription_id, status").eq("id", withdrawal.entitlement_id).maybeSingle()).data
        : null;
      const accepted = action === "acceptWithdrawal";
      const refundCents = order ? (parsed.data.refundCents ?? order.amount_cents) : null;
      if (order && refundCents !== null && refundCents > order.amount_cents) return json({ ok: false, error: "invalid" }, 400);
      const step = withdrawalStep({ decision: withdrawal.decision, handledAt: withdrawal.handled_at }, { orderStatus: order?.status ?? null, entitlementStatus: entitlement?.status ?? null });

      const resolved = await asUser.rpc("admin_resolve_withdrawal", {
        target: id,
        decision: accepted ? "accepted" : "rejected",
        ...(note ? { note } : {}),
        ...(accepted && refundCents !== null ? { refund_cents: refundCents } : {}),
      });
      // The decision is on record but its Stripe step failed: carry out the same one again.
      const finish = Boolean(resolved.error?.message.includes("linkyo:locked")) && accepted && step === "finish";
      if (resolved.error && !finish) {
        // An accepted request whose contract ended some other way has nothing left to do: file it.
        if (resolved.error.message.includes("linkyo:locked") && withdrawal.decision === "accepted" && withdrawal.handled_at === null && step === "settled") {
          await service.rpc("settle_withdrawal", { target: id });
        }
        return refusal(resolved.error.message);
      }
      const result = (resolved.data ?? {}) as Record<string, unknown>;
      locale = LOCALES.find((candidate) => candidate === (order?.locale ?? result.locale)) ?? "de";
      to = (typeof result.accountEmail === "string" && result.accountEmail) || (await accountEmail(withdrawal.profile_id));

      let decision: ContractDecision;
      if (!accepted) {
        decision = { kind: "withdrawalRejected", contract: order?.number ?? withdrawal.contract, note };
      } else if (order) {
        const cents = finish ? (withdrawal.refund_cents ?? 0) : (refundCents ?? 0);
        await resolveWithdrawal({ kind: "order", paymentIntent: order.stripe_payment_intent, refundCents: cents, key: withdrawalRefundKey(id) }, deps);
        decision = { kind: "withdrawalAccepted", contract: order.number, amountCents: cents };
      } else {
        const subscription = entitlement?.stripe_subscription_id;
        if (!subscription) return json({ ok: false, error: "notFound" }, 404);
        const invoice = (
          await service.from("invoices").select("payment_intent, amount_cents").eq("subscription", subscription).in("status", ["paid", "refunded"]).order("at", { ascending: false }).limit(1).maybeSingle()
        ).data;
        const paymentIntent = (typeof result.paymentIntent === "string" && result.paymentIntent !== "" ? result.paymentIntent : null) ?? invoice?.payment_intent ?? null;
        await resolveWithdrawal({ kind: "pro", subscription, paymentIntent, key: withdrawalRefundKey(id) }, deps);
        decision = { kind: "withdrawalAccepted", contract: "Linkyo Pro", amountCents: invoice?.amount_cents ?? 0 };
      }
      if (accepted) {
        // Stripe and the bookkeeping are done: the request is finished (also when nothing was refunded).
        const settled = await service.rpc("settle_withdrawal", { target: id });
        if (settled.error) console.error(JSON.stringify({ evt: "withdrawal_settle_failed" }));
      }
      message = (t) => contractDecision({ to: to ?? "", locale, receivedAt, decision, site: siteOrigin(), testMode }, t);
    } else {
      const found = await service.from("cancellations").select("received_at, entitlement_id, profile_id, name, wanted_date").eq("id", id).maybeSingle();
      if (found.error) return json({ ok: false, error: "server" }, 500);
      if (!found.data) return json({ ok: false, error: "notFound" }, 404);
      const cancellation = found.data;
      const receivedAt = new Date(cancellation.received_at);
      const step = action as keyof typeof CANCELLATION_DECISION;
      // SQL refuses a step that contradicts a decision already on record (a stale list, a second click).
      const resolved = await asUser.rpc("admin_resolve_cancellation", { target: id, decision: CANCELLATION_DECISION[step], note });
      if (resolved.error) return refusal(resolved.error.message);
      const result = (resolved.data ?? {}) as Record<string, unknown>;
      to = (typeof result.accountEmail === "string" && result.accountEmail) || (await accountEmail(cancellation.profile_id));
      const subscription = typeof result.subscription === "string" ? result.subscription : null;
      const periodEnd =
        step === "schedule" && cancellation.entitlement_id
          ? ((await service.from("entitlements").select("current_period_end").eq("id", cancellation.entitlement_id).maybeSingle()).data?.current_period_end ?? null)
          : null;
      const outcome = await resolveCancellation(step, { id, subscription, wantedDate: cancellation.wanted_date, periodEnd }, deps);
      if (step === "schedule") {
        // The same confirmation the form sends when Stripe takes the cancellation at once: the exact end date.
        message = (t) => cancellationConfirmation({ to: to ?? "", locale, name: cancellation.name, receivedAt, endsAt: outcome.endsAt }, t);
      } else {
        const decision: ContractDecision =
          step === "endNow"
            ? { kind: "cancellationEnded", endedAt: outcome.endsAt ?? new Date() }
            : step === "resume"
              ? { kind: "resumed", nextChargeAt: outcome.nextChargeAt ?? new Date() }
              : { kind: "cancellationRejected", note };
        message = (t) => contractDecision({ to: to ?? "", locale, receivedAt, decision, site: siteOrigin(), testMode }, t);
      }
    }
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    if (error instanceof Error && error.message.includes("linkyo:notFound")) return json({ ok: false, error: "notFound" }, 404);
    // The bookkeeping refused a step that contradicts what another member decided in the meantime.
    if (error instanceof Error && error.message.includes("linkyo:locked")) return json({ ok: false, error: "locked" }, 409);
    if (error instanceof RefundNotRecorded) {
      // Stripe refunded, the database did not take it: accepting the same withdrawal again finishes it.
      console.error(JSON.stringify({ evt: "contract_refund_unrecorded", action }));
      return json({ ok: false, error: "server" }, 500);
    }
    console.error(JSON.stringify({ evt: "contract_decision_failed", action, error: error instanceof Error ? error.name : "unknown" }));
    return json({ ok: false, error: "stripe" }, 502);
  }

  let mailed = false;
  if (to) {
    try {
      await deps.send(message(await deps.translator(locale)));
      mailed = true;
    } catch (mailError) {
      console.error(JSON.stringify({ evt: "decision_mail_failed", error: mailError instanceof Error ? mailError.message : "unknown" }));
    }
  }
  return json({ ok: true, mailed });
}
