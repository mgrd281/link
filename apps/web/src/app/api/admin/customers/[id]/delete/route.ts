import { z } from "zod";

import { revalidateCreatorPages } from "@/features/creator/revalidate";
import { removeAccountFiles } from "@/lib/server/storage-purge";
import { requireUser } from "@/lib/server/user";

import { customerUsername } from "../../username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * The team deletes a customer: `admin_delete_customer` runs as the team member (the database checks
 * the `customers.delete` permission and writes the activity log), then the cached copy of the
 * customer's public page is dropped and their files leave Storage; whatever cannot be removed now
 * waits in the deletion queue.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = z.uuid().safeParse(id);
  if (!customer.success) return Response.json({ ok: false, error: "invalid" }, { status: 400, headers: noStore });
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  // Read before the deletion: afterwards nothing says which address the page had. It is used only
  // once the database has let this caller delete the customer.
  const username = await customerUsername(customer.data);
  const { error } = await signedIn.db.rpc("admin_delete_customer", { customer: customer.data });
  if (error) {
    const forbidden = error.code === "42501";
    return Response.json({ ok: false, error: forbidden ? "forbidden" : "serverError" }, { status: forbidden ? 403 : 500, headers: noStore });
  }
  revalidateCreatorPages(username);
  try {
    await removeAccountFiles(customer.data);
  } catch {
    // Even the queue could not be written: the account is deleted; the files are left for a later purge.
  }
  return Response.json({ ok: true }, { headers: noStore });
}
