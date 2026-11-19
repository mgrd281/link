import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { parseUserAgent } from "@/features/account/device";
import { recordSignIn, safePath, sessionIdOf } from "@/features/account/server/auth";
import { ensureFirstSite } from "@/features/account/server/first-site";
import { supabaseEnabled } from "@/lib/supabase/config";
import { cookieServerSupabase, serviceSupabase } from "@/lib/supabase/server";
import { requestPlace } from "@/lib/request-context";

const TYPES: readonly EmailOtpType[] = ["signup", "email", "email_change", "invite", "magiclink"];

/**
 * Where the links in our emails land (the one-click sign-in next to the code, a new address).
 * Verifies the one-time token, puts the session in first-party cookies, makes a new account's first
 * page and continues in the app. Works on any device:
 * the token is in the link, nothing has to be remembered by the browser that asked for it.
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

  if (data.user.email && type !== "email_change") {
    const service = serviceSupabase();
    await ensureFirstSite(service, data.user);
    await recordSignIn(service, {
      email: data.user.email,
      result: "success",
      place: requestPlace(request.headers),
      device: { device: parseUserAgent(request.headers.get("user-agent") ?? ""), deviceId: "dev_email_link" },
      sessionId: data.session ? sessionIdOf(data.session.access_token) : null,
    });
  }
  return back(safePath(url.searchParams.get("next"), `/${locale}/app`));
}
