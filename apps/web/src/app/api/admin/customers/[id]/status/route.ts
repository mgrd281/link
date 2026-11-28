import { z } from "zod";

import { revalidateCreatorPages } from "@/features/creator/revalidate";
import { decide } from "@/features/moderation/server/decide";
import { decideDeps } from "@/features/moderation/server/deps";
import { GROUNDS, LIMITS } from "@/features/moderation/types";
import { requireUser } from "@/lib/server/user";

import { customerAddress } from "../../username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const body = z.discriminatedUnion("next", [
  z.object({ next: z.literal("active") }),
  z.object({
    next: z.literal("suspended"),
    reason: z.string().trim().min(LIMITS.reason.min).max(LIMITS.reason.max),
    ground: z.enum(GROUNDS),
  }),
]);

/**
 * The team suspends a customer or lets them back in.
 *
 * - Suspending needs a reason and a ground (the statement of reasons, Art. 17 DSA): it is a team
 *   decision like those on reports (`admin_moderate(…, 'suspend', …)` as the member: `reports.manage`
 *   and `customers.manage`, the account signed out everywhere, the activity log), and the statement
 *   goes to the account's own address. On a database without that function it is suspended as before
 *   (`admin_set_status`) and the answer says the reason was not recorded (`recorded: false`).
 * - Letting the account back in is `admin_set_status(…, 'active')`, which also lifts the suspension.
 *
 * Then the cached copies of the public page and project pages are dropped, so a suspended page is gone
 * on the very next visit and a restored one is back at once.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = z.uuid().safeParse(id);
  const input = body.safeParse(await request.json().catch(() => null));
  if (!customer.success || !input.success) return Response.json({ ok: false, error: "invalid" }, { status: 400, headers: noStore });
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;

  if (input.data.next === "suspended") {
    const result = await decide(
      { decision: "suspend", customer: customer.data, reason: input.data.reason, ground: input.data.ground, block: null, report: null },
      decideDeps(signedIn.db),
    );
    if (result.body.ok) return Response.json({ ...result.body, recorded: true }, { headers: noStore });
    if (result.body.error !== "unavailable") return Response.json(result.body, { status: result.status, headers: noStore });
    // A database before 20261128100000_reports.sql: suspend as before, without the reason on record.
    const { error } = await signedIn.db.rpc("admin_set_status", { customer: customer.data, next: "suspended" });
    if (error) {
      const forbidden = error.code === "42501";
      return Response.json({ ok: false, error: forbidden ? "forbidden" : "server" }, { status: forbidden ? 403 : 500, headers: noStore });
    }
    const { username, slugs } = await customerAddress(customer.data);
    revalidateCreatorPages([username], slugs);
    return Response.json({ ok: true, recorded: false, creatorMailed: false, reporterMailed: false }, { headers: noStore });
  }

  const { error } = await signedIn.db.rpc("admin_set_status", { customer: customer.data, next: "active" });
  if (error) {
    const forbidden = error.code === "42501";
    return Response.json({ ok: false, error: forbidden ? "forbidden" : "server" }, { status: forbidden ? 403 : 500, headers: noStore });
  }
  const { username, slugs } = await customerAddress(customer.data);
  revalidateCreatorPages([username], slugs);
  return Response.json({ ok: true }, { headers: noStore });
}
