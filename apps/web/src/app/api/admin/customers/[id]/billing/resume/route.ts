import { changeSubscription, logMoneyDone, NotRecorded, refusal } from "@/features/admin/billing";
import { getPayments, json } from "@/features/payments/server/get-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { paymentsEnabled } from "@/lib/flags";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The team takes back its own cancellation of a customer's Stripe Pro before it takes effect:
 * `admin_pro_subscription_target` as the team member (SQL checks `billing.manage`; a cancellation the
 * customer made through /kuendigen is refused with 409 `customerCancelled`: it is taken back under
 * withdrawals and cancellations, with the customer's request), Stripe clears `cancel_at_period_end`
 * and `cancel_at`, Stripe's answer is recorded with `upsert_pro_subscription`, then the activity log
 * as the member. Pro then renews as usual. Without payments: 409 `paymentsOff`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!paymentsEnabled) {
    return json({ ok: false, error: "paymentsOff", message: "Payments are switched off on this deployment: nothing was sent to Stripe." }, 409);
  }
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);

  const target = await signedIn.db.rpc("admin_pro_subscription_target", { customer: id, action: "resume" });
  if (target.error) {
    const refused = refusal(target.error);
    return json({ ok: false, error: refused.error }, refused.status);
  }
  const found = (target.data ?? {}) as Record<string, unknown>;
  const subscription = typeof found.subscription === "string" ? found.subscription : null;
  if (!subscription) return json({ ok: false, error: "notFound" }, 404);

  let db: ReturnType<typeof serviceSupabase>;
  try {
    db = serviceSupabase();
  } catch {
    // No server key for the database: nothing was sent to Stripe.
    return json({ ok: false, error: "notConfigured" }, 503);
  }
  try {
    const { endsAt } = await changeSubscription(
      "resume",
      { subscription, stripeCustomer: typeof found.stripeCustomer === "string" ? found.stripeCustomer : null },
      {
        cancelAtPeriodEnd: (sub) => getPayments().cancelAtPeriodEnd(sub),
        resume: (sub) => getPayments().resume(sub),
        record: async (input) => {
          const { error } = await db.rpc("upsert_pro_subscription", {
            account: id,
            customer: input.customer,
            subscription: input.subscription,
            next: input.next,
            period_end: input.periodEnd,
            cancel_at_end: input.cancelAtEnd,
            ...(input.cancelAt ? { cancel_at: input.cancelAt } : {}),
          });
          if (error) throw new Error(error.message);
        },
      },
    );
    await logMoneyDone(signedIn.db, id, "resume", subscription);
    return json({ ok: true, mailed: false, endsAt });
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    if (error instanceof NotRecorded) {
      console.error(JSON.stringify({ evt: "subscription_resume_unrecorded" }));
      return json({ ok: false, error: "notRecorded" }, 500);
    }
    console.error(JSON.stringify({ evt: "subscription_resume_failed", error: error instanceof Error ? error.name : "unknown" }));
    return json({ ok: false, error: "stripe" }, 502);
  }
}
