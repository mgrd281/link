import { z } from "zod";

import { DEVICE_ID, isBlocked, safePath } from "@/features/account/server/auth";
import { requestPlace } from "@/lib/request-context";
import { requireUser } from "@/lib/server/user";
import { supabaseEnabled } from "@/lib/supabase/config";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const answer = (body: object, status = 200) => Response.json(body, { status, headers: noStore });

const body = z.object({
  /** The app's own device id (Keychain), the same form a browser keeps. */
  deviceId: z.string().regex(DEVICE_ID),
  /** Where the dashboard opens: an in-app path only (`safePath`), the account's language otherwise. */
  next: z.string().max(200).optional(),
});

const LOCALES = new Set(["de", "en", "ar"]);
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
 * - 401 without a valid token, 422 for a device id that is not `dev_<12 hex>`, 409 where real accounts
 *   or the server's key are missing (a demo build), 403 for a suspended account or a blocked address
 *   (the same refusals as /api/auth/verify).
 * - The link is single-use and expires with Supabase's OTP lifetime; making it sends no e-mail, but it
 *   replaces an e-mailed code that is still open for this address, and the previous link: the app
 *   asks for one hand-off at a time and opens each link before asking again. Neither the token nor the
 *   link is logged.
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseEnabled || !serviceKey) return answer({ ok: false, error: "unavailable" }, 409);
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return answer({ ok: false, error: field === "next" ? "invalidNext" : "invalidDevice" }, 422);
  }
  const { user } = signedIn;
  if (!user.email) return answer({ ok: false, error: "unavailable" }, 409);

  const service = serviceSupabase();
  if (await isBlocked(service, requestPlace(request.headers))) return answer({ ok: false, error: "blocked" }, 403);
  const { data: profile } = await service.from("profiles").select("status, locale").eq("id", user.id).maybeSingle<{ status: string; locale: string }>();
  if (profile?.status !== "active") return answer({ ok: false, error: "suspended" }, 403);

  const home = `/${LOCALES.has(profile.locale) ? profile.locale : "de"}/app`;
  const wanted = safePath(parsed.data.next ?? null, home);
  const next = DASHBOARD.test(wanted) ? wanted : home;
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email: user.email });
  const tokenHash = data.properties?.hashed_token;
  if (error || !tokenHash) return answer({ ok: false, error: "serverError" }, 502);
  const params = new URLSearchParams({ token_hash: tokenHash, type: "magiclink", next, device: parsed.data.deviceId });
  return answer({ ok: true, url: `/api/auth/confirm?${params.toString()}` });
}
