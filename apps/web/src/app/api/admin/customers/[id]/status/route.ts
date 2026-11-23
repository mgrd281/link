import { z } from "zod";

import { revalidateCreatorPages } from "@/features/creator/revalidate";
import { requireUser } from "@/lib/server/user";

import { customerAddress } from "../../username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const body = z.object({ next: z.enum(["active", "suspended"]) });

/**
 * The team suspends a customer or lets them back in: `admin_set_status` runs as the team member (the
 * database checks the `customers.manage` permission, signs a suspended account out and writes the
 * activity log), then the cached copies of the customer's public page and project pages are dropped,
 * so a suspended page is gone on the very next visit (a takedown after a report) and a restored one
 * is back at once.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = z.uuid().safeParse(id);
  const input = body.safeParse(await request.json().catch(() => null));
  if (!customer.success || !input.success) return Response.json({ ok: false, error: "invalid" }, { status: 400, headers: noStore });
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { error } = await signedIn.db.rpc("admin_set_status", { customer: customer.data, next: input.data.next });
  if (error) {
    const forbidden = error.code === "42501";
    return Response.json({ ok: false, error: forbidden ? "forbidden" : "serverError" }, { status: forbidden ? 403 : 500, headers: noStore });
  }
  const { username, slugs } = await customerAddress(customer.data);
  revalidateCreatorPages([username], slugs);
  return Response.json({ ok: true }, { headers: noStore });
}
