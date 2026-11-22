import { z } from "zod";

import { getEmailSender } from "@/features/email/send";
import type { EmailLocale } from "@/features/email/templates/render";
import { revisionReceived } from "@/features/email/templates/revision-received";
import { revisionDue } from "@/features/payments/delivery";
import { loadEmailTranslator } from "@/features/payments/server/contracts";
import { json, paymentsOff, readJson } from "@/features/payments/server/get-payments";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const body = z.object({ message: z.string().trim().min(1).max(2000) });
const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];
const REFUSALS = new Set(["noneLeft", "expired", "locked"]);

/**
 * The customer asks for changes to a delivered proposal: one message, a due date two working days
 * ahead (18:00 Berlin), `record_revision` for the signed-in account only (it checks the rounds left,
 * the 14 days and a pending withdrawal), then the "we have your changes" e-mail.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = paymentsOff();
  if (off) return off;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

  const db = serviceSupabase();
  const due = revisionDue(new Date());
  const { data, error } = await db.rpc("record_revision", { proposal: id, account: signedIn.user.id, message: parsed.data.message, due: due.toISOString() });
  if (error) return json({ ok: false, error: "server" }, 500);
  if (data === "notFound") return json({ ok: false, error: "notFound" }, 404);
  if (REFUSALS.has(data)) return json({ ok: false, error: data }, 409);
  if (data !== "ok") return json({ ok: false, error: "server" }, 500);

  let mailed = false;
  try {
    const proposal = await db.from("site_proposals").select("order_id").eq("id", id).single();
    const order = proposal.data ? await db.from("orders").select("number, locale, customer_name").eq("id", proposal.data.order_id).single() : null;
    if (order?.data && signedIn.user.email) {
      const locale = LOCALES.find((candidate) => candidate === order.data.locale) ?? "de";
      const t = await loadEmailTranslator(locale);
      await getEmailSender().send(revisionReceived({ to: signedIn.user.email, locale, name: order.data.customer_name, number: order.data.number, dueAt: due }, t));
      mailed = true;
    }
  } catch (mailError) {
    console.error(JSON.stringify({ evt: "revision_mail_failed", error: mailError instanceof Error ? mailError.message : "unknown" }));
  }
  return json({ ok: true, dueAt: due.toISOString(), mailed });
}
