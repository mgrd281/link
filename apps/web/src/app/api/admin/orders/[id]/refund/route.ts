import { getEmailSender } from "@/features/email/send";
import { refundIssued } from "@/features/email/templates/refund-issued";
import type { EmailLocale } from "@/features/email/templates/render";
import { loadEmailTranslator, orderRefundable, RefundNotRecorded, resolveOrderRefund, supabaseContractsDb } from "@/features/payments/server/contracts";
import { getPayments, json, paymentsOff, testMode } from "@/features/payments/server/get-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];

/**
 * The voluntary money-back (or any full refund the team decides): `admin_order_refund_target` as the
 * team member (SQL checks `billing.manage`), the refund at Stripe (idempotent: the key is derived
 * from the payment and the amount, so a double click never refunds twice), `record_refund` with kind
 * `voluntary`, then the "refund issued" e-mail.
 *
 * Stripe's `charge.refunded` may reach the webhook before or after the record here; either way the
 * order ends as `voluntary` (`record_refund` lets this kind replace the webhook's "goodwill"). When
 * the record fails after Stripe refunded, the route answers 500 and the same request can be sent
 * again, also once the webhook has marked the order refunded (`orderRefundable`).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = paymentsOff();
  if (off) return off;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);

  const target = await signedIn.db.rpc("admin_order_refund_target", { target: id });
  if (target.error) {
    if (target.error.message.includes("linkyo:forbidden")) return json({ ok: false, error: "forbidden" }, 403);
    if (target.error.message.includes("linkyo:notFound")) return json({ ok: false, error: "notFound" }, 404);
    return json({ ok: false, error: "server" }, 500);
  }
  const refundTarget = (target.data ?? {}) as Record<string, unknown>;
  const paymentIntent = typeof refundTarget.paymentIntent === "string" ? refundTarget.paymentIntent : null;
  const amountCents = typeof refundTarget.amountCents === "number" ? refundTarget.amountCents : 0;
  if (!paymentIntent || amountCents <= 0) return json({ ok: false, error: "noPayment" }, 409);

  const db = serviceSupabase();
  const order = await db.from("orders").select("number, locale, status, refund_kind, customer_email, customer_name, profile_id").eq("id", id).maybeSingle();
  const row = order.data;
  if (order.error || !row) return json({ ok: false, error: "server" }, 500);
  if (!orderRefundable({ status: row.status, refundKind: row.refund_kind })) return json({ ok: false, error: "locked" }, 409);

  try {
    await resolveOrderRefund({ paymentIntent, amountCents }, { db: supabaseContractsDb(db), payments: () => getPayments() });
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    if (error instanceof RefundNotRecorded) {
      // The money is on its way back but the order does not say so yet: the team sends it again.
      console.error(JSON.stringify({ evt: "order_refund_unrecorded" }));
      return json({ ok: false, error: "server" }, 500);
    }
    console.error(JSON.stringify({ evt: "order_refund_failed", error: error instanceof Error ? error.name : "unknown" }));
    return json({ ok: false, error: "stripe" }, 502);
  }

  let to = row.customer_email;
  if (row.profile_id) {
    const user = await db.auth.admin.getUserById(row.profile_id);
    if (user.data.user?.email) to = user.data.user.email;
  }
  const locale = LOCALES.find((candidate) => candidate === row.locale) ?? "de";
  let mailed = false;
  try {
    const t = await loadEmailTranslator(locale);
    await getEmailSender().send(refundIssued({ to, locale, name: row.customer_name, number: row.number, amountCents, testMode }, t));
    mailed = true;
  } catch (mailError) {
    console.error(JSON.stringify({ evt: "refund_mail_failed", error: mailError instanceof Error ? mailError.message : "unknown" }));
  }
  return json({ ok: true, mailed });
}
