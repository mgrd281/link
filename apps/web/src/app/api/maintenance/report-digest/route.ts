import { createHash, timingSafeEqual } from "node:crypto";

import { deliver } from "@/features/admin/mail";
import { teamDigest } from "@/features/email/templates/team-digest";
import { loadTranslator } from "@/features/moderation/server/submit";
import { isCategory, overdue } from "@/features/moderation/types";
import { bearer } from "@/lib/server/user";
import { siteUrl } from "@/lib/site-url";
import { supabaseEnabled } from "@/lib/supabase/config";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const notFound = () => new Response(null, { status: 404, headers: noStore });
const sameSecret = (given: string, wanted: string) =>
  timingSafeEqual(createHash("sha256").update(given).digest(), createHash("sha256").update(wanted).digest());

/**
 * The team digest (A-17): one e-mail to each member who handles reports, only when reports wait.
 * Called by a scheduled job with MAINTENANCE_SECRET as bearer token (404 for anything else; no job is
 * scheduled yet, ADR draft-notice-and-action). Answers how many waited and how many e-mails a
 * delivering transport took (`mailed`: 0 while production has no transport, F1).
 */
export async function POST(request: Request) {
  const secret = process.env.MAINTENANCE_SECRET ?? "";
  const token = bearer(request);
  if (!supabaseEnabled || secret === "" || !token || !sameSecret(token, secret)) return notFound();
  try {
    const { data, error } = await serviceSupabase().rpc("moderation_digest");
    if (error) return Response.json({ ok: false }, { status: 500, headers: noStore });
    const digest = (data ?? {}) as { open?: unknown; recipients?: unknown };
    const open = (Array.isArray(digest.open) ? digest.open : []).flatMap((item: unknown) => {
      const row = item as { category?: unknown; receivedAt?: unknown };
      return isCategory(row.category) && typeof row.receivedAt === "string" ? [{ category: row.category, receivedAt: row.receivedAt }] : [];
    });
    const recipients = (Array.isArray(digest.recipients) ? digest.recipients : []).filter((to): to is string => typeof to === "string");
    const first = open[0];
    if (!first) return Response.json({ ok: true, open: 0, mailed: 0 }, { headers: noStore });
    const now = Date.now();
    const late = open.filter((report) => overdue(report, now)).length;
    const t = await loadTranslator("de");
    let mailed = 0;
    for (const to of recipients) {
      const sent = await deliver(
        () => Promise.resolve(teamDigest({ to, locale: "de", open: open.length, overdue: late, oldest: new Date(first.receivedAt), site: siteUrl().origin }, t)),
        "report_digest_failed",
      );
      if (sent) mailed += 1;
    }
    return Response.json({ ok: true, open: open.length, mailed }, { headers: noStore });
  } catch {
    return Response.json({ ok: false }, { status: 500, headers: noStore });
  }
}
