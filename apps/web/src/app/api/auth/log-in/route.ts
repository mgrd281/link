import { z } from "zod";

import { deviceBody, fail, isBlocked, json, recordSignIn, sessionIdOf } from "@/features/account/server/auth";
import { normalizeEmail } from "@/features/account/username";
import { supabaseEnabled } from "@/lib/supabase/config";
import { anonServerSupabase, serviceSupabase } from "@/lib/supabase/server";
import { requestPlace } from "@/lib/request-context";

const body = z.object({ email: z.string().max(254), password: z.string().max(200) }).and(deviceBody);

/** After this many failed attempts within 15 minutes, an address waits (password guessing). */
const MAX_FAILURES = 8;

/**
 * Real sign-in, done by the server so the security log records what really happened: blocked
 * addresses and suspended accounts are refused, failed attempts are logged and slow guessing down.
 */
export async function POST(request: Request) {
  if (!supabaseEnabled) return fail("serverError", 404);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("serverError", 400);
  const input = parsed.data;
  const email = normalizeEmail(input.email);
  const service = serviceSupabase();
  const place = requestPlace(request.headers);
  if (await isBlocked(service, place)) return fail("blocked");
  const { data: failures } = await service.rpc("recent_failures", { email });
  if (typeof failures === "number" && failures >= MAX_FAILURES) return fail("tooManyAttempts");

  const auth = anonServerSupabase().auth;
  const { data, error } = await auth.signInWithPassword({ email, password: input.password });
  if (error) {
    if (error.code === "email_not_confirmed") return fail("emailNotConfirmed");
    if (error.status === 429) return fail("tooManyAttempts");
    await recordSignIn(service, { email, result: "failed", place, device: input });
    // Same answer for "no such email" and "wrong password" (no account enumeration).
    return fail("invalidCredentials");
  }

  const { data: profile } = await service.from("profiles").select("status").eq("id", data.user.id).maybeSingle<{ status: string }>();
  if (profile?.status !== "active") {
    await service.auth.admin.signOut(data.session.access_token).catch(() => undefined);
    await recordSignIn(service, { email, result: "failed", place, device: input });
    return fail("suspended");
  }
  await recordSignIn(service, { email, result: "success", place, device: input, sessionId: sessionIdOf(data.session.access_token) });
  return json({ ok: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
}
