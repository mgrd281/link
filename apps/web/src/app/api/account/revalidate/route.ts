import { z } from "zod";

import { revalidateCreatorPages, usernameOf } from "@/features/creator/revalidate";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const body = z.object({ previous: z.string().max(64).optional() });

/**
 * "My page moved": called by the dashboard right after the signed-in account changed its address
 * (`change_username` runs from the browser under row-level security, so the server learns of it
 * here). Drops the cached copy at the new address (a visitor may have met a 404 there a moment ago)
 * and at the one it had before (`previous`), where the old page would otherwise show once more.
 * `previous` comes from the browser: it only ever makes one address render afresh on its next visit.
 */
export async function POST(request: Request) {
  const input = body.safeParse(await request.json().catch(() => ({})));
  if (!input.success) return Response.json({ ok: false, error: "invalid" }, { status: 400, headers: noStore });
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  revalidateCreatorPages(await usernameOf(signedIn.db, signedIn.user.id), input.data.previous);
  return Response.json({ ok: true }, { headers: noStore });
}
