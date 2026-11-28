import { z } from "zod";

import { refusal } from "@/features/moderation/server/decide";
import { LIMITS } from "@/features/moderation/types";
import { revalidateCreatorPages, projectSlugsOf } from "@/features/creator/revalidate";
import { requireUser } from "@/lib/server/user";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const body = z.object({ decision: z.uuid(), reason: z.string().trim().min(LIMITS.reason.min).max(LIMITS.reason.max) });

/**
 * The team lifts a restriction (after the creator objected, or a mistake): `admin_lift_moderation` as
 * the member, then the cached page is dropped so the block or the page is back on the next visit.
 */
export async function POST(request: Request) {
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const input = body.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ ok: false, error: "invalid" }, { status: 400, headers: noStore });
  const { data, error } = await signedIn.db.rpc("admin_lift_moderation", { decision: input.data.decision, why: input.data.reason });
  if (error) {
    const refused = refusal(error);
    return Response.json({ ok: false, error: refused.error }, { status: refused.status, headers: noStore });
  }
  const lifted = (typeof data === "object" && data !== null ? data : {}) as { customer?: unknown; username?: unknown };
  let slugs: string[] = [];
  try {
    if (typeof lifted.customer === "string") slugs = await projectSlugsOf(serviceSupabase(), lifted.customer);
  } catch {
    slugs = [];
  }
  revalidateCreatorPages([typeof lifted.username === "string" ? lifted.username : null], slugs);
  return Response.json({ ok: true }, { headers: noStore });
}
