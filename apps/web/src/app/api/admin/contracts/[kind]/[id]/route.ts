import { z } from "zod";

import { contractDecision, type ContractDecision } from "@/features/email/templates/contract-decision";
import type { EmailLocale } from "@/features/email/templates/render";
import { resolveCancellation, resolveWithdrawal } from "@/features/payments/server/contracts";
import { contractsDeps, json, paymentsOff, readJson, siteOrigin, testMode } from "@/features/payments/server/get-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];

const body = z.object({
  action: z.enum(["handled", "acceptWithdrawal", "rejectWithdrawal", "endNow", "rejectCancellation", "resume"]),
  note: z.string().trim().max(2000).optional(),
  refundCents: z.number().int().min(0).max(10_000_000).optional(),
});

const WITHDRAWAL_ACTIONS = new Set(["handled", "acceptWithdrawal", "rejectWithdrawal"]);
const CANCELLATION_ACTIONS = new Set(["handled", "endNow", "rejectCancellation", "resume"]);
/** Decisions that must say why (SQL refuses them without a note, too). */
const NOTE_REQUIRED = new Set(["rejectWithdrawal", "endNow", "rejectCancellation", "resume"]);

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
 * by a team function called **as the team member** (SQL checks `billing.manage`); then, with the
 * service side, Stripe (refund, end now, resume: each step idempotent) and the bookkeeping
 * (`record_refund`, `update_pro_subscription`, `confirm_cancellation`); then the decision e-mail to
 * the account's own address. "Handled" only marks unmatched or informational requests.
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
  let decision: ContractDecision;
  let to: string | null;
  let receivedAt: Date;
  let locale: EmailLocale = "de";

  try {
    if (kind === "withdrawal") {
      const found = await service.from("withdrawals").select("received_at, contract, order_id, entitlement_id, profile_id, decision, refund_cents").eq("id", id).maybeSingle();
      if (found.error) return json({ ok: false, error: "server" }, 500);
      if (!found.data) return json({ ok: false, error: "notFound" }, 404);
      const withdrawal = found.data;
      receivedAt = new Date(withdrawal.received_at);
      const order = withdrawal.order_id
        ? (await service.from("orders").select("number, amount_cents, stripe_payment_intent, locale").eq("id", withdrawal.order_id).maybeSingle()).data
        : null;
      const accepted = action === "acceptWithdrawal";
      const refundCents = order ? (parsed.data.refundCents ?? order.amount_cents) : null;
      if (order && refundCents !== null && refundCents > order.amount_cents) return json({ ok: false, error: "invalid" }, 400);

      const resolved = await asUser.rpc("admin_resolve_withdrawal", {
        target: id,
        decision: accepted ? "accepted" : "rejected",
        ...(note ? { note } : {}),
        ...(accepted && refundCents !== null ? { refund_cents: refundCents } : {}),
      });
      // A retry after a failed Stripe step: the decision is already recorded; finish the same one.
      const retry = resolved.error?.message.includes("linkyo:locked") && accepted && withdrawal.decision === "accepted";
      if (resolved.error && !retry) return refusal(resolved.error.message);
      const result = (resolved.data ?? {}) as Record<string, unknown>;
      locale = LOCALES.find((candidate) => candidate === (order?.locale ?? result.locale)) ?? "de";
      to = (typeof result.accountEmail === "string" && result.accountEmail) || (await accountEmail(withdrawal.profile_id));

      if (!accepted) {
        decision = { kind: "withdrawalRejected", contract: order?.number ?? withdrawal.contract, note };
      } else if (order) {
        const cents = retry ? (withdrawal.refund_cents ?? 0) : (refundCents ?? 0);
        await resolveWithdrawal({ kind: "order", paymentIntent: order.stripe_payment_intent, refundCents: cents }, deps);
        decision = { kind: "withdrawalAccepted", contract: order.number, amountCents: cents };
      } else {
        const entitlement = withdrawal.entitlement_id
          ? (await service.from("entitlements").select("stripe_subscription_id").eq("id", withdrawal.entitlement_id).maybeSingle()).data
          : null;
        const subscription = entitlement?.stripe_subscription_id;
        if (!subscription) return json({ ok: false, error: "notFound" }, 404);
        const invoice = (
          await service.from("invoices").select("payment_intent, amount_cents").eq("subscription", subscription).in("status", ["paid", "refunded"]).order("at", { ascending: false }).limit(1).maybeSingle()
        ).data;
        const paymentIntent = (typeof result.paymentIntent === "string" && result.paymentIntent !== "" ? result.paymentIntent : null) ?? invoice?.payment_intent ?? null;
        await resolveWithdrawal({ kind: "pro", subscription, paymentIntent }, deps);
        decision = { kind: "withdrawalAccepted", contract: "Linkyo Pro", amountCents: invoice?.amount_cents ?? 0 };
      }
    } else {
      const found = await service.from("cancellations").select("received_at, entitlement_id, profile_id").eq("id", id).maybeSingle();
      if (found.error) return json({ ok: false, error: "server" }, 500);
      if (!found.data) return json({ ok: false, error: "notFound" }, 404);
      receivedAt = new Date(found.data.received_at);
      const next = action === "endNow" ? "ended" : action === "resume" ? "resumed" : "rejected";
      const resolved = await asUser.rpc("admin_resolve_cancellation", { target: id, decision: next, note });
      if (resolved.error) return refusal(resolved.error.message);
      const result = (resolved.data ?? {}) as Record<string, unknown>;
      to = (typeof result.accountEmail === "string" && result.accountEmail) || (await accountEmail(found.data.profile_id));
      const subscription = typeof result.subscription === "string" ? result.subscription : null;
      const outcome = await resolveCancellation(action as "endNow" | "resume" | "rejectCancellation", { id, subscription }, deps);
      decision =
        action === "endNow"
          ? { kind: "cancellationEnded", endedAt: outcome.endsAt ?? new Date() }
          : action === "resume"
            ? { kind: "resumed", nextChargeAt: outcome.nextChargeAt ?? new Date() }
            : { kind: "cancellationRejected", note };
    }
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    if (error instanceof Error && error.message.includes("linkyo:notFound")) return json({ ok: false, error: "notFound" }, 404);
    console.error(JSON.stringify({ evt: "contract_decision_failed", action, error: error instanceof Error ? error.name : "unknown" }));
    return json({ ok: false, error: "stripe" }, 502);
  }

  let mailed = false;
  if (to) {
    try {
      const t = await deps.translator(locale);
      await deps.send(contractDecision({ to, locale, receivedAt, decision, site: siteOrigin(), testMode }, t));
      mailed = true;
    } catch (mailError) {
      console.error(JSON.stringify({ evt: "decision_mail_failed", error: mailError instanceof Error ? mailError.message : "unknown" }));
    }
  }
  return json({ ok: true, mailed });
}
