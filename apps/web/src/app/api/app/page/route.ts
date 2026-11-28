import { getTranslations } from "next-intl/server";

import { isBlocked } from "@/features/account/server/auth";
import { newBlockId } from "@/features/app/blocks";
import { projectSlugs, revalidateCreatorPages } from "@/features/creator/revalidate";
import { lookupLinkMetadata } from "@/lib/link-metadata";
import { addressKey, MINUTE, rateLimit, retryHeaders, valueKey, type Verdict } from "@/lib/rate-limit";
import { requestPlace } from "@/lib/request-context";
import { readBody } from "@/lib/server/read-body";
import { requireUser } from "@/lib/server/user";
import { SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import { toJson } from "@/lib/supabase/json";
import { serviceSupabase } from "@/lib/supabase/server";

import { applyOps, bodySchema, MAX_BODY, MAX_OPS } from "./ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const answer = (body: object, status = 200) => Response.json(body, { status, headers: noStore });

/**
 * Each call may ask a platform for details (an `add`) and drops the cached public page. A native
 * change is one deliberate act (a link added, a block moved; the share extension sends one): 30 calls
 * per account and 120 per client address (room for a shared address) a minute. The address limit
 * comes first, before Auth is asked.
 */
const ACCOUNT_LIMIT = rateLimit({ name: "app-page-account", max: 30, windowMs: MINUTE });
const ADDRESS_LIMIT = rateLimit({ name: "app-page-address", max: 120, windowMs: MINUTE });
/** 429 `tooManyRequests`: the app waits `Retry-After` seconds, then tries once more (ADR 0088). */
const tooMany = (verdict: Extract<Verdict, { ok: false }>) =>
  Response.json({ ok: false, error: "tooManyRequests" }, { status: 429, headers: retryHeaders(verdict) });

/** A method this route does not take, OPTIONS included (no browser preflight is served): 405 with `no-store`. */
const notAllowed = () => new Response(null, { status: 405, headers: { ...noStore, Allow: "POST" } });
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE, notAllowed as OPTIONS };

const LOCALES = ["de", "en", "ar"] as const;
type Locale = (typeof LOCALES)[number];
const localeOf = (...candidates: unknown[]): Locale => candidates.find((value): value is Locale => (LOCALES as readonly unknown[]).includes(value)) ?? "de";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The database refused the page for its size (`sites.site_size`). */
const tooLarge = (error: { code?: string; message?: string }) => error.code === "23514" && (error.message ?? "").includes("site_size");

/**
 * The iPhone app's page changes (ADR 0088): its Home, Add sheet, block list and share
 * extension change the page through here, never by writing block JSON themselves.
 *
 *   POST { baseUpdatedAt, ops: [{ op: "add", url } | { op: "addImage", src, alt, w, h }
 *        | { op: "move", id, to } | { op: "show", id, visible } | { op: "remove", id }] }
 *   200  { ok: true, updatedAt, changed: [ids], added: [ids] }
 *
 * - Bearer only (`requireUser`); the read and the write run as the account, under row-level security.
 *   401 only for a token Supabase Auth turned down (the app signs out on it); 503 when Auth could not
 *   check it (no answer, a 5xx, a rate limit: the app tries again later); 502 when a read or the write
 *   fails.
 * - The write happens only while the row still has `baseUpdatedAt` (the version the app saw, from its
 *   own read or `window.linkyoApp.flush()`): otherwise 409 with the current `updatedAt`, nothing written.
 *   It is an opaque string, sent back exactly as received: parsed into a date and written out again
 *   (milliseconds, where Postgres keeps microseconds) it never matches.
 * - 422 for more than 20 operations, a body the schema refuses, a link that is no address, a picture
 *   that is not the account's own upload, an unknown or doubled block id, a position past the end, or
 *   a page the blocks schema would refuse; 413 above 64 KB; 403 for a suspended account or a blocked
 *   address; 409 without real accounts or the server's key (a demo build); 429 with `Retry-After` past
 *   the limits above.
 * - A successful write drops the cached public page, so visitors see it at once.
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseEnabled || !serviceKey) return answer({ ok: false, error: "unavailable" }, 409);
  const place = requestPlace(request.headers);
  const byAddress = ADDRESS_LIMIT.take(addressKey(place.ip));
  if (!byAddress.ok) return tooMany(byAddress);
  const signedIn = await requireUser(request, { outage: "unavailable" });
  if (signedIn instanceof Response) return signedIn;
  const byAccount = ACCOUNT_LIMIT.take(valueKey("account", signedIn.user.id));
  if (!byAccount.ok) return tooMany(byAccount);
  // As at sign-in and in the hand-off: nothing is written from a blocked address.
  if (await isBlocked(serviceSupabase(), place)) return answer({ ok: false, error: "blocked" }, 403);

  const raw = await readBody(request, MAX_BODY);
  if (raw === null) return answer({ ok: false, error: "tooLarge", max: MAX_BODY }, 413);
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return answer({ ok: false, error: "invalidJson" }, 400);
  }
  if (isRecord(input) && Array.isArray(input.ops) && input.ops.length > MAX_OPS) return answer({ ok: false, error: "tooManyOps", max: MAX_OPS }, 422);
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return answer({ ok: false, error: "invalidBody", path: parsed.error.issues[0]?.path.join(".") ?? "" }, 422);

  const { user, db } = signedIn;
  const { data: profile, error: profileError } = await db.from("profiles").select("status, username, locale").eq("id", user.id).maybeSingle();
  // A failed read says nothing about the account: never the final-sounding "notFound" for it.
  if (profileError) return answer({ ok: false, error: "serverError" }, 502);
  if (!profile) return answer({ ok: false, error: "notFound" }, 404);
  if (profile.status !== "active") return answer({ ok: false, error: "suspended" }, 403);

  /** The row's version now: null when there is no row, undefined when the read failed. */
  const currentVersion = async (): Promise<string | null | undefined> => {
    const { data, error } = await db.from("sites").select("updated_at").eq("profile_id", user.id).maybeSingle();
    return error ? undefined : (data?.updated_at ?? null);
  };
  const conflict = async () => answer({ ok: false, error: "conflict", updatedAt: (await currentVersion()) ?? null }, 409);

  // Read only the version the app built on: a newer one is a conflict before any link is looked up.
  const { data: row, error: readError } = await db
    .from("sites")
    .select("page, updated_at")
    .eq("profile_id", user.id)
    .eq("updated_at", parsed.data.baseUpdatedAt)
    .maybeSingle();
  if (readError) return answer({ ok: false, error: "serverError" }, 502);
  if (!row) {
    const version = await currentVersion();
    if (version === undefined) return answer({ ok: false, error: "serverError" }, 502);
    return version === null ? answer({ ok: false, error: "notFound" }, 404) : answer({ ok: false, error: "conflict", updatedAt: version }, 409);
  }

  const stored = isRecord(row.page) && isRecord(row.page.profile) ? row.page.profile : {};
  const t = await getTranslations({ locale: localeOf(stored.locale, profile.locale), namespace: "dashboard.types" });
  const displayName = typeof stored.displayName === "string" ? stored.displayName : "";
  const result = await applyOps(row.page, parsed.data.ops, {
    ownerId: user.id,
    storageUrl: SUPABASE_URL,
    labels: { video: t("video"), music: t("music"), event: t("events") },
    artist: displayName || profile.username,
    lookup: (url) => lookupLinkMetadata(url).catch(() => null),
    newId: newBlockId,
  });
  if (!result.ok) {
    const { ok: _refused, ...problem } = result;
    return answer({ ok: false, ...problem }, 422);
  }

  // The same guard on the write: a change that landed after the read is never overwritten.
  const { data: saved, error: writeError } = await db
    .from("sites")
    .update({ page: toJson(result.page) })
    .eq("profile_id", user.id)
    .eq("updated_at", row.updated_at)
    .select("updated_at")
    .maybeSingle();
  if (writeError) return tooLarge(writeError) ? answer({ ok: false, error: "pageTooLarge" }, 422) : answer({ ok: false, error: "serverError" }, 502);
  if (!saved) return conflict();

  revalidateCreatorPages([profile.username], [...projectSlugs(row.page), ...projectSlugs(result.page)]);
  return answer({ ok: true, updatedAt: saved.updated_at, changed: result.changed, added: result.added });
}
