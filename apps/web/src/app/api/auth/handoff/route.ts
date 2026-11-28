import { z } from "zod";

import { DEVICE_ID, isBlocked, safePath, sessionIdOf } from "@/features/account/server/auth";
import { addressKey, MINUTE, rateLimit, retryHeaders, valueKey, type Verdict } from "@/lib/rate-limit";
import { requestPlace } from "@/lib/request-context";
import { readBody } from "@/lib/server/read-body";
import { bearer, requireUser } from "@/lib/server/user";
import { supabaseEnabled } from "@/lib/supabase/config";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const answer = (body: object, status = 200) => Response.json(body, { status, headers: noStore });

/** `{ deviceId, next }` is well under 300 bytes; anything past 4 KB is refused before it is read whole. */
const MAX_BODY = 4 * 1024;

/**
 * Each call mints a sign-in token. The app hands off once per landing on the login page, and stops
 * after two failures in a row (ADR 0088): 10 per account and 30 per address in 10 minutes. The address
 * limit comes first, before Auth is asked.
 */
const ACCOUNT_LIMIT = rateLimit({ name: "handoff-account", max: 10, windowMs: 10 * MINUTE });
const ADDRESS_LIMIT = rateLimit({ name: "handoff-address", max: 30, windowMs: 10 * MINUTE });
/** 429 `tooManyRequests`: the app waits `Retry-After` seconds, then tries once more (ADR 0088). */
const tooMany = (verdict: Extract<Verdict, { ok: false }>) =>
  Response.json({ ok: false, error: "tooManyRequests" }, { status: 429, headers: retryHeaders(verdict) });

/** A method this route does not take: 405 with `no-store` (Next's own 405 would be cacheable). */
const notAllowed = () => new Response(null, { status: 405, headers: { ...noStore, Allow: "POST" } });
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };

/** The body as JSON, null when it is not JSON, undefined when it is above MAX_BODY. */
async function readJson(request: Request): Promise<unknown> {
  const raw = await readBody(request, MAX_BODY);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

const body = z.object({
  /** The app's own device id (Keychain), the same form a browser keeps. */
  deviceId: z.string().regex(DEVICE_ID),
  /** Where the dashboard opens: an in-app path only (`safePath`), the account's language otherwise. */
  next: z.string().max(200).optional(),
});

const LOCALES = new Set(["de", "en", "ar"]);
/** An auth session id, as `sign_ins.session_id` keeps it (a uuid). */
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only the creator dashboard opens in the app's web view (the team area stays in the browser). */
const DASHBOARD = /^\/(?:de|en|ar)\/app(?:\/|$)/;

/**
 * The iPhone app's way into the web dashboard (PLAN D3, ADR 0088). The app signs in through
 * our routes and keeps its own session; its web view gets a second, separate one, so the two never
 * refresh the same token (Supabase rotates refresh tokens and revokes a session whose spent token
 * comes back). With the app's access token as `Authorization: Bearer`, this answers a one-time link
 * to `/api/auth/confirm`, which the web view opens: it puts the new session in the web view's cookies,
 * logs the sign-in under the app's device id and continues to the dashboard.
 *
 * - Bearer only (no cookie is read, so no cross-site request can use it); `no-store`.
 * - 401 only for a token Supabase Auth turned down (the app signs out on it); 503 when Auth could not
 *   check the token (no answer, a 5xx, a rate limit: the app tries again later, ADR 0088); 422 for a
 *   device id that is not `dev_<12 hex>`; 409 where real accounts or the server's key are missing (a
 *   demo build); 403 for a suspended account or a blocked address (the same refusals as
 *   /api/auth/verify); 502 when the account cannot be read or the link cannot be made.
 * - Only for the device that opened the session: the token's session (`session_id` in its JWT) must
 *   have a successful sign-in logged under this `deviceId` (the app's native sign-in writes both), else
 *   403 `deviceMismatch`. A token that leaked cannot be turned into a long-lived session under a
 *   device id the caller makes up.
 * - 413 above 4 KB (before the body is read whole); 429 with `Retry-After` past the limits above.
 * - The link is single-use and expires with Supabase's OTP lifetime; making it sends no e-mail, but it
 *   replaces an e-mailed code that is still open for this address, and the previous link: the app
 *   asks for one hand-off at a time and opens each link before asking again. Neither the token nor the
 *   link is logged.
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
  const input = await readJson(request);
  if (input === undefined) return answer({ ok: false, error: "tooLarge", max: MAX_BODY }, 413);
  const parsed = body.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return answer({ ok: false, error: field === "next" ? "invalidNext" : "invalidDevice" }, 422);
  }
  const { user } = signedIn;
  if (!user.email) return answer({ ok: false, error: "unavailable" }, 409);

  const service = serviceSupabase();
  if (await isBlocked(service, place)) return answer({ ok: false, error: "blocked" }, 403);
  const { data: profile, error: profileError } = await service.from("profiles").select("status, locale").eq("id", user.id).maybeSingle<{ status: string; locale: string }>();
  // A failed read says nothing about the account: never the final-sounding "suspended" for it.
  if (profileError) return answer({ ok: false, error: "serverError" }, 502);
  if (profile?.status !== "active") return answer({ ok: false, error: "suspended" }, 403);

  // The session must have been opened on this device: a sign-in logged with its id and this device id.
  const session = sessionIdOf(bearer(request) ?? "");
  if (!session || !SESSION_ID.test(session)) return answer({ ok: false, error: "deviceMismatch" }, 403);
  const { data: opened, error: openedError } = await service
    .from("sign_ins")
    .select("id")
    .eq("profile_id", user.id)
    .eq("session_id", session)
    .eq("device_id", parsed.data.deviceId)
    .eq("result", "success")
    .limit(1)
    .maybeSingle();
  if (openedError) return answer({ ok: false, error: "serverError" }, 502);
  if (!opened) return answer({ ok: false, error: "deviceMismatch" }, 403);

  const home = `/${LOCALES.has(profile.locale) ? profile.locale : "de"}/app`;
  const wanted = safePath(parsed.data.next ?? null, home);
  const next = DASHBOARD.test(wanted) ? wanted : home;
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email: user.email });
  const tokenHash = data.properties?.hashed_token;
  if (error || !tokenHash) return answer({ ok: false, error: "serverError" }, 502);
  const params = new URLSearchParams({ token_hash: tokenHash, type: "magiclink", next, device: parsed.data.deviceId });
  return answer({ ok: true, url: `/api/auth/confirm?${params.toString()}` });
}
