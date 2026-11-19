import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { z } from "zod";

import { isStrongEnough } from "@/features/account/password";
import { deviceBody, fail, isBlocked, json, recordSignIn, sessionIdOf } from "@/features/account/server/auth";
import { firstSite } from "@/features/account/site-builders";
import { localUsernameStatus, normalizeEmail, normalizeUsername } from "@/features/account/username";
import { findPrepared } from "@/features/previews/claim";
import { supabaseEnabled } from "@/lib/supabase/config";
import { fromJson, toJson } from "@/lib/supabase/json";
import { anonServerSupabase, serviceSupabase } from "@/lib/supabase/server";
import { requestPlace } from "@/lib/request-context";

const body = z
  .object({
    email: z.string().max(254),
    password: z.string().max(200),
    username: z.string().max(40),
    locale: z.enum(["de", "en", "ar"]),
    invite: z.string().max(64).optional(),
    // An example's kind and look; only the account's own page uses it, so the client may choose.
    start: z.object({ kind: z.string().max(40), theme: z.record(z.string(), z.unknown()) }).optional(),
  })
  .and(deviceBody);

/**
 * Real sign-up. The server checks everything again (blocked address, name, password, a page the
 * team prepared for this email), creates the account and its first page, and answers "check your
 * inbox" whether or not the address already had an account (no account enumeration).
 */
export async function POST(request: Request) {
  if (!supabaseEnabled) return fail("serverError", 404);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("serverError", 400);
  const input = parsed.data;
  const email = normalizeEmail(input.email);
  let username = normalizeUsername(input.username);
  if (!z.email().safeParse(email).success) return fail("invalidEmail");
  const service = serviceSupabase();
  const place = requestPlace(request.headers);
  if (await isBlocked(service, place)) return fail("blocked");

  // A page the team prepared for this address wins over the typed name (the email decides).
  const claim = findPrepared({ email, username, invite: input.invite, locale: input.locale });
  if (claim.kind === "mismatch") return fail("inviteMismatch");
  if (claim.kind === "reserved") return fail("reservedForCreator");
  if (claim.kind === "match") username = claim.username;

  const local = localUsernameStatus(username);
  if (local !== "ok") return fail(local);
  const { data: status } = await service.rpc("username_status", { candidate: username });
  if (status !== "ok") return fail(status === "reservedUsername" || status === "invalidUsername" ? status : "usernameTaken");
  if (!isStrongEnough(input.password, { email, username })) return fail("weakPassword");

  const origin = new URL(request.url).origin;
  const { data, error } = await anonServerSupabase().auth.signUp({
    email,
    password: input.password,
    options: {
      data: { username, locale: input.locale },
      emailRedirectTo: `${origin}/api/auth/confirm?next=/${input.locale}/app/welcome`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") return fail("emailTaken");
    if (error.code === "weak_password") return fail("weakPassword");
    if (error.code === "over_email_send_rate_limit" || error.status === 429) return fail("tooManyAttempts");
    // The database refuses names that became taken a moment ago (see handle_new_user).
    if (error.message.includes("Database error")) return fail("usernameTaken");
    console.error("sign-up failed", error.code, error.message);
    return fail("serverError");
  }

  // An existing confirmed address comes back without identities: say the same as for a new one.
  const user = data.user;
  if (user?.identities && user.identities.length > 0) {
    const site = firstSite({
      username,
      email,
      locale: input.locale,
      prepared: claim.kind === "match" ? { page: claim.page, theme: claim.theme } : undefined,
      start: claim.kind === "match" || !input.start ? undefined : { kind: input.start.kind, theme: fromJson<CreatorThemeConfig>(toJson(input.start.theme)) },
    });
    const { error: siteError } = await service.from("sites").insert({
      profile_id: user.id,
      kind: site.kind ?? null,
      onboarded: site.onboarded,
      theme: toJson(site.theme),
      page: toJson(site.page),
      legal: toJson(site.legal),
      prepared: site.prepared ? toJson(site.prepared) : null,
    });
    if (siteError) console.error("first site failed", siteError.message);
    // The team's verified badge carries over with a prepared page.
    if (claim.kind === "match" && claim.page.profile.verified) await service.from("profiles").update({ verified: true }).eq("id", user.id);
  }

  if (data.session) {
    await recordSignIn(service, { email, result: "success", place, device: input, sessionId: sessionIdOf(data.session.access_token) });
    return json({ ok: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
  }
  return json({ ok: true, pending: "confirmEmail" });
}
