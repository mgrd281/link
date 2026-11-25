import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { beaconScript } from "@/features/analytics/beacon-script";
import { loadPublicPage } from "@/features/creator/public-page";
import { fontVariables } from "@/fonts";
import { clientMessages } from "@/i18n/client-messages";
import { isRtl } from "@/i18n/routing";
import { analyticsEnabled } from "@/lib/flags";
import { siteUrl } from "@/lib/site-url";

import "../../globals.css";
import "../../creator-motion.css";

/** Absolute addresses for the link preview image, also on the 404 page. */
export function generateMetadata(): Metadata {
  return { metadataBase: siteUrl() };
}

/**
 * The root layout of public creator pages (`/<username>`, rewritten here by proxy.ts). A second root
 * beside `[locale]`: the whole document speaks the page's own language — `lang`, `dir`, the privacy
 * notice, the footer and the 404 — whatever language the visitor's browser prefers. No theme script,
 * no third party, no cookie. The only counting is our own and cookie-free (features/analytics), and
 * only while the server switch is on: otherwise the page carries no counting code at all.
 *
 * What reaches the browser is kept to the page's islands (ADR 0008's page budget): the words they read
 * (`CLIENT_NAMESPACES.creator`: the creator namespace with only the portfolio words its islands use;
 * every other portfolio word is rendered on the server, plan §3.4 P12) and no tooltip or toast code,
 * which a creator page never shows.
 */
export default async function CreatorLayout({ children, params }: { children: ReactNode; params: Promise<{ username: string }> }) {
  const { username } = await params;
  const found = await loadPublicPage(username);
  const locale = found?.page.profile.locale ?? "de";
  setRequestLocale(locale);
  const messages = clientMessages(await getMessages({ locale }), "creator");

  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={fontVariables}>
      <body className="min-h-dvh">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        {/* The cookie-free counter, only while the switch is on: inline, so with it off no byte of it ships. */}
        {found && analyticsEnabled() ? <script data-beacon dangerouslySetInnerHTML={{ __html: beaconScript(found.page.profile.username) }} /> : null}
      </body>
    </html>
  );
}
