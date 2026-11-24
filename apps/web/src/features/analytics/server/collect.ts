import { parseUserAgent } from "@/features/account/device";
import { analyticsEnabled } from "@/lib/flags";
import { requestPlace } from "@/lib/request-context";
import { requireUser } from "@/lib/server/user";
import { supabaseEnabled } from "@/lib/supabase/config";
import { serviceSupabase, type Db } from "@/lib/supabase/server";

import { missingStats, parseOwnerStats } from "../answer";
import { addDays, berlinDay } from "../days";
import { fromOwnPage, isBot, isPrefetch, optedOut } from "../filter";
import { referrerGroup } from "../referrer";
import { visitorHash } from "../visitor";

/**
 * The server side of the cookie-free statistics (draft ADR "cookie-free analytics"):
 * - `collect` takes the beacon of a creator page (a view, or a tap on one of its blocks) and counts it
 *   through `page_stats_record`. Whatever happens it answers 204 with no body, so a script learns
 *   nothing from it; with the switch off (lib/flags.ts) it stores nothing at all.
 * - `ownerStats` hands the signed-in owner their own numbers (`my_page_stats`, as them).
 * Nothing here keeps the network address or the browser string: they go into the visitor hash and
 * into the device class ("mobile", "tablet", "desktop"), and are dropped with the request.
 */

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const nothing = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** The beacon's body: { p: page name, t: "v" (view) | "c" (tap), b: block id, r: referring host, s: "qr" }. */
export interface Beacon {
  page: string;
  kind: "view" | "click";
  block?: string | undefined;
  referrer: string;
  source?: "qr" | undefined;
}

const PAGE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/i;
const BLOCK = /^[\w.:-]{1,80}$/;
/** A beacon is a few dozen bytes; anything much larger is not one. */
const MAX_BODY = 1024;

/** The beacon's body, checked; null when it is not one. */
export function parseBeacon(text: string): Beacon | null {
  if (text.length > MAX_BODY) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const { p, t, b, r, s } = raw as Record<string, unknown>;
  if (typeof p !== "string" || !PAGE.test(p)) return null;
  if (t === "v") return { page: p, kind: "view", referrer: typeof r === "string" ? r.slice(0, 253) : "", ...(s === "qr" ? { source: "qr" as const } : {}) };
  if (t === "c" && typeof b === "string" && BLOCK.test(b)) return { page: p, kind: "click", block: b, referrer: "" };
  return null;
}

/** The arguments of `page_stats_record` for one beacon: a hash, groups and classes, nothing that names a person. */
export function recordArgs(beacon: Beacon, input: { salt: string; host: string; address: string; userAgent: string; country?: string | undefined }) {
  const visitor = visitorHash(input.salt, beacon.page, input.address, input.userAgent);
  if (beacon.kind === "click") return { handle: beacon.page, kind: "click", visitor, block: beacon.block ?? "" };
  const referrer = referrerGroup(beacon.referrer, input.host, beacon.source);
  const country = input.country?.toUpperCase();
  return {
    handle: beacon.page,
    kind: "view",
    visitor,
    device: parseUserAgent(input.userAgent).type,
    ...(referrer ? { referrer } : {}),
    ...(country && /^[A-Z]{2}$/.test(country) ? { country } : {}),
  };
}

/** Today's salt, asked for once a day per server process. */
let cachedSalt: { day: string; salt: string } | null = null;

async function todaysSalt(db: Db): Promise<string | null> {
  const today = berlinDay();
  if (cachedSalt?.day === today) return cachedSalt.salt;
  const { data, error } = await db.rpc("page_stats_salt");
  if (error || typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const { day, salt } = data as { day?: unknown; salt?: unknown };
  if (typeof salt !== "string" || !/^[0-9a-f]{64}$/.test(salt)) return null;
  cachedSalt = { day: typeof day === "string" ? day : today, salt };
  return salt;
}

/** For tests: forget the cached salt. */
export function forgetSalt(): void {
  cachedSalt = null;
}

/** The host the page was served from (the platform's forwarded host first). */
const hostOf = (request: Request) => request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;

/** POST /api/collect: one view or one tap, counted when everything about it is right; always 204. */
export async function collect(request: Request): Promise<Response> {
  if (!analyticsEnabled() || !supabaseEnabled) return nothing();
  const { headers } = request;
  const host = hostOf(request);
  const userAgent = headers.get("user-agent") ?? "";
  if (optedOut(headers) || isPrefetch(headers) || !fromOwnPage(headers, host) || isBot(userAgent)) return nothing();
  if (Number(headers.get("content-length") ?? 0) > MAX_BODY) return nothing();
  const beacon = parseBeacon(await request.text().catch(() => ""));
  if (!beacon) return nothing();
  try {
    const db = serviceSupabase();
    const salt = await todaysSalt(db);
    if (!salt) return nothing();
    const place = requestPlace(headers);
    const { error } = await db.rpc("page_stats_record", recordArgs(beacon, { salt, host, address: place.ip, userAgent, country: place.country }));
    // A database without the statistics (the hosted one before the migration) simply counts nothing.
    if (error && !missingStats(error)) console.error("collect: page_stats_record failed", error.code);
  } catch (error) {
    console.error("collect: not counted", error instanceof Error ? error.message : "unknown error");
  }
  return nothing();
}

/** The ranges the dashboard offers. */
export const STATS_DAYS = [7, 30, 90] as const;

/**
 * GET /api/collect?days=7|30|90: the signed-in owner's own numbers for the last days up to today
 * (Berlin), or `{ counting: false }` while the switch is off or the database has no statistics yet.
 */
export async function ownerStats(request: Request): Promise<Response> {
  if (!supabaseEnabled) return json({ ok: false, error: "notFound" }, 404);
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  if (!analyticsEnabled()) return json({ counting: false });
  const days = Number(new URL(request.url).searchParams.get("days"));
  if (!(STATS_DAYS as readonly number[]).includes(days)) return json({ ok: false, error: "invalid" }, 400);
  const to = berlinDay();
  const from = addDays(to, -(days - 1));
  const { data, error } = await signedIn.db.rpc("my_page_stats", { from_day: from, to_day: to });
  if (error) return missingStats(error) ? json({ counting: false }) : json({ ok: false, error: "server" }, 500);
  const answer = parseOwnerStats(typeof data === "object" && data !== null && !Array.isArray(data) ? { ...data, counting: true } : null);
  return answer ? json(answer) : json({ ok: false, error: "server" }, 500);
}
