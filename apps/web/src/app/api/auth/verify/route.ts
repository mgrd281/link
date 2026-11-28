import { z } from "zod";

import { deviceBody, fail, isBlocked, json, recordSignIn, sessionIdOf } from "@/features/account/server/auth";
import { ensureFirstSite } from "@/features/account/server/first-site";
import { cleanRef, settleReferral } from "@/features/account/server/referrals";
import { normalizeEmail } from "@/features/account/username";
import { supabaseEnabled } from "@/lib/supabase/config";
import { anonServerSupabase, serviceSupabase } from "@/lib/supabase/server";
import { addressKey, MINUTE, rateLimit, retryHeaders, valueKey, type Verdict } from "@/lib/rate-limit";
import { requestPlace } from "@/lib/request-context";

const body = z
  .object({
    email: z.string().max(254),
    code: z.string().max(12),
    // A sign-up from an invite link: the code this browser came with (checked against the stored one).
    signUp: z.object({ ref: z.string().max(16).optional() }).optional(),
  })
  .and(deviceBody);

/** After this many wrong codes within 15 minutes, an address waits (guessing). */
const MAX_FAILURES = 8;

/**
 * A person types one code, maybe two or three after a typo or an older e-mail: 10 tries per e-mail
 * address in 15 minutes, and 40 per client address (room for many people behind one shared address),
 * every try counted. On top of MAX_FAILURES, which counts only logged failures (an address with an
 * account), these also hold for addresses without one.
 */
const ADDRESS_LIMIT = rateLimit({ name: "auth-verify-address", max: 40, windowMs: 15 * MINUTE });
const EMAIL_LIMIT = rateLimit({ name: "auth-verify-email", max: 10, windowMs: 15 * MINUTE });

/** The code step already says "too many attempts, wait a few minutes" for this error. */
const tooMany = (verdict: Extract<Verdict, { ok: false }>) =>
  Response.json({ ok: false, error: "tooManyAttempts" }, { status: 429, headers: retryHeaders(verdict) });

/**
 * Signs in with the emailed code, on the server so the security log records what really happened:
 * blocked addresses and suspended accounts are refused, wrong codes are logged and slow guessing
 * down. A new account gets its first page here.
 */
export async function POST(request: Request) {
  if (!supabaseEnabled) return fail("serverError", 404);
  const place = requestPlace(request.headers);
  const byAddress = ADDRESS_LIMIT.take(addressKey(place.ip));
  if (!byAddress.ok) return tooMany(byAddress);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("serverError", 400);
  const input = parsed.data;
  const email = normalizeEmail(input.email);
  const byEmail = EMAIL_LIMIT.take(valueKey("email", email));
  if (!byEmail.ok) return tooMany(byEmail);
  const code = input.code.replace(/\D/g, "");
  const service = serviceSupabase();
  if (await isBlocked(service, place)) return fail("blocked");
  const { data: failures } = await service.rpc("recent_failures", { email });
  if (typeof failures === "number" && failures >= MAX_FAILURES) return fail("tooManyAttempts");
  if (!/^\d{6}$/.test(code)) return fail("invalidCode");

  const { data, error } = await anonServerSupabase().auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.user || !data.session) {
    if (error?.status === 429) return fail("tooManyAttempts");
    await recordSignIn(service, { email, result: "failed", place, device: input });
    // Supabase answers the same for a wrong and an expired code.
    return fail("invalidCode");
  }

  const { data: profile, error: readError } = await service.from("profiles").select("status").eq("id", data.user.id).maybeSingle<{ status: string }>();
  if (readError) {
    // A failed read says nothing about the account (never "suspended"): no session, try again.
    // Only the session just opened ends (scope local): the account's other devices stay signed in.
    await service.auth.admin.signOut(data.session.access_token, "local").catch(() => undefined);
    return fail("serverError", 502);
  }
  if (profile?.status !== "active") {
    await service.auth.admin.signOut(data.session.access_token).catch(() => undefined);
    await recordSignIn(service, { email, result: "failed", place, device: input });
    return fail("suspended");
  }
  await ensureFirstSite(service, data.user);
  await recordSignIn(service, { email, result: "success", place, device: input, sessionId: sessionIdOf(data.session.access_token) });
  // A new account from an invite link: the checks need the sign-in just logged, and this browser's code.
  await settleReferral(service, data.user.id, cleanRef(input.signUp?.ref));
  return json({ ok: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
}
