import type { BlockOf, Page } from "@linkyo/blocks";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";

import { PosterRenderer } from "./renderer";

// Sideways rails that snap: the first picture starts at the page's gutter, so a snap point must sit
// there too. Without scroll padding the first item's snap point lies one gutter further along, and
// Chromium sometimes re-snaps to it once pictures load: the rail then jumps by the gutter, its first
// picture flush with the screen edge (seen on /de/p/messi at 390 px in one capture of ten).

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => createElement("a", { href, ...rest }, children as never),
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/",
}));

const html = (element: ReactNode, locale: "de" | "ar"): string =>
  renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: locale === "ar" ? ar : de, timeZone: "Europe/Berlin", children: element }));

const gallery: BlockOf<"gallery"> = {
  id: "moments",
  type: "gallery",
  title: "Momente",
  visible: true,
  highlight: false,
  images: [
    { src: "sample:mila-hero", alt: "Erstes Bild" },
    { src: "sample:event-berlin", alt: "Zweites Bild" },
    { src: "sample:short-1", alt: "Drittes Bild" },
  ],
};

const page = (locale: "de" | "ar"): Page => ({
  profile: { username: "mila", displayName: "Mila Aurel", bio: "", avatar: { src: "sample:mila-avatar", alt: "" }, verified: false, locale },
  blocks: [gallery],
});

/** The class lists of every element that snaps sideways. */
const snappingScrollers = (markup: string): string[] => [...markup.matchAll(/class="([^"]*\bsnap-x\b[^"]*)"/g)].map((match) => match[1] ?? "");

describe("sideways rails that snap", () => {
  for (const template of ["daylight", "nocturne", "marquee", "mono"] as const) {
    for (const locale of ["de", "ar"] as const) {
      it(`${template} (${locale}): the gallery rail's snap points start at the gutter`, () => {
        const markup = html(createElement(PosterRenderer, { page: page(locale), theme: resolveCreatorTheme({ template }, { rtlScript: locale === "ar" }) }), locale);
        const scrollers = snappingScrollers(markup);
        expect(scrollers.length, "the gallery is a rail that snaps").toBeGreaterThan(0);
        for (const classes of scrollers) {
          expect(classes, "scroll padding equal to the gutter").toMatch(/(^|\s)scroll-px-creator-gutter(\s|$)/);
          expect(classes, "and none where the column has no gutter").toMatch(/(^|\s)@prose:scroll-px-0(\s|$)/);
        }
      });
    }
  }
});
