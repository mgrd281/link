import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { getTranslations } from "next-intl/server";

import { posterSamplePage } from "./poster/sample";
import { directionTheme, type DirectionId } from "./registry";
import { photoTone } from "./shared/media";
import { samplePage } from "./shared/sample";

/** Sample creator page for a locale; the Poster direction arranges the same content in titled sections. */
export async function loadSamplePage(locale: string, direction?: DirectionId) {
  const t = await getTranslations({ locale, namespace: "sampleContent" });
  const translate = (key: string) => t(key);
  const page = samplePage(locale, translate);
  return direction === "poster" ? posterSamplePage(page, translate) : page;
}

/** A direction's starting theme for a page. Poster also picks light or dark to match the portrait. */
export function defaultTheme(direction: DirectionId, page: Page): CreatorThemeConfig {
  const config = directionTheme[direction];
  if (direction !== "poster") return config;
  const tone = photoTone((page.profile.hero ?? page.profile.avatar).src);
  return tone ? { ...config, mode: tone } : config;
}
