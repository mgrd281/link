import { NO_IMAGE, profileSchema } from "@linkyo/blocks";
import { after } from "next/server";

import { aiRunRequestSchema, pipelineInput } from "@/features/ai/request";
import { createPlanCaller } from "@/features/ai/server/claude";
import { aiConfigured } from "@/features/ai/server/config";
import { createLimitsClient } from "@/features/ai/server/limits-client";
import { runPipeline } from "@/features/ai/server/pipeline";
import { hasReadableSource } from "@/features/ai/server/sources/classify";
import { createSseSink } from "@/features/ai/server/sse";
import { ipForLog, requestPlace } from "@/lib/request-context";
import { ipHash } from "@/lib/server/ip-hash";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";
export const maxDuration = 300;

const json = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Starts an AI draft and streams its progress as server-sent events. This route only answers 404
 * (AI off), 401 (not signed in) and 400 (a bad request, or no sentence and nothing to read);
 * everything else, including a refused reservation, arrives as events on a 200 stream. The run does
 * not depend on the connection: it is kept alive with `after()` and saves its result either way.
 */
export async function POST(request: Request) {
  if (!aiConfigured()) return json({ ok: false, error: "notFound" }, 404);
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;

  const parsed = aiRunRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  // The sentence may stay empty only when there is something the server can read.
  if (parsed.data.about.length === 0 && !hasReadableSource(parsed.data.sources)) return json({ ok: false, error: "about" }, 400);

  const { user, db } = signedIn;
  const [{ data: profile }, { data: site }] = await Promise.all([
    db.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    db.from("sites").select("page").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (!profile?.username) return json({ ok: false, error: "notFound" }, 404);
  const current = profileSchema.partial().safeParse((site?.page as { profile?: unknown } | null)?.profile ?? {});
  const avatar = current.success && current.data.avatar ? current.data.avatar : { src: NO_IMAGE, alt: "" };

  const sink = createSseSink();
  const run = runPipeline(
    {
      input: pipelineInput(parsed.data),
      account: user.id,
      ipHash: ipHash(ipForLog(requestPlace(request.headers))),
      owner: { username: profile.username, currentName: current.success ? current.data.displayName : undefined, avatar },
    },
    {
      emit: sink.emit,
      limits: createLimitsClient(),
      claude: createPlanCaller(),
      ...(process.env.AI_ENRICH_OFF === "1" ? { enrich: null } : {}),
    },
  )
    .catch(() => undefined)
    .finally(() => {
      sink.close();
    });
  // Keep the function alive until the draft is saved, even if the tab closes.
  after(() => run);

  return new Response(sink.stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
