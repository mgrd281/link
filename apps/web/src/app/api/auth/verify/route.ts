import { z } from "zod";

import { deviceBody, fail, isBlocked, json, recordSignIn, sessionIdOf } from "@/features/account/server/auth";
import { ensureFirstSite } from "@/features/account/server/first-site";
import { settleReferral } from "@/features/account/server/referrals";
import { normalizeEmail } from "@/features/account/username";
import { supabaseEnabled } from "@/lib/supabase/config";
import { anonServerSupabase, serviceSupabase } from "@/lib/supabase/server";
import { requestPlace } from "@/lib/request-context";

const body = z.object({ email: z.string().max(254), code: z.string().max(12) }).and(deviceBody);

/** After this many wrong codes within 15 minutes, an address waits (guessing). */
const MAX_FAILURES = 8;

/**
 * Signs in with the emailed code, on the server so the security log records what really happened:
 * blocked addresses and suspended accounts are refused, wrong codes are logged and slow guessing
 * down. A new account gets its first page here.
 */
export async function POST(request: Request) {
  if (!supabaseEnabled) return fail("serverError", 404);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("serverError", 400);
  const input = parsed.data;
  const email = normalizeEmail(input.email);
  const code = input.code.replace(/\D/g, "");
  const service = serviceSupabase();
  const place = requestPlace(request.headers);
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

  const { data: profile } = await service.from("profiles").select("status").eq("id", data.user.id).maybeSingle<{ status: string }>();
  if (profile?.status !== "active") {
    await service.auth.admin.signOut(data.session.access_token).catch(() => undefined);
    await recordSignIn(service, { email, result: "failed", place, device: input });
    return fail("suspended");
  }
  await ensureFirstSite(service, data.user);
  await recordSignIn(service, { email, result: "success", place, device: input, sessionId: sessionIdOf(data.session.access_token) });
  // A new account from an invite link: the checks need the sign-in just logged.
  await settleReferral(service, data.user.id);
  return json({ ok: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
}
