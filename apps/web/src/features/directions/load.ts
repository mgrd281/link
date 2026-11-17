import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { getTranslations } from "next-intl/server";

import { posterSamplePage } from "./poster/sample";
import { directionTheme, type DirectionId } from "./registry";
import { samplePage } from "./shared/sample";

/** Sample creator page for a locale; the Poster direction arranges the same content in titled sections. */
export async function loadSamplePage(locale: string, direction?: DirectionId) {
  const t = await getTranslations({ locale, namespace: "sampleContent" });
  const translate = (key: string) => t(key);
  const page = samplePage(locale, translate);
  return direction === "poster" ? posterSamplePage(page, translate) : page;
}

/**
 * A direction's starting theme for a page. Poster starts from the template that suits the portrait
 * (its tone is measured at upload): a dark photo opens Nocturne, a light one Daylight.
 */
export function defaultTheme(direction: DirectionId, page: Page): CreatorThemeConfig {
  const config = directionTheme[direction];
  if (direction !== "poster") return config;
  const tone = (page.profile.hero ?? page.profile.avatar).tone;
  return { template: tone === "light" ? "daylight" : "nocturne" };
}
