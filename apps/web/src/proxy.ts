import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { PREVIEW_ALIASES } from "./features/previews/aliases";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Earlier preview links: a permanent redirect to the short one, before the (static) route is reached.
  const match = /^\/(de|en|ar)\/p\/([a-z0-9-]+)\/?$/.exec(request.nextUrl.pathname);
  const alias = match ? PREVIEW_ALIASES[match[2] ?? ""] : undefined;
  if (match && alias) {
    const url = request.nextUrl.clone();
    url.pathname = `/${match[1] ?? routing.defaultLocale}/p/${alias}`;
    return NextResponse.redirect(url, 308);
  }
  return intl(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
