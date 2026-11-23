import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { PREVIEW_ALIASES } from "./features/previews/aliases";
import { routing } from "./i18n/routing";
import { creatorRedirect, creatorRewrite } from "./lib/creator-path";
import { supabaseEnabled } from "./lib/supabase/config";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Creator pages: their own root layout in the page's language. next-intl stays out of the way
  // (no language prefix, no cookie), so a visitor's browser gets nothing but the page.
  if (pathname.startsWith("/u/")) return NextResponse.next();
  if (supabaseEnabled) {
    // "/Mila" → "/mila", then "/mila" is served by /u/mila while the address bar keeps "/mila".
    const lower = creatorRedirect(pathname);
    if (lower) {
      const url = request.nextUrl.clone();
      url.pathname = lower;
      return NextResponse.redirect(url, 308);
    }
    const creator = creatorRewrite(pathname, supabaseEnabled);
    if (creator) return NextResponse.rewrite(new URL(creator, request.url));
  }
  // Earlier preview links: a permanent redirect to the short one, before the (static) route is reached.
  const match = /^\/(de|en|ar)\/p\/([a-z0-9-]+)\/?$/.exec(pathname);
  const alias = match ? PREVIEW_ALIASES[match[2] ?? ""] : undefined;
  if (match && alias) {
    const url = request.nextUrl.clone();
    url.pathname = `/${match[1] ?? routing.defaultLocale}/p/${alias}`;
    return NextResponse.redirect(url, 308);
  }
  return intl(request);
}

// Everything but the API, Next's own paths and files. Each skipped name ends at a path boundary: as
// a bare prefix it also skipped creator addresses that merely begin with it (linkyo.app/apiary).
export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|_vercel(?:/|$)|.*\\..*).*)"],
};
