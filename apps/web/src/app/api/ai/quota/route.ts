import { aiConfigured } from "@/features/ai/server/config";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * How many AI drafts the signed-in owner has left: `{ enabled, plan, allowance, used, left, period,
 * resetsAt }` (`enabled` is false while the team has switched the AI off).
 */
export async function GET(request: Request) {
  if (!aiConfigured()) return json({ ok: false, error: "notFound" }, 404);
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { data, error } = await signedIn.db.rpc("my_ai_quota");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return json({ ok: false, error: "server" }, 500);
  return json({ enabled: data.enabled === true, ...data });
}
