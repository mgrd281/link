import { z } from "zod";

import { logMoneyDone, NotRecorded, refundInvoice, refusal } from "@/features/admin/billing";
import { getEmailSender } from "@/features/email/send";
import { refundIssued } from "@/features/email/templates/refund-issued";
import type { EmailLocale } from "@/features/email/templates/render";
import { loadEmailTranslator } from "@/features/payments/server/contracts";
import { getPayments, json, readJson, testMode } from "@/features/payments/server/get-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { paymentsEnabled } from "@/lib/flags";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];
const body = z.object({ invoice: z.string().regex(/^[\w-]{1,120}$/) });

/**
 * The team refunds a paid Pro invoice, through Stripe (the pattern of the orders refund):
 * `admin_pro_refund_target` as the team member (SQL checks `billing.manage` and refuses an invoice
 * that is not paid or whose subscription waits for a withdrawal decision), the refund at Stripe (one
 * idempotency key per invoice, so a second click never refunds twice), the record as Stripe's
 * webhook writes it, the activity log as the member (only now: it says what happened), then the
 * "refund issued" e-mail. The console says "refunded" only after this answers ok. Without payments
 * on this deployment nothing goes to Stripe: 409 `paymentsOff`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!paymentsEnabled) {
    return json({ ok: false, error: "paymentsOff", message: "Payments are switched off on this deployment: nothing was sent to Stripe." }, 409);
  }
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const { invoice } = parsed.data;

  // The member's permission and the invoice, checked as the member before any money moves.
  const target = await signedIn.db.rpc("admin_pro_refund_target", { customer: id, invoice });
  if (target.error) {
    const refused = refusal(target.error);
    return json({ ok: false, error: refused.error }, refused.status);
  }
  const found = (target.data ?? {}) as Record<string, unknown>;
  const paymentIntent = typeof found.paymentIntent === "string" ? found.paymentIntent : null;
  const amountCents = typeof found.amountCents === "number" ? found.amountCents : 0;
  if (!paymentIntent || amountCents <= 0) return json({ ok: false, error: "noPayment" }, 409);

  let db: ReturnType<typeof serviceSupabase>;
  try {
    db = serviceSupabase();
  } catch {
    // No server key for the database: nothing was sent to Stripe.
    return json({ ok: false, error: "notConfigured" }, 503);
  }
  try {
    await refundInvoice(
      { invoice, paymentIntent, amountCents },
      {
        refund: (input) => getPayments().refund(input),
        record: async (payment, amount) => {
          const { data, error } = await db.rpc("record_refund", { payment_intent: payment, kind: "goodwill", amount });
          if (error) throw new Error(error.message);
          if (data !== "ok") throw new Error(`record_refund: ${data}`);
        },
      },
    );
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    if (error instanceof NotRecorded) {
      // The money is on its way back but the invoice does not say so yet: the team sends it again.
      console.error(JSON.stringify({ evt: "invoice_refund_unrecorded" }));
      return json({ ok: false, error: "notRecorded" }, 500);
    }
    console.error(JSON.stringify({ evt: "invoice_refund_failed", error: error instanceof Error ? error.name : "unknown" }));
    return json({ ok: false, error: "stripe" }, 502);
  }
  await logMoneyDone(signedIn.db, id, "refund", invoice);

  // The account's own address; production sends nothing until a mail transport is set up.
  let mailed = false;
  try {
    const user = await db.auth.admin.getUserById(id);
    const to = user.data.user?.email;
    if (to) {
      const locale = LOCALES.find((candidate) => candidate === found.locale) ?? "de";
      const t = await loadEmailTranslator(locale);
      await getEmailSender().send(refundIssued({ to, locale, name: null, number: "Linkyo Pro", amountCents, testMode }, t));
      mailed = true;
    }
  } catch (mailError) {
    console.error(JSON.stringify({ evt: "refund_mail_failed", error: mailError instanceof Error ? mailError.message : "unknown" }));
  }
  return json({ ok: true, mailed });
}
