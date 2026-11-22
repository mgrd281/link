import { NO_IMAGE, profileSchema } from "@linkyo/blocks";
import { after } from "next/server";

import type { AiRunEvent } from "@/features/ai/events";
import { createPlanCaller } from "@/features/ai/server/claude";
import { aiConfigured } from "@/features/ai/server/config";
import { createLimitsClient } from "@/features/ai/server/limits-client";
import { runPipeline } from "@/features/ai/server/pipeline";
import { createSseSink } from "@/features/ai/server/sse";
import { teamRunInput } from "@/features/ai/server/team-input";
import { ipForLog, requestPlace } from "@/lib/request-context";
import { ipHash } from "@/lib/server/ip-hash";
import { requireUser } from "@/lib/server/user";
import { toJson } from "@/lib/supabase/json";

export const runtime = "nodejs";
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES = ["de", "en", "ar"] as const;
type Locale = (typeof LOCALES)[number];

const json = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const localeOf = (value: unknown): Locale | null => LOCALES.find((candidate) => candidate === value) ?? null;
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/**
 * A team member's AI draft for an order (Start). The run belongs to the team member (route "team":
 * `profile_id` = the member, `order_id` = the order), so the customer never sees, waits for or stops
 * it, and it never counts against their quota. Input: the order's briefing (`teamRunInput`). Same
 * event stream as `/api/ai/runs`; when the draft is ready it is saved as the round's proposal with
 * `admin_save_proposal` (as the team member) before `done` reaches the browser. Never writes `sites`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!aiConfigured()) return json({ ok: false, error: "notFound" }, 404);
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);
  const { user, db } = signedIn;

  const allowed = await db.rpc("has_permission", { wanted: "pages.edit" });
  if (allowed.error) return json({ ok: false, error: "server" }, 500);
  if (!allowed.data) return json({ ok: false, error: "forbidden" }, 403);

  const loaded = await db.rpc("admin_order", { target: id });
  if (loaded.error) {
    if (loaded.error.message.includes("linkyo:notFound")) return json({ ok: false, error: "notFound" }, 404);
    if (loaded.error.message.includes("linkyo:forbidden")) return json({ ok: false, error: "forbidden" }, 403);
    return json({ ok: false, error: "server" }, 500);
  }
  const order = record(loaded.data);
  if (order.withdrawalPending === true || order.status === "refunded" || order.status === "withdrawn") return json({ ok: false, error: "locked" }, 409);
  if (order.package !== "start") return json({ ok: false, error: "package" }, 409);
  const briefing = record(order.briefing);
  if (!order.briefing) return json({ ok: false, error: "noBriefing" }, 409);
  const customer = record(order.customer);
  const site = record(order.site);
  const page = record(site.page);
  const username = typeof customer.username === "string" ? customer.username : "";
  if (!username) return json({ ok: false, error: "notFound" }, 404);

  const current = profileSchema.partial().safeParse(page.profile ?? {});
  const avatar = current.success && current.data.avatar ? current.data.avatar : { src: NO_IMAGE, alt: "" };
  const input = teamRunInput(
    { locale: localeOf(order.locale) ?? "de", displayName: current.success ? (current.data.displayName ?? null) : null, kind: typeof site.kind === "string" ? site.kind : null },
    {
      links: Array.isArray(briefing.links) ? briefing.links.filter((link): link is string => typeof link === "string") : [],
      wishes: typeof briefing.wishes === "string" ? briefing.wishes : "",
      pageLocale: localeOf(briefing.pageLocale) ?? localeOf(order.locale) ?? "de",
    },
  );

  const sink = createSseSink();
  // `done` waits until the proposal is saved, so the browser never shows a draft that is not stored.
  const held: { done: Extract<AiRunEvent, { type: "done" }> | null } = { done: null };
  const emit = (event: AiRunEvent) => {
    if (event.type === "done") held.done = event;
    else sink.emit(event);
  };
  const run = runPipeline(
    {
      input,
      account: user.id,
      order: id,
      ipHash: ipHash(ipForLog(requestPlace(request.headers))),
      owner: { username, currentName: current.success ? current.data.displayName : undefined, avatar },
    },
    { emit, limits: createLimitsClient(), claude: createPlanCaller(), ...(process.env.AI_ENRICH_OFF === "1" ? { enrich: null } : {}) },
  )
    .then(async () => {
      const done = held.done;
      if (!done) return;
      const saved = await db.rpc("admin_save_proposal", {
        target: id,
        page: toJson(done.page),
        theme: toJson(done.theme),
        kind: done.kind,
      });
      if (saved.error) {
        sink.emit({ type: "error", code: saved.error.message.includes("linkyo:locked") ? "invalid" : "server", counted: false });
        return;
      }
      sink.emit(done);
    })
    .catch(() => undefined)
    .finally(() => {
      sink.close();
    });
  // Keep the function alive until the proposal is saved, even if the tab closes.
  after(() => run);

  return new Response(sink.stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
