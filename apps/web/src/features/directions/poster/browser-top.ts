import type { Page } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import type { Viewport } from "next";

/**
 * The browser's own top area (the status bar, Safari's and Chrome's bars) over a creator page.
 *
 * Browsers tint it from the page: `theme-color` where they read it, and Safari 26 from the page's
 * background (html, body) at the top. Most heroes open on the page's own ground, so the page colour is
 * right. Laufbahn (the bleed hero, ADR 0069 round 6) opens with its head on ink at every width, with
 * or without a picture, and closes with its Kontakt band on ink: there the top is ink, at every width.
 * The page between keeps its own ground: the page's root paints `bg-creator-bg` over the body.
 */

/** The colour at the top of the page when it is not the page's own, else null. */
export function heroTop(_profile: Pick<Page["profile"], "hero" | "avatar">, theme: ResolvedCreatorTheme): string | null {
  return theme.layout.hero === "bleed" ? tokens.color.ink : null;
}

/** The page's `theme-color`: the head's ink on Laufbahn, the page's own colour else. */
export function browserThemeColor(profile: Pick<Page["profile"], "hero" | "avatar">, theme: ResolvedCreatorTheme): NonNullable<Viewport["themeColor"]> {
  return heroTop(profile, theme) ?? theme.palette.bg;
}

/**
 * The document's background (html and body) behind the page: what Safari 26 tints its bars from and
 * what shows in the safe areas and when the page is pulled past its top or its foot.
 */
export function rootBackground(profile: Pick<Page["profile"], "hero" | "avatar">, theme: ResolvedCreatorTheme): string {
  return `html,body{background-color:${heroTop(profile, theme) ?? theme.palette.bg}}`;
}
