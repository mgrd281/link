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

/** The words of `creator.portfolio` that client islands read; the rest is server-rendered text. */
const ISLAND_WORDS = ["pictureOf", "previousPicture", "nextPicture", "viewer", "closeViewer", "railBack", "railOn", "copyCodeSample", "toPage", "projectMissing"] as const;

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
  // Of a portfolio's words only those its islands read travel to the browser (the picture viewer,
  // the rail buttons, the code sample's copy button, the way back from a missing project); every
  // other portfolio word is rendered on the server and stays there (plan §3.4 P12).
  const all = (await getMessages({ locale })) as Record<string, AbstractIntlMessages | undefined>;
  const { portfolio, ...creator } = (all.creator ?? {}) as Record<string, AbstractIntlMessages | string | undefined>;
  const words = (portfolio ?? {}) as Record<string, AbstractIntlMessages | string | undefined>;
  const islands = Object.fromEntries(ISLAND_WORDS.flatMap((key) => (words[key] === undefined ? [] : [[key, words[key]]])));
  const messages: AbstractIntlMessages = { creator: { ...creator, portfolio: islands }, common: all.common ?? {} };

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
