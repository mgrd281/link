import { z } from "zod";

import { checkToken, isTeamMember } from "@/features/admin/server";
import { findPrepared } from "@/features/previews/claim";
import { requireUser } from "@/lib/server/user";
import { supabaseEnabled } from "@/lib/supabase/config";

const body = z.object({
  email: z.email().max(254),
  username: z.string().max(30),
  invite: z.string().max(64).optional(),
  locale: z.enum(["de", "en", "ar"]),
});

const noStore = { "Cache-Control": "no-store" };

/**
 * The team: the team token (the code entered in this browser), or a signed-in account that
 * `admin_me()` names a team role, checked as that account (the same test as `/api/admin/prepared`).
 */
async function teamCaller(request: Request): Promise<boolean> {
  if (checkToken(request.headers.get("authorization"))) return true;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return false;
  const { data, error } = await signedIn.db.rpc("admin_me");
  return !error && isTeamMember(data);
}

/**
 * Sign-up asks here whether the Linkyo team prepared a page for this email (see claim.ts).
 *
 * With real accounts it answers 404, as for an address that does not exist, to everyone but the team
 * (E-06): anyone else could learn, before proving any e-mail address, whether the team prepared a page
 * for an address and whose it is. The sign-up form then shows no preview of a prepared page (it reads
 * any refusal as "none"); `/api/auth/code` still gives the page to the address it was prepared for,
 * and the code proves the address. A demo build (no real accounts) answers as before.
 */
export async function POST(request: Request) {
  if (supabaseEnabled && !(await teamCaller(request))) return Response.json({ kind: "none" }, { status: 404, headers: noStore });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ kind: "none" }, { status: 400, headers: noStore });
  return Response.json(findPrepared(parsed.data), { headers: noStore });
}
