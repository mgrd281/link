import { decide, parseDecision } from "@/features/moderation/server/decide";
import { decideDeps } from "@/features/moderation/server/deps";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * A team decision on a report or an account (DSA Art. 16 and 17): hide one block, take the page
 * offline, suspend the account, or dismiss a report. The database decides as the signed-in member
 * (`admin_moderate`: `reports.manage`, and `customers.manage` to suspend); then the cached page is
 * dropped and the statement of reasons and the reporter's notice are sent. 200 {ok, creatorMailed,
 * reporterMailed}; 400 for a decision without its reason, ground or block; 401/403; 404/409 for what
 * the database refused; 409 `unavailable` on a database without the function.
 */
export async function POST(request: Request) {
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const input = parseDecision(await request.json().catch(() => null));
  if (!input) return Response.json({ ok: false, error: "invalid" }, { status: 400, headers: noStore });
  const result = await decide(input, decideDeps(signedIn.db));
  return Response.json(result.body, { status: result.status, headers: noStore });
}
