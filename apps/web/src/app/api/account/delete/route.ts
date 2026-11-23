import { projectSlugsOf, revalidateCreatorPages, usernameOf } from "@/features/creator/revalidate";
import { removeAccountFiles } from "@/lib/server/storage-purge";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * Deletes the signed-in account (GDPR Art. 17): the database deletion runs as the user, then the
 * cached copies of their public page and its project pages are dropped (so the next visit to an
 * address is a 404, not the old page once more) and every file of the account leaves Storage (page pictures, order photos,
 * delivered story pictures). A file that cannot be removed now waits in the deletion queue; the
 * account is gone either way.
 */
export async function POST(request: Request) {
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  // Read before the deletion: afterwards nothing says which address the page and its projects had.
  const username = await usernameOf(signedIn.db, signedIn.user.id);
  const slugs = await projectSlugsOf(signedIn.db, signedIn.user.id);
  const { error } = await signedIn.db.rpc("delete_my_account");
  if (error) return Response.json({ ok: false, error: "serverError" }, { status: 500, headers: noStore });
  revalidateCreatorPages([username], slugs);
  try {
    await removeAccountFiles(signedIn.user.id);
  } catch {
    // Even the queue could not be written: the account is deleted; the files are left for the team to purge.
  }
  return Response.json({ ok: true }, { headers: noStore });
}
