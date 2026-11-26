import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { parseUserAgent } from "@/features/account/device";
import { DEVICE_ID, recordSignIn, safePath, sessionIdOf } from "@/features/account/server/auth";
import { ensureFirstSite } from "@/features/account/server/first-site";
import { cleanRef, settleReferral } from "@/features/account/server/referrals";
import { supabaseEnabled } from "@/lib/supabase/config";
import { cookieServerSupabase, serviceSupabase } from "@/lib/supabase/server";
import { requestPlace } from "@/lib/request-context";

const TYPES: readonly EmailOtpType[] = ["signup", "email", "email_change", "invite", "magiclink"];

/**
 * Which device the security log names: the iPhone app's own id when its hand-off link carries one
 * (`/api/auth/handoff`), so the app's two sessions share it and "Sign out device" ends both; an
 * emailed link otherwise.
 */
const deviceOf = (value: string | null): string => (value !== null && DEVICE_ID.test(value) ? value : "dev_email_link");

/**
 * Where the links in our emails land (the one-click sign-in next to the code, a new address).
 * Verifies the one-time token, puts the session in first-party cookies, makes a new account's first
 * page and continues in the app. Works on any device:
 * the token is in the link, nothing has to be remembered by the browser that asked for it.
 * A suspended account is refused as `/api/auth/verify` and `/api/auth/password` refuse it: the new
 * session is ended at once, the sign-in is logged as failed, and the login page says "suspended".
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const locale = /^\/(de|en|ar)\//.exec(url.searchParams.get("next") ?? "")?.[1] ?? "de";
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  if (!supabaseEnabled) return back(`/${locale}/login`);

  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const type = TYPES.find((known) => known === typeParam) ?? null;
  const supabase = await cookieServerSupabase();
  const { data, error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : await supabase.auth.exchangeCodeForSession(url.searchParams.get("code") ?? "");
  if (error || !data.user) return back(`/${locale}/login?link=expired`);

  const service = serviceSupabase();
  const place = requestPlace(request.headers);
  const device = { device: parseUserAgent(request.headers.get("user-agent") ?? ""), deviceId: deviceOf(url.searchParams.get("device")) };
  const { data: profile } = await service.from("profiles").select("status").eq("id", data.user.id).maybeSingle<{ status: string }>();
  if (profile?.status !== "active") {
    if (data.session) await service.auth.admin.signOut(data.session.access_token).catch(() => undefined);
    // The cookies verifyOtp just wrote go too: this browser keeps no session of the account.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    if (data.user.email) await recordSignIn(service, { email: data.user.email, result: "failed", place, device });
    return back(`/${locale}/login?link=suspended`);
  }

  if (data.user.email && type !== "email_change") {
    await ensureFirstSite(service, data.user);
    await recordSignIn(service, {
      email: data.user.email,
      result: "success",
      place,
      device,
      sessionId: data.session ? sessionIdOf(data.session.access_token) : null,
    });
    // A new account from an invite link, confirmed by the emailed link instead of the code: the link
    // carries the code of the sign-up that asked for it (`ref`, see /api/auth/code).
    await settleReferral(service, data.user.id, cleanRef(url.searchParams.get("ref")));
  }
  return back(safePath(url.searchParams.get("next"), `/${locale}/app`));
}
