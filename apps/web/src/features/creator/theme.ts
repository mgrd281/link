import { resolveCreatorTheme, type CreatorThemeConfig, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import type { CSSProperties } from "react";

/** Inline style that applies a creator theme to a subtree (all values come from the theme engine). */
export function themeStyle(theme: ResolvedCreatorTheme): CSSProperties {
  return theme.cssVars;
}

export function creatorTheme(config: CreatorThemeConfig, options?: { rtlScript?: boolean }): ResolvedCreatorTheme {
  return resolveCreatorTheme(config, options);
}
