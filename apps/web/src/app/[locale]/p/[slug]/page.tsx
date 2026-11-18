import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Icon, Logo, LogoSymbol } from "@linkyo/ui";
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
  return Object.entries(PREVIEWS).flatMap(([slug, preview]) =>
    Object.keys(preview.pages).map((locale) => ({ locale, slug })),
  );
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
          // Linkyo's own chrome (not the creator's theme): dark, Geist, Linkyo Violet.
          <aside
            data-theme="dark"
            aria-label={t("label")}
            className="border-line bg-surface text-caption text-fg shadow-e2 flex items-center gap-2 rounded-full border py-1 ps-2 pe-1 font-sans"
          >
            <span className="size-control-sm bg-primary text-primary-fg grid place-items-center rounded-full">
              <LogoSymbol className="size-icon-sm" />
            </span>
            <span className="font-semibold">{t("badge", { name })}</span>
            <button
              type="button"
              popoverTarget="preview-info"
              aria-label={t("more")}
              className="size-control-sm text-fg-secondary hover:bg-hover hover:text-fg focus-visible:focus-ring grid place-items-center rounded-full"
            >
              <Icon icon={Info} size="sm" />
            </button>
            <div
              id="preview-info"
              popover="auto"
              className="max-w-preview border-line bg-surface-elevated text-small text-fg shadow-e3 backdrop:bg-scrim inset-x-4 top-16 bottom-auto m-0 mx-auto w-auto rounded-xl border p-4 text-start font-sans"
            >
              <p className="flex items-center gap-2 font-semibold">
                <Icon icon={Eye} size="sm" className="text-link" />
                {t("badge", { name })}
              </p>
              <p className="text-fg-secondary mt-2">{notes.join(" ")}</p>
            </div>
          </aside>
        }
        dock={
          <div
            data-theme="dark"
            className="max-w-creator border-line bg-surface text-fg shadow-e3 mx-auto flex items-center gap-3 rounded-full border p-2 ps-5 font-sans"
          >
            <Logo className="h-5 shrink-0" title="Linkyo" />
            <span className="text-small text-fg-secondary min-w-0 flex-1 truncate">{t("dockTitle")}</span>
            <Link
              href={`/signup?name=${found.preview.username}${found.preview.invite ? `&invite=${slug}` : ""}`}
              className="h-control-md bg-primary text-small text-primary-fg duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed inline-flex shrink-0 items-center gap-2 rounded-full px-4 font-semibold transition-colors"
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
