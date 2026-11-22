import { z } from "zod";

import { removeAccountFiles } from "@/lib/server/storage-purge";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * The team deletes a customer: `admin_delete_customer` runs as the team member (the database checks
 * the `customers.delete` permission and writes the activity log), then the customer's files leave
 * Storage; whatever cannot be removed now waits in the deletion queue.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = z.uuid().safeParse(id);
  if (!customer.success) return Response.json({ ok: false, error: "invalid" }, { status: 400, headers: noStore });
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { error } = await signedIn.db.rpc("admin_delete_customer", { customer: customer.data });
  if (error) {
    const forbidden = error.code === "42501";
    return Response.json({ ok: false, error: forbidden ? "forbidden" : "serverError" }, { status: forbidden ? 403 : 500, headers: noStore });
  }
  try {
    await removeAccountFiles(customer.data);
  } catch {
    // Even the queue could not be written: the account is deleted; the files are left for a later purge.
  }
  return Response.json({ ok: true }, { headers: noStore });
}
