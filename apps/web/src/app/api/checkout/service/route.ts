import { z } from "zod";

import { getPayments, json, paymentsOff, readJson, siteOrigin } from "@/features/payments/server/get-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const body = z.object({ product: z.enum(["service-start", "service-premium"]), locale: z.enum(["de", "en", "ar"]).default("de") });

/**
 * Opens a Checkout Session (elements) for a page-service package and remembers whose it is. The
 * browser mounts the payment form with the client secret; the order itself is created by the webhook
 * once Stripe reports the payment.
 */
export async function POST(request: Request) {
  const off = paymentsOff();
  if (off) return off;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const { product, locale } = parsed.data;
  try {
    const session = await getPayments().createServiceCheckout({
      profileId: signedIn.user.id,
      email: signedIn.user.email,
      product,
      locale,
      returnUrl: `${siteOrigin()}/${locale}/checkout/done?session_id={CHECKOUT_SESSION_ID}`,
    });
    const { error } = await serviceSupabase().rpc("record_checkout_intent", { session: session.sessionId, account: signedIn.user.id, product, locale });
    if (error) return json({ ok: false, error: "server" }, 500);
    return json({ sessionId: session.sessionId, clientSecret: session.clientSecret });
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    console.error(JSON.stringify({ evt: "checkout_failed", product, error: error instanceof Error ? error.message : String(error) }));
    return json({ ok: false, error: "server" }, 502);
  }
}
