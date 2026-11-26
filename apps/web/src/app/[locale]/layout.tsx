import { tokens } from "@linkyo/tokens";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { PageDirection } from "@/components/page-direction";
import { fontVariables } from "@/fonts";
import { siteState } from "@/features/marketing/site-state";
import { clientMessages } from "@/i18n/client-messages";
import { isRtl, routing } from "@/i18n/routing";
import { navPanelInitScript } from "@/lib/nav-panel-script";
import { siteUrl } from "@/lib/site-url";
import { themeInitScript } from "@/lib/theme-script";

import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  // The default for pages without their own (sign-in, the legal pages): it names the cookie-free
  // statistics only where pages are counted (the demo's sample numbers, or real accounts with the
  // counter on), like the home page and the pricing (siteState(), ADR 0084).
  const description = siteState().statistics ? t("description") : (await getTranslations({ locale, namespace: "marketing.real" }))("metaDescription");
  return {
    metadataBase: siteUrl(),
    title: { default: t("title"), template: `%s · Linkyo` },
    description,
    // The home-screen icon: the symbol on teal, full bleed (iOS rounds the corners itself).
    icons: { icon: "/favicon.svg", apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" } },
    // Installable as an app (features/pwa/manifest.ts): this language's manifest, which opens the
    // dashboard in this language. Creator pages under /u have their own root layout and link none.
    manifest: `/${locale}/manifest.webmanifest`,
    // Added to the home screen it opens like an app: full screen, its own name, the system's status bar.
    // `capable` writes `mobile-web-app-capable`; iOS before 16.4 reads only the apple-prefixed name.
    appleWebApp: { capable: true, title: "Linkyo", statusBarStyle: "default" },
    other: { "apple-mobile-web-app-capable": "yes" },
    // Numbers stay numbers (follower counts, codes, prices): no automatic phone or address links.
    formatDetection: { telephone: false, email: false, address: false },
    // Public pages are indexed; private, internal and example pages say otherwise themselves (lib/seo.ts).
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Safari's bars and the status bar take the page's own background (creator pages set their own).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: tokens.semantic.canvas.light },
    { media: "(prefers-color-scheme: dark)", color: tokens.semantic.canvas.dark },
  ],
};

/**
 * The root of every page under a language. It carries only what every page needs in the browser: the
 * words of the website's client components (`CLIENT_NAMESPACES.site`; the dashboard, the team console
 * and the other areas pass their own in their layouts) and the page's direction. Tooltips and toasts
 * come with the areas that show them (`components/providers.tsx`), so the example creator pages under
 * /p load none of that (ADR 0008).
 */
export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Before paint: the stored theme, and the dashboard's folded section panel (no layout shift). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript + navPanelInitScript }} />
      </head>
      <body className="min-h-dvh bg-canvas text-fg">
        <NextIntlClientProvider messages={clientMessages(await getMessages(), "site")}>
          <PageDirection dir={dir}>{children}</PageDirection>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
