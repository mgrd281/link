import { z } from "zod";

import { deliveryPlan, type DeliveryPlan } from "@/features/payments/delivery";
import { loadEmailTranslator } from "@/features/payments/server/contracts";
import { json, paymentsOff, readJson, serviceBooking } from "@/features/payments/server/get-payments";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const body = z.object({ sessionId: z.string().min(1).max(255), earlyStart: z.boolean(), shownDueAt: z.iso.datetime() });

const planJson = (plan: DeliveryPlan) => ({ startAt: plan.startAt.toISOString(), dueAt: plan.dueAt.toISOString(), briefingBy: plan.briefingBy.toISOString() });

/**
 * The moment the customer presses "Zahlungspflichtig bestellen" (service): the ready date is computed
 * again on the server. If it differs from the one on screen, nothing is confirmed (409 with the new
 * plan; the page shows it and the next press sends it). Otherwise the consent is stored with the exact
 * checkbox text (early start only), the start and the promised date: the date above the button, the
 * order's promised date and the e-mailed date are the same.
 */
export async function POST(request: Request) {
  const off = paymentsOff();
  if (off) return off;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const { sessionId, earlyStart, shownDueAt } = parsed.data;
  const db = serviceSupabase();
  const intent = await db.from("checkout_intents").select("locale, product").eq("session_id", sessionId).eq("profile_id", signedIn.user.id).maybeSingle();
  if (intent.error) return json({ ok: false, error: "server" }, 500);
  if (!intent.data?.product.startsWith("service-")) return json({ ok: false, error: "notFound" }, 404);

  const now = new Date();
  const { capacity, booked } = await serviceBooking(now);
  const plan = deliveryPlan({ from: now, earlyStart, capacity, booked });
  if (plan.dueAt.getTime() !== Date.parse(shownDueAt)) return json({ ok: false, error: "dueChanged", plan: planJson(plan) }, 409);

  const locale = intent.data.locale === "en" || intent.data.locale === "ar" ? intent.data.locale : "de";
  const consentText = earlyStart ? (await loadEmailTranslator(locale))("checkout.early.label") : "";
  const { data, error } = await db.rpc("record_checkout_consent", {
    session: sessionId,
    account: signedIn.user.id,
    early: earlyStart,
    consent_text: consentText,
    start_after: plan.startAt.toISOString(),
    promised_due: plan.dueAt.toISOString(),
  });
  if (error) return json({ ok: false, error: "server" }, 500);
  if (data !== "ok") return json({ ok: false, error: "notFound" }, 404);
  return json({ ok: true, plan: planJson(plan) });
}
