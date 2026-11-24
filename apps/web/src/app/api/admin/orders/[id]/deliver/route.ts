import { z } from "zod";

import { deliver } from "@/features/admin/mail";
import { proposalDelivered } from "@/features/email/templates/proposal-delivered";
import type { EmailLocale } from "@/features/email/templates/render";
import { json, paymentsOff, readJson, siteOrigin } from "@/features/payments/server/get-payments";
import { loadEmailTranslator } from "@/features/payments/server/contracts";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const body = z.object({ proposalId: z.string().regex(UUID) });

const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];

/**
 * Hands the current round's proposal to the customer (`admin_deliver_proposal`, called as the team
 * member, so SQL checks `pages.edit`): refused while a withdrawal waits (`locked`) and, for Premium,
 * until the marketing kit is complete (`incomplete`). Then the "proposal delivered" e-mail, worded by
 * the proposal's provenance. Never touches the customer's page.
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
  const { db } = signedIn;

  // The proposal must belong to this order (read as the team member: row-level security decides).
  const owner = await db.from("site_proposals").select("order_id").eq("id", parsed.data.proposalId).maybeSingle();
  if (owner.error) return json({ ok: false, error: "server" }, 500);
  if (owner.data?.order_id !== id) return json({ ok: false, error: "notFound" }, 404);

  const { data, error } = await db.rpc("admin_deliver_proposal", { proposal: parsed.data.proposalId });
  if (error) {
    if (error.message.includes("linkyo:forbidden")) return json({ ok: false, error: "forbidden" }, 403);
    if (error.message.includes("linkyo:locked")) return json({ ok: false, error: "locked" }, 409);
    if (error.message.includes("linkyo:incomplete")) return json({ ok: false, error: "incomplete" }, 409);
    if (error.message.includes("linkyo:notFound")) return json({ ok: false, error: "notFound" }, 404);
    return json({ ok: false, error: "server" }, 500);
  }
  const result = (data ?? {}) as Record<string, unknown>;
  const locale = LOCALES.find((candidate) => candidate === result.locale) ?? "de";
  const to = typeof result.customerEmail === "string" ? result.customerEmail : "";
  // Delivered all the same when the e-mail fails: the customer sees the proposal on Home. `mailed`
  // only when a transport that delivers took it (not the console stand-in).
  const mailed = await deliver(
    async () =>
      to
        ? proposalDelivered(
            {
              to,
              locale,
              number: typeof result.number === "string" ? result.number : "",
              aiAssisted: result.aiAssisted === true,
              hasKit: result.hasKit === true,
              revisionsLeft: typeof result.revisionsLeft === "number" ? result.revisionsLeft : 0,
              reviseUntil: new Date(String(result.reviseUntil)),
              proposalId: parsed.data.proposalId,
              site: siteOrigin(),
            },
            await loadEmailTranslator(locale),
          )
        : null,
    "proposal_mail_failed",
  );
  return json({ ok: true, mailed });
}
