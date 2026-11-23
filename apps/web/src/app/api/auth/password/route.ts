import { z } from "zod";

import { deviceBody, fail, isBlocked, json, recordSignIn, sessionIdOf } from "@/features/account/server/auth";
import { ensureFirstSite } from "@/features/account/server/first-site";
import { normalizeEmail } from "@/features/account/username";
import { supabaseEnabled } from "@/lib/supabase/config";
import { anonServerSupabase, serviceSupabase } from "@/lib/supabase/server";
import { requestPlace } from "@/lib/request-context";

const body = z.object({ email: z.string().max(254), password: z.string().min(1).max(200) }).and(deviceBody);

/** After this many failed sign-ins within 15 minutes, an address waits (the same rule as codes). */
const MAX_FAILURES = 8;

/**
 * Signs in with e-mail and password, on the server like the code sign-in, so the security log
 * records it and blocked addresses and suspended accounts are refused. Only accounts made with a
 * password have one (the team, set up in the Supabase dashboard); sign-up stays passwordless.
 * A wrong e-mail and a wrong password get the same answer (no account enumeration).
 */
export async function POST(request: Request) {
  if (!supabaseEnabled) return fail("serverError", 404);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("serverError", 400);
  const input = parsed.data;
  const email = normalizeEmail(input.email);
  if (!z.email().safeParse(email).success) return fail("invalidEmail");
  const service = serviceSupabase();
  const place = requestPlace(request.headers);
  if (await isBlocked(service, place)) return fail("blocked");
  const { data: failures } = await service.rpc("recent_failures", { email });
  if (typeof failures === "number" && failures >= MAX_FAILURES) return fail("tooManyAttempts");

  const { data, error } = await anonServerSupabase().auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) {
    if (error.status === 429) return fail("tooManyAttempts");
    await recordSignIn(service, { email, result: "failed", place, device: input });
    return fail("wrongPassword");
  }

  const { data: profile } = await service
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle<{ status: string }>();
  if (profile?.status !== "active") {
    await service.auth.admin.signOut(data.session.access_token).catch(() => undefined);
    await recordSignIn(service, { email, result: "failed", place, device: input });
    return fail("suspended");
  }
  await ensureFirstSite(service, data.user);
  await recordSignIn(service, {
    email,
    result: "success",
    place,
    device: input,
    sessionId: sessionIdOf(data.session.access_token),
  });
  return json({
    ok: true,
    session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
  });
}
