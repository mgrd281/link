import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Icon, LogoSymbol } from "@linkyo/ui";
import { ArrowRight, Eye, Info } from "lucide-react";
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
// Re-rendered every few minutes so day-relative details (tonight's live) stay current.
export const revalidate = 300;

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
  const name = found.preview.name[locale as "de" | "ar"] ?? found.page.profile.displayName;
  const notes = [
    t("note"),
    found.page.profile.verified ? t("verifiedNote") : null,
    found.page.blocks.some((block) => block.type === "live") ? t("liveNote") : null,
  ].filter(Boolean);
  return (
    <>
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      <PosterRenderer
        page={found.page}
        theme={theme}
        overlay={
          <aside aria-label={t("label")} className="flex items-center gap-1 rounded-full border border-creator-line bg-creator-glass py-1 ps-3 pe-1 text-caption text-creator-fg shadow-e2 backdrop-blur-glass">
            <Icon icon={Eye} size="sm" className="shrink-0" />
            <span className="font-semibold">{t("badge", { name })}</span>
            <button
              type="button"
              popoverTarget="preview-info"
              aria-label={t("more")}
              className="grid size-control-sm place-items-center rounded-full hover:bg-creator-surface-2 focus-visible:focus-ring"
            >
              <Icon icon={Info} size="sm" />
            </button>
            <div
              id="preview-info"
              popover="auto"
              className="inset-x-4 top-16 bottom-auto m-0 mx-auto w-auto max-w-preview rounded-xl border border-creator-line bg-creator-surface p-4 text-start text-small text-creator-fg shadow-e3 backdrop:bg-scrim"
            >
              <p className="font-semibold">{t("badge", { name })}</p>
              <p className="mt-1 text-creator-fg-muted">{notes.join(" ")}</p>
            </div>
          </aside>
        }
        dock={
          <div className="mx-auto flex max-w-creator items-center gap-3 rounded-full border border-creator-line-strong bg-creator-surface p-2 ps-4 text-creator-fg shadow-e3">
            <LogoSymbol className="size-icon-md shrink-0" />
            <p className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-small font-semibold">{t("dockTitle")}</span>
              <span dir="ltr" className="truncate text-start text-caption text-creator-fg-muted">
                linkyo.app/{found.preview.username}
              </span>
            </p>
            <Link
              href={`/signup?name=${found.preview.username}`}
              className="inline-flex h-control-md shrink-0 items-center gap-2 rounded-full bg-creator-accent px-4 text-small font-semibold text-creator-accent-fg transition-transform duration-micro focus-visible:focus-ring active:scale-pressed"
            >
              {t("dockCta")}
              <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
            </Link>
          </div>
        }
      />
    </>
  );
}
