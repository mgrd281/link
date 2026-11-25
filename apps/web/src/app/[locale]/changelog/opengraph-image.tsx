import { sitePageImage } from "@/features/marketing/pages/meta";
import { OG_SIZE } from "@/features/share/og-card";
import { routing } from "@/i18n/routing";

/** The link preview of /changelog: its name and title on the site's teal card. */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Linkyo Changelog";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return sitePageImage(locale, "changelog");
}
