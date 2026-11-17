import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Icon } from "@linkyo/ui";
import { ArrowRight, Eye } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PosterRenderer } from "@/features/directions/poster/renderer";
import { previewPage, PREVIEWS } from "@/features/previews/registry";
import { Link } from "@/i18n/navigation";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return Object.entries(PREVIEWS).flatMap(([slug, preview]) => Object.keys(preview.pages).map((locale) => ({ locale, slug })));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) return {};
  const t = await getTranslations({ locale, namespace: "preview" });
  return {
    title: { absolute: t("title", { name: found.page.profile.displayName }) },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) return {};
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  return { themeColor: theme.palette.bg, colorScheme: colorSchemeOf(theme.palette.mode) };
}

/** A creator page prepared for one person, clearly labelled as a private preview. */
export default async function PreviewRoute({ params }: Props) {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("preview");
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  return (
    <>
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      <aside data-theme="dark" aria-label={t("label")} className="flex items-start justify-center gap-2 bg-canvas px-4 py-2 text-center text-caption text-fg-secondary">
        <Icon icon={Eye} size="sm" className="mt-0.5 shrink-0 text-link" />
        <p>
          <strong className="font-semibold text-fg">{t("badge", { name: found.preview.name[locale as "de" | "ar"] ?? found.page.profile.displayName })}</strong> {t("note")}
          {found.page.profile.verified ? ` ${t("verifiedNote")}` : null}
        </p>
      </aside>
      <PosterRenderer page={found.page} theme={theme} />
      <nav aria-label={t("ctaLabel")} className="layer-sticky fixed inset-x-0 bottom-0 flex justify-center px-4 pb-[max(var(--spacing-4),env(safe-area-inset-bottom))]">
        <Link
          href={`/signup?name=${found.preview.username}`}
          className="inline-flex h-control-lg items-center gap-2 rounded-full bg-primary px-5 text-small font-semibold text-primary-fg shadow-e3 transition-colors duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
        >
          {t("cta", { url: `linkyo.app/${found.preview.username}` })}
          <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
        </Link>
      </nav>
    </>
  );
}
