import type { Metadata } from "next";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { loadPublicPage } from "@/features/creator/public-page";
import { fontVariables } from "@/fonts";
import { isRtl } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";

import "../../globals.css";

/** Absolute addresses for the link preview image, also on the 404 page. */
export function generateMetadata(): Metadata {
  return { metadataBase: siteUrl() };
}

/**
 * The root layout of public creator pages (`/<username>`, rewritten here by proxy.ts). A second root
 * beside `[locale]`: the whole document speaks the page's own language — `lang`, `dir`, the privacy
 * notice, the footer and the 404 — whatever language the visitor's browser prefers. No theme script,
 * no analytics, no third party, no cookie.
 */
export default async function CreatorLayout({ children, params }: { children: ReactNode; params: Promise<{ username: string }> }) {
  const { username } = await params;
  const found = await loadPublicPage(username);
  const locale = found?.page.profile.locale ?? "de";
  setRequestLocale(locale);
  // The page's islands (share, privacy notice, players, copy buttons) only read these two namespaces.
  const all = (await getMessages({ locale })) as Record<string, AbstractIntlMessages | undefined>;
  const messages: AbstractIntlMessages = { creator: all.creator ?? {}, common: all.common ?? {} };

  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={fontVariables}>
      <body className="min-h-dvh">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
