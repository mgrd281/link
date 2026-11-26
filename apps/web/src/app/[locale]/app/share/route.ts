import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";

import { sharedLink, sharedPath } from "@/features/pwa/share-target";
import { routing } from "@/i18n/routing";

/**
 * The installed app's share target (features/pwa/share-target.ts): what another app shared arrives
 * here, and the dashboard opens with the Add sheet holding the first link in it. Signed out, the
 * dashboard's gate sends the visitor to sign in and back to the same Add sheet afterwards.
 */
export function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => {
    if (!hasLocale(routing.locales, locale)) return new NextResponse(null, { status: 404 });
    const query = request.nextUrl.searchParams;
    const link = sharedLink({ url: query.get("url"), text: query.get("text"), title: query.get("title") });
    const target = new URL(`/${locale}${sharedPath(link)}`, request.nextUrl.origin);
    // 303: the shared words are not kept in the history entry or a cache.
    return NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "no-store" } });
  });
}
