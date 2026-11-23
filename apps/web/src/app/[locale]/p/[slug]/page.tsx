import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Icon, LogoGlyph } from "@linkyo/ui";
import { Check, Eye, Info, Languages } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PosterRenderer } from "@/features/directions/poster/renderer";
import { LinkyoDock } from "@/features/directions/shared/dock";
import { previewPage, PREVIEWS } from "@/features/previews/registry";
import { Link } from "@/i18n/navigation";

/** Each language in its own name, so people find theirs whatever the page is in. */
const LANGUAGE_NAMES: Record<string, string> = { de: "Deutsch", en: "English", ar: "العربية" };

/** The page's language as Open Graph names it (language_TERRITORY). */
const OG_LOCALES: Record<string, string> = { de: "de_DE", en: "en_US", ar: "ar_AR" };

/** What an example page is an example of: its gallery category, or else its kind of page. */
async function sampleLabel(locale: string, sample: { kind: string; category?: string | undefined }) {
  if (sample.category && sample.kind !== "journalist") return (await getTranslations({ locale, namespace: "examples.categories" }))(sample.category);
  return (await getTranslations({ locale, namespace: "app.welcome.kinds" }))(`${sample.kind}.label`);
}

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
  const sample = found.preview.sample;
  const label = sample ? await sampleLabel(locale, sample) : "";
  const { profile } = found.page;
  const name = profile.displayName;
  // WhatsApp, iMessage and LinkedIn print og:title and og:description under the card: the person's
  // name comes first, and examples and concepts still say what they are.
  const ogTitle = sample ? t("ogTitle.sample", { name, kind: label }) : found.preview.concept ? t("ogTitle.concept", { name }) : t("ogTitle.prepared", { name });
  // Their own line (tagline, else bio); without one the site's description stays.
  const line = [profile.tagline, profile.bio].map((text) => text?.trim() ?? "").find(Boolean) ?? "";
  const description = line.length > 160 ? `${line.slice(0, 159).trimEnd()}…` : line;
  const said = description ? { description } : {};
  return {
    title: {
      absolute: sample ? t("sampleTitle", { kind: label }) : found.preview.concept ? t("conceptTitle", { name }) : t("title", { name }),
    },
    ...said,
    openGraph: { title: ogTitle, ...said, type: "profile", siteName: "Linkyo", locale: OG_LOCALES[locale] ?? "en_US" },
    twitter: { card: "summary_large_image", title: ogTitle, ...said },
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

/**
 * A creator page prepared for one person, clearly labelled as a private preview, or an example page
 * for a kind of creator (a fictional person), labelled as an example.
 */
export default async function PreviewRoute({ params }: Props) {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("preview");
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  const name = found.preview.name[locale as "de" | "en" | "ar"] ?? found.page.profile.displayName;
  const sample = found.preview.sample;
  const kind = sample ? await sampleLabel(locale, sample) : "";
  const concept = found.preview.concept;
  const badge = sample ? t("sampleBadge", { kind }) : concept ? t("conceptBadge", { name }) : t("badge", { name });
  const notes = sample
    ? [t("sampleNote", { name, kind })]
    : concept
      ? [t("conceptNote", { name }), concept.credit ? t("photoCredit", { credit: concept.credit }) : null].filter(Boolean)
      : [
        found.preview.fromOwner ? t("ownNote", { name }) : t("note"),
        found.page.profile.verified ? t("verifiedNote") : null,
        found.page.blocks.some((block) => block.type === "live") ? t("liveNote") : null,
      ].filter(Boolean);
  // Pages that exist in several languages get a language menu next to the label.
  const languages = Object.keys(found.preview.pages);
  const claim = concept ? "/signup" : sample ? `/signup?kind=${sample.kind}${sample.look ? `&look=${sample.look}` : ""}` : `/signup?name=${found.preview.username}${found.preview.invite ? `&invite=${slug}` : ""}`;
  return (
    <>
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      <PosterRenderer
        page={found.page}
        theme={theme}
        overlay={
          // Linkyo's own chrome (not the creator's theme): dark, Geist, Linkyo Teal.
          <aside
            data-theme="dark"
            aria-label={t("label")}
            className="border-line bg-surface text-caption text-fg flex items-center gap-2 rounded-full border py-1 ps-2 pe-1 font-sans"
          >
            <span className="size-control-sm bg-primary text-primary-fg grid place-items-center rounded-full">
              <LogoGlyph className="size-icon-sm" />
            </span>
            <span className="font-semibold">{badge}</span>
            {languages.length > 1 ? (
              <>
                <button
                  type="button"
                  popoverTarget="preview-language"
                  aria-label={t("languageMenu")}
                  className="size-control-sm text-fg-secondary hover:bg-hover hover:text-fg focus-visible:focus-ring grid place-items-center rounded-full"
                >
                  <Icon icon={Languages} size="sm" />
                </button>
                <div
                  id="preview-language"
                  popover="auto"
                  className="border-line bg-surface-elevated text-small text-fg backdrop:bg-scrim inset-x-4 top-16 bottom-auto m-0 mx-auto w-auto max-w-preview rounded-xl border p-2 text-start font-sans"
                >
                  <p className="text-caption text-fg-secondary px-3 py-2 font-semibold">{t("language")}</p>
                  <ul className="grid gap-1">
                    {languages.map((language) => (
                      <li key={language}>
                        <Link
                          href={`/p/${slug}`}
                          locale={language}
                          hrefLang={language}
                          lang={language}
                          aria-current={language === locale ? "page" : undefined}
                          className="h-control-md hover:bg-hover focus-visible:focus-ring aria-[current=page]:text-link flex items-center justify-between gap-3 rounded-md px-3 font-medium"
                        >
                          {LANGUAGE_NAMES[language] ?? language}
                          {language === locale ? <Icon icon={Check} size="sm" /> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
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
              className="max-w-preview border-line bg-surface-elevated text-small text-fg backdrop:bg-scrim inset-x-4 top-16 bottom-auto m-0 mx-auto w-auto rounded-xl border p-4 text-start font-sans"
            >
              <p className="flex items-center gap-2 font-semibold">
                <Icon icon={Eye} size="sm" className="text-link" />
                {badge}
              </p>
              <p className="text-fg-secondary mt-2">{notes.join(" ")}</p>
            </div>
          </aside>
        }
        dock={
          <LinkyoDock
            title={sample || concept ? t("sampleDockTitle") : t("dockTitle")}
            cta={sample || concept ? t("sampleDockCta") : t("dockCta")}
            href={claim}
            closeLabel={t("dockClose")}
          />
        }
      />
    </>
  );
}
