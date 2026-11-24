import { isBlockActive, type Page } from "@linkyo/blocks";
import { resolveCreatorTheme, TEMPLATE_IDS, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS, type Look } from "@/features/examples/looks";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { samplePage } from "../shared/sample";
import { PosterRenderer } from "./renderer";
import { portfolioSample, posterSamplePage } from "./sample";

// The block marks (renderer.tsx): every block a page shows sits inside an element that names it with
// `data-block="<id>"`, the contract the per-block counts rely on. Rendered to HTML in Node.

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => createElement("a", { href, ...rest }, children as never),
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/",
}));
// The official store badges are static SVG imports that Node cannot size; they belong to their app's
// card, which carries the mark, so they are left out here.
vi.mock("./store-badges", () => ({
  hasBadges: () => false,
  StoreBadges: () => null,
}));

type Locale = "de" | "en" | "ar";
const MESSAGES = { de, en, ar };
const NOW = new Date();

const html = (element: ReactNode, locale: Locale): string =>
  renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: MESSAGES[locale], timeZone: "Europe/Berlin", now: NOW, children: element }));

/** The ids named by block marks in a page's markup. */
const marked = (markup: string): Set<string> => new Set([...markup.matchAll(/ data-block="([^"]+)"/g)].map((match) => match[1] ?? ""));

/** The blocks a visitor sees today, without section titles (header blocks are not marked). */
const expected = (page: Page): string[] => page.blocks.filter((block) => isBlockActive(block, NOW) && block.type !== "header").map((block) => block.id);

const musicSample = (locale: Locale): Page => {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "sampleContent" });
  const translate = (key: string) => t(key as never);
  return posterSamplePage(samplePage(locale, translate), translate);
};

function check(page: Page, config: CreatorThemeConfig, locale: Locale, label: string) {
  const theme = resolveCreatorTheme(config, { rtlScript: locale === "ar" });
  for (const preview of [false, true]) {
    const markup = html(createElement(PosterRenderer, { page, theme, preview, projectBase: `/${locale}/p/sample` }), locale);
    const ids = marked(markup);
    const missing = expected(page).filter((id) => !ids.has(id));
    expect(missing, `${label} ${preview ? "preview" : "page"}: blocks without a mark`).toEqual([]);
    // Marks name blocks only: every marked id is a block of the page.
    const known = new Set(page.blocks.map((block) => block.id));
    expect([...ids].filter((id) => !known.has(id)), `${label}: marks that name no block`).toEqual([]);
  }
}

describe("block marks", () => {
  it("name every block of the music sample in every template, in German and Arabic", () => {
    for (const locale of ["de", "ar"] as const) {
      const page = musicSample(locale);
      for (const template of TEMPLATE_IDS) check(page, { template }, locale, `music ${template} ${locale}`);
    }
  });

  it("name every block of the portfolio sample (projects, the plate, the contact action) in every portfolio-capable template", () => {
    for (const locale of ["de", "ar"] as const) {
      const page = portfolioSample(locale);
      for (const template of TEMPLATE_IDS) check(page, { template }, locale, `portfolio ${template} ${locale}`);
    }
  });

  it("name every block of every example page in its own look (rows, videos, products, apps, live)", () => {
    for (const [slug, look] of Object.entries(LOOKS) as [string, Look][]) {
      const page = EXAMPLES[slug];
      if (!page) continue;
      check(page, look.theme, look.locale, slug);
    }
  });

  it("put a block of its own in a box that takes no room on the page", () => {
    const page = portfolioSample("de");
    const markup = html(createElement(PosterRenderer, { page, theme: resolveCreatorTheme({ template: "werkbogen" }) }), "de");
    const about = page.blocks.find((block) => block.type === "about");
    expect(about).toBeDefined();
    expect(markup).toContain(`<div class="contents" data-block="${about?.id ?? ""}">`);
  });
});
