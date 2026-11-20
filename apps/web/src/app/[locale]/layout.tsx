import { tokens } from "@linkyo/tokens";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { fontVariables } from "@/fonts";
import { isRtl, routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import { themeInitScript } from "@/lib/theme-script";

import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: siteUrl(),
    title: { default: t("title"), template: `%s · Linkyo` },
    description: t("description"),
    // The home-screen icon: the symbol on teal, full bleed (iOS rounds the corners itself).
    icons: { icon: "/favicon.svg", apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" } },
    // Added to the home screen it opens like an app: full screen, its own name, the system's status bar.
    appleWebApp: { capable: true, title: "Linkyo", statusBarStyle: "default" },
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

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-canvas text-fg">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
