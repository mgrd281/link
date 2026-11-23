import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { Icon, LogoGlyph } from "@linkyo/ui";
import { Check, Eye, Info, Languages } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LinkyoDock } from "@/features/directions/shared/dock";
import { Link } from "@/i18n/navigation";

import type { Preview } from "./registry";

/** Each language in its own name, so people find theirs whatever the page is in. */
const LANGUAGE_NAMES: Record<string, string> = { de: "Deutsch", en: "English", ar: "العربية" };

/** What an example page is an example of: its gallery category, or else its kind of page. */
export async function sampleLabel(locale: string, sample: { kind: string; category?: string | undefined }): Promise<string> {
  if (sample.category && sample.kind !== "journalist") return (await getTranslations({ locale, namespace: "examples.categories" }))(sample.category);
  return (await getTranslations({ locale, namespace: "app.welcome.kinds" }))(`${sample.kind}.label`);
}

export interface PreviewChrome {
  /** The label laid over the top of a classic hero (the renderer places it). */
  overlay: ReactNode;
  /**
   * The label in the page's flow, above the page, for the two portfolio heroes: laid over them it
   * would cover the round avatar (statement) or the plate's corner (plate). Null otherwise.
   */
  above: ReactNode;
  /** The label for a project page, which places it in its flow right under its bar. */
  badge: ReactNode;
  /** Linkyo's bar at the bottom, with the way to an own page. */
  dock: ReactNode;
}

/**
 * Linkyo's own chrome on a prepared, concept or example page and on its project pages: the label
 * ("Example · Photography") with its language menu and its info popover, and the dock. Linkyo's
 * look (dark, Geist, Linkyo Teal), clearly apart from the creator's design. An example page with
 * projects says in its popover whose photographs it shows (a portfolio presents pictures as work).
 */
export async function previewChrome({
  preview,
  page,
  slug,
  locale,
  theme,
  path = "",
}: {
  preview: Preview;
  page: { profile: { displayName: string; verified?: boolean | undefined }; blocks: readonly { type: string }[] };
  slug: string;
  locale: string;
  theme: ResolvedCreatorTheme;
  /** What follows "/p/<slug>" in the language menu's links (a project page's "/<project>"). */
  path?: string | undefined;
}): Promise<PreviewChrome> {
  const t = await getTranslations({ locale, namespace: "preview" });
  const name = preview.name[locale as "de" | "en" | "ar"] ?? page.profile.displayName;
  const sample = preview.sample;
  const kind = sample ? await sampleLabel(locale, sample) : "";
  const concept = preview.concept;
  const label = sample ? t("sampleBadge", { kind }) : concept ? t("conceptBadge", { name }) : t("badge", { name });
  const portfolio = page.blocks.some((block) => block.type === "project");
  const notes = sample
    ? [t("sampleNote", { name, kind }), ...(portfolio && sample.credit ? [t("samplePictures"), t("photoCredit", { credit: sample.credit })] : [])]
    : concept
      ? [t("conceptNote", { name }), concept.credit ? t("photoCredit", { credit: concept.credit }) : null].filter(Boolean)
      : [preview.fromOwner ? t("ownNote", { name }) : t("note"), page.profile.verified ? t("verifiedNote") : null, page.blocks.some((block) => block.type === "live") ? t("liveNote") : null].filter(Boolean);
  // Pages that exist in several languages get a language menu next to the label.
  const languages = Object.keys(preview.pages);
  const claim = concept ? "/signup" : sample ? `/signup?kind=${sample.kind}${sample.look ? `&look=${sample.look}` : ""}` : `/signup?name=${preview.username}${preview.invite ? `&invite=${slug}` : ""}`;

  const badge = (
    // Linkyo's own chrome (not the creator's theme): dark, Geist, Linkyo Teal.
    <aside data-theme="dark" data-preview-badge aria-label={t("label")} className="border-line bg-surface text-caption text-fg flex items-center gap-2 rounded-full border py-1 ps-2 pe-1 font-sans">
      <span className="size-control-sm bg-primary text-primary-fg grid place-items-center rounded-full">
        <LogoGlyph className="size-icon-sm" />
      </span>
      <span className="font-semibold">{label}</span>
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
                    href={`/p/${slug}${path}`}
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
          {label}
        </p>
        <p className="text-fg-secondary mt-2">{notes.join(" ")}</p>
      </div>
    </aside>
  );

  const dock = (
    <LinkyoDock
      title={sample || concept ? t("sampleDockTitle") : t("dockTitle")}
      cta={sample || concept ? t("sampleDockCta") : t("dockCta")}
      href={claim}
      closeLabel={t("dockClose")}
    />
  );

  // The two portfolio heroes start with the avatar (statement) or the plate (plate) right at the top:
  // their label stands in the flow above the page instead of over it.
  const inFlow = theme.layout.hero === "plate" || theme.layout.hero === "statement";
  return {
    overlay: inFlow ? undefined : badge,
    above: inFlow ? (
      <div dir={locale === "ar" ? "rtl" : "ltr"} className="flex justify-center px-4 pt-3">
        {badge}
      </div>
    ) : null,
    badge,
    dock,
  };
}
