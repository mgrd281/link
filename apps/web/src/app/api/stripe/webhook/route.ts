import { getEmailSender } from "@/features/email/send";
import { loadEmailTranslator } from "@/features/payments/server/contracts";
import { getPayments, json, paymentsOff, siteOrigin, testMode } from "@/features/payments/server/get-payments";
import { handleStripeEvent, supabaseWebhookStore } from "@/features/payments/server/webhook";
import { PaymentsNotConfigured, WebhookSignatureError, type Payments, type PaymentsEvent } from "@/features/payments/types";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Stripe's events. The raw body is checked against the endpoint's signing secret first (a wrong or
 * missing signature → 400); without Stripe set up the endpoint does not exist (404). A handler that
 * fails answers 500, so Stripe delivers the event again (features/payments/server/webhook.ts).
 */
export async function POST(request: Request) {
  const off = paymentsOff();
  if (off) return off;
  let payments: Payments;
  try {
    payments = getPayments();
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notFound" }, 404);
    throw error;
  }
  const raw = await request.text();
  let event: PaymentsEvent;
  try {
    event = payments.verifyWebhook(raw, request.headers.get("stripe-signature"));
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notFound" }, 404);
    if (error instanceof WebhookSignatureError) return json({ ok: false, error: "signature" }, 400);
    return json({ ok: false, error: "invalid" }, 400);
  }
  const result = await handleStripeEvent(event, {
    store: supabaseWebhookStore(serviceSupabase()),
    payments,
    send: (message) => getEmailSender().send(message),
    translator: loadEmailTranslator,
    site: siteOrigin(),
    testMode,
  });
  return json({ received: true, result: result.result }, result.status);
}
