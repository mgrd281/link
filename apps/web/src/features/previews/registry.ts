import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { nizarAr, nizarDe } from "./nizar";

/**
 * Private previews: a page prepared for one creator to see before they sign up. Reached only by an
 * unguessable link, never listed or indexed, always labelled as a preview, removed on request.
 */
export interface Preview {
  /** Who the preview is for, per language (shown in the label). */
  name: Partial<Record<"de" | "en" | "ar", string>>;
  /** Address the sign-up call to action pre-fills. */
  username: string;
  theme: CreatorThemeConfig;
  pages: Partial<Record<"de" | "en" | "ar", Page>>;
}

export const PREVIEWS: Record<string, Preview> = {
  "nizar-m3e8dw": { name: { de: "Nizar", ar: "نزار" }, username: "nizarals9", theme: { template: "nocturne" }, pages: { de: nizarDe, ar: nizarAr } },
};

export const previewPage = (slug: string, locale: string) => {
  const preview = PREVIEWS[slug];
  const page = preview?.pages[locale as "de" | "en" | "ar"];
  return preview && page ? { preview, page } : null;
};
