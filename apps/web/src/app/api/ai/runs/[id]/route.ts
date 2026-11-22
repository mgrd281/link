import { aiConfigured } from "@/features/ai/server/config";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * A run's state, for a client whose stream broke: read as the signed-in user (row-level security
 * shows only their own runs; for a team run, the team member who started it), without money,
 * tokens or the address hash.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!aiConfigured()) return json({ ok: false, error: "notFound" }, 404);
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);
  const { data, error } = await signedIn.db.from("ai_runs").select("status, progress, counted, error_code, result").eq("id", id).maybeSingle();
  if (error || !data) return json({ ok: false, error: "notFound" }, 404);
  return json({ status: data.status, progress: data.progress, counted: data.counted, errorCode: data.error_code, result: data.result });
}
