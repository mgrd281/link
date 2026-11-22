import { aiConfigured } from "@/features/ai/server/config";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Asks a run to stop. Only its owner can (checked in SQL); the run notices within two seconds, keeps
 * the blocks that already arrived and counts only when there are some. Works from any instance.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!aiConfigured()) return json({ ok: false, error: "notFound" }, 404);
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);
  const { data, error } = await signedIn.db.rpc("ai_request_stop", { run: id });
  if (error) return json({ ok: false, error: "server" }, 500);
  if (data === "notFound") return json({ ok: false, error: "notFound" }, 404);
  // "finished": the run ended before the stop arrived; nothing left to stop.
  return json({ ok: true, finished: data === "finished" });
}
