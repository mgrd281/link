import { pageSchema, type Page } from "@linkyo/blocks";
import { isProjectsStyle, type CreatorThemeConfig } from "@linkyo/tokens/creator";

import type { Legal } from "@/features/account/types";

export interface ImportedSite {
  page: Page;
  theme: CreatorThemeConfig;
  legal: Legal | null;
}

const THEME_STRINGS = ["template", "preset", "accent", "neutral", "mode", "pairing", "buttonStyle", "buttonShape", "background"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads a Linkyo export (Settings → Export) or a bare `{ page, theme }` file. The page is checked
 * with the same schema the API uses; unknown theme keys are dropped. Returns null when the file
 * isn't a Linkyo page.
 */
export function parseImport(text: string): ImportedSite | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const site = isRecord(data) && isRecord(data.site) ? data.site : data;
  if (!isRecord(site)) return null;
  const page = pageSchema.safeParse(site.page);
  if (!page.success) return null;

  const theme: Record<string, string | number> = {};
  if (isRecord(site.theme)) {
    for (const key of THEME_STRINGS) {
      const value = site.theme[key];
      if (typeof value === "string" && value.length <= 40) theme[key] = value;
    }
    if (typeof site.theme.tint === "number" && site.theme.tint >= 0 && site.theme.tint <= 1) theme.tint = site.theme.tint;
    // The owner's work layout is the one layout choice a theme stores. Only a known value is kept
    // (the list above checks length alone), so an export comes back as it went out.
    if (isProjectsStyle(site.theme.projects)) theme.projects = site.theme.projects;
  }

  const legal = isRecord(site.legal)
    ? {
        name: typeof site.legal.name === "string" ? site.legal.name : "",
        address: typeof site.legal.address === "string" ? site.legal.address : "",
        email: typeof site.legal.email === "string" ? site.legal.email : "",
        phone: typeof site.legal.phone === "string" ? site.legal.phone : "",
      }
    : null;

  return { page: page.data, theme, legal };
}
