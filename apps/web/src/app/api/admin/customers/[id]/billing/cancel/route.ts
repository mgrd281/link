import { changeSubscription, logMoneyDone, NotRecorded, refusal } from "@/features/admin/billing";
import { getEmailSender } from "@/features/email/send";
import { cancellationConfirmation } from "@/features/email/templates/cancellation-confirmation";
import type { EmailLocale } from "@/features/email/templates/render";
import { loadEmailTranslator } from "@/features/payments/server/contracts";
import { getPayments, json } from "@/features/payments/server/get-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { paymentsEnabled } from "@/lib/flags";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];

/**
 * The team cancels a customer's Stripe Pro at the end of the paid period:
 * `admin_pro_subscription_target` as the team member (SQL checks `billing.manage`),
 * `cancel_at_period_end` at Stripe, Stripe's answer recorded with `upsert_pro_subscription` (as the
 * webhook writes it), the activity log as the member, then the cancellation confirmation with the
 * end date to the account's own address. Pro the team gave by hand has no Stripe subscription (404
 * `notFound`): the console changes that one without money. Without payments on this deployment: 409
 * `paymentsOff`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!paymentsEnabled) {
    return json({ ok: false, error: "paymentsOff", message: "Payments are switched off on this deployment: nothing was sent to Stripe." }, 409);
  }
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);

  const target = await signedIn.db.rpc("admin_pro_subscription_target", { customer: id, action: "cancel" });
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
  let endsAt: string | null;
  try {
    ({ endsAt } = await changeSubscription(
      "cancel",
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
    ));
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    if (error instanceof NotRecorded) {
      // Stripe ends it at the period end; the next webhook or a second click records it.
      console.error(JSON.stringify({ evt: "subscription_cancel_unrecorded" }));
      return json({ ok: false, error: "notRecorded" }, 500);
    }
    console.error(JSON.stringify({ evt: "subscription_cancel_failed", error: error instanceof Error ? error.name : "unknown" }));
    return json({ ok: false, error: "stripe" }, 502);
  }
  await logMoneyDone(signedIn.db, id, "cancel", subscription);

  let mailed = false;
  try {
    const user = await db.auth.admin.getUserById(id);
    const to = user.data.user?.email;
    if (to) {
      const locale = LOCALES.find((candidate) => candidate === found.locale) ?? "de";
      const t = await loadEmailTranslator(locale);
      await getEmailSender().send(cancellationConfirmation({ to, locale, name: null, receivedAt: new Date(), endsAt: endsAt ? new Date(endsAt) : null }, t));
      mailed = true;
    }
  } catch (mailError) {
    console.error(JSON.stringify({ evt: "cancellation_mail_failed", error: mailError instanceof Error ? mailError.message : "unknown" }));
  }
  return json({ ok: true, mailed, endsAt });
}
