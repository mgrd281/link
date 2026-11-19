import { z } from "zod";

import { deviceBody, fail, isBlocked, json } from "@/features/account/server/auth";
import { startSchema } from "@/features/account/server/first-site";
import { localUsernameStatus, normalizeEmail, normalizeUsername } from "@/features/account/username";
import { findPrepared } from "@/features/previews/claim";
import { supabaseEnabled } from "@/lib/supabase/config";
import { anonServerSupabase, serviceSupabase } from "@/lib/supabase/server";
import { requestPlace } from "@/lib/request-context";

const body = z
  .object({
    email: z.string().max(254),
    locale: z.enum(["de", "en", "ar"]),
    // Someone new: the page address they chose, an invite from a prepared page, an example to start from.
    signUp: z.object({ username: z.string().max(40), invite: z.string().max(64).optional(), start: startSchema.optional() }).optional(),
  })
  .and(deviceBody);

/**
 * Sends a 6-digit code and a one-click link (valid 10 minutes). Someone new is checked first (blocked
 * address, page address, a page the team prepared for this email) and the account is created with
 * that address; it counts once the code is entered. The answer is the same whether or not the email
 * has an account (no account enumeration).
 */
export async function POST(request: Request) {
  if (!supabaseEnabled) return fail("serverError", 404);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("serverError", 400);
  const input = parsed.data;
  const email = normalizeEmail(input.email);
  if (!z.email().safeParse(email).success) return fail("invalidEmail");
  const service = serviceSupabase();
  if (await isBlocked(service, requestPlace(request.headers))) return fail("blocked");
  const origin = new URL(request.url).origin;
  const auth = anonServerSupabase().auth;

  if (input.signUp) {
    let username = normalizeUsername(input.signUp.username);
    // A page the team prepared for this address wins over the typed name (the email decides).
    const claim = findPrepared({ email, username, invite: input.signUp.invite, locale: input.locale });
    if (claim.kind === "mismatch") return fail("inviteMismatch");
    if (claim.kind === "reserved") return fail("reservedForCreator");
    if (claim.kind === "match") username = claim.username;
    const local = localUsernameStatus(username);
    if (local !== "ok") return fail(local);
    const { data: status } = await service.rpc("username_status", { candidate: username });
    if (status !== "ok") return fail(status === "reservedUsername" || status === "invalidUsername" ? status : "usernameTaken");

    const { error } = await auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { username, locale: input.locale, invite: input.signUp.invite, start: input.signUp.start },
        emailRedirectTo: `${origin}/api/auth/confirm?next=/${input.locale}/app/welcome`,
      },
    });
    if (error) {
      if (error.status === 429) return fail("tooManyAttempts");
      // The database refuses names that became taken a moment ago (see handle_new_user).
      if (error.message.includes("Database error")) return fail("usernameTaken");
      console.error("sign-up code failed", error.code, error.message);
      return fail("serverError");
    }
    return json({ ok: true, pending: "code" });
  }

  const { error } = await auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/api/auth/confirm?next=/${input.locale}/app` },
  });
  if (error?.status === 429) return fail("tooManyAttempts");
  // No account for this address: say the same as for one (no account enumeration).
  if (error && error.code !== "otp_disabled" && error.code !== "user_not_found") {
    console.error("sign-in code failed", error.code, error.message);
    return fail("serverError");
  }
  return json({ ok: true, pending: "code" });
}
