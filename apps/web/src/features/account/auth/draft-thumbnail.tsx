"use client";

import type { Page } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn } from "@linkyo/ui";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { themeStyle } from "@/features/creator/theme";

import { readTryDraft } from "../try-draft";
import { suggestUsername } from "../username";

/** The page renderer, loaded only for a visitor who brings a page from "Try it" (sign-up stays light for everyone else). */
const PosterRenderer = dynamic(() => import("@/features/directions/poster/renderer").then((module) => module.PosterRenderer), { ssr: false });

/** Social profiles that sit as icons under the name, as in the playground. */
const ICON_PROFILES = ["instagram", "tiktok", "x", "threads", "linkedin", "facebook", "github", "whatsapp", "discord"] as const;

interface Draft {
  page: Page;
  theme: ResolvedCreatorTheme;
}

/**
 * The page a visitor built in the homepage's "Try it", shown small while they sign up, so the work
 * stays in sight (it travels in this tab's session storage, see try-draft.ts). The real renderer at a
 * real phone's width, scaled into a little phone and cropped to the top of the page: their photo, name
 * and line. A picture, not a second page: inert and hidden from screen readers; the caption says
 * what it is. Nothing shows without a draft.
 */
export function DraftThumbnail() {
  const t = useTranslations("auth.signup.draft");
  const tTry = useTranslations("marketing.try");
  const tTypes = useTranslations("dashboard.types");
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft | null>(null);
  const screen = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const placeholder = tTry("preview.name");
  const labels = { video: tTypes("video"), music: tTypes("music"), event: tTypes("events") };
  const texts = { video: tTry("samples.video"), necklace: tTry("samples.necklace"), perfume: tTry("samples.perfume") };
  // Plain values for the effect below (the translators change identity on every render).
  const words = JSON.stringify({ placeholder, labels, texts });

  // Read after mounting: the draft lives in the browser only (the server renders nothing here).
  useEffect(() => {
    const tried = readTryDraft();
    if (!tried) return;
    let live = true;
    const { placeholder: name, labels: types, texts: samples } = JSON.parse(words) as { placeholder: string; labels: { video: string; music: string; event: string }; texts: { video: string; necklace: string; perfume: string } };
    void Promise.all([import("@/features/marketing/try-page"), import("@/features/app/import-links"), import("@linkyo/tokens/creator")]).then(([{ buildTryPage }, { socialProfile }, { resolveCreatorTheme }]) => {
      if (!live) return;
      const page = buildTryPage({
        id: "signup-draft",
        displayName: tried.name.trim() || name,
        address: suggestUsername(tried.name),
        tagline: tried.tagline ?? "",
        photo: tried.photo ?? null,
        items: tried.links.map((url, index) => ({ key: `draft-${String(index)}`, url, social: socialProfile(url, ICON_PROFILES)?.platform, sample: undefined })),
        locale,
        labels: types,
        texts: samples,
      });
      setDraft({ page, theme: resolveCreatorTheme(tried.theme ?? { template: "mono" }, { rtlScript: locale === "ar" }) });
    });
    return () => {
      live = false;
    };
  }, [locale, words]);

  // Fit the 390 px wide page into the little phone.
  useEffect(() => {
    const element = screen.current;
    const content = inner.current;
    if (!element || !content) return;
    const measure = () => {
      if (content.offsetWidth > 0) setScale(element.clientWidth / content.offsetWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [draft]);

  if (!draft) return null;
  return (
    <figure className="flex items-center gap-4 rounded-xl border border-line bg-canvas-muted p-3 motion-safe:animate-rise-in">
      {/* A little phone with the top of the page: decoration, the caption says what it is. */}
      <div aria-hidden className="w-20 shrink-0 rounded-lg border border-line-strong bg-ink p-1">
        <div ref={screen} className="relative aspect-portrait overflow-hidden rounded-md bg-creator-bg" style={themeStyle(draft.theme)}>
          <div
            ref={inner}
            inert
            className={cn("absolute start-0 top-0 w-preview origin-top-left bg-creator-bg text-creator-fg rtl:origin-top-right", scale === null && "invisible")}
            style={scale === null ? undefined : { scale }}
          >
            <PosterRenderer page={draft.page} theme={draft.theme} preview />
          </div>
        </div>
      </div>
      <figcaption className="grid min-w-0 gap-1">
        <span className="text-body font-semibold text-balance">{t("title")}</span>
        <span className="text-small text-pretty text-fg-secondary">{t("caption")}</span>
      </figcaption>
    </figure>
  );
}
