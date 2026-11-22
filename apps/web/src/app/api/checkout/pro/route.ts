import { z } from "zod";

import { getPayments, json, paymentsOff, readJson, siteOrigin } from "@/features/payments/server/get-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const body = z.object({ locale: z.enum(["de", "en", "ar"]).default("de") });

/**
 * Opens a Checkout Session for Linkyo Pro, unless the account already has Pro (bought, given by the
 * team or "Pro für immer"): a second subscription would add nothing (409 alreadyPro).
 */
export async function POST(request: Request) {
  const off = paymentsOff();
  if (off) return off;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const parsed = body.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const { locale } = parsed.data;
  const db = serviceSupabase();
  const pro = await db.rpc("has_pro", { account: signedIn.user.id });
  if (pro.error) return json({ ok: false, error: "server" }, 500);
  if (pro.data) return json({ ok: false, error: "alreadyPro" }, 409);
  try {
    const session = await getPayments().createProCheckout({
      profileId: signedIn.user.id,
      email: signedIn.user.email,
      locale,
      returnUrl: `${siteOrigin()}/${locale}/checkout/done?session_id={CHECKOUT_SESSION_ID}&product=pro`,
    });
    const { error } = await db.rpc("record_checkout_intent", { session: session.sessionId, account: signedIn.user.id, product: "pro-monthly", locale });
    if (error) return json({ ok: false, error: "server" }, 500);
    return json({ sessionId: session.sessionId, clientSecret: session.clientSecret });
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    console.error(JSON.stringify({ evt: "checkout_failed", product: "pro-monthly", error: error instanceof Error ? error.message : String(error) }));
    return json({ ok: false, error: "server" }, 502);
  }
}
