import type { Page } from "@linkyo/blocks";
import { hasImage } from "@linkyo/blocks/rules";
import { tokens } from "@linkyo/tokens";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import type { Viewport } from "next";

/**
 * The browser's own top area (the status bar, Safari's and Chrome's bars) over a creator page.
 *
 * Browsers tint it from the page: `theme-color` where they read it, and Safari 26 from the page's
 * background (html, body) at the top. Most heroes open on the page's own ground, so the page colour is
 * right. The bleed hero (Laufbahn) opens edge to edge with a dark picture on phones and tablets: there
 * a light page colour drew a white band above it. Below the wide canvas the top takes the hero's own
 * colour instead: the ink of its ground and veil (`--color-ink`) over a picture, the accent without
 * one (the field that carries the initials). The page below the hero keeps its own ground: the
 * page's root paints `bg-creator-bg` over the body. The wide canvas sets the picture as a plate
 * beside the words on the page's ground, so there the page colour stays.
 */

/** Phones and tablets: below the wide canvas (`@work`), where the bleed hero runs to the top edge. */
export const BELOW_WORK = `(width < ${String(tokens.layout.work)}px)`;

/** The colour at the top of the page below the wide canvas when it is not the page's own, else null. */
export function heroTop(profile: Pick<Page["profile"], "hero" | "avatar">, theme: ResolvedCreatorTheme): string | null {
  if (theme.layout.hero !== "bleed") return null;
  return hasImage(profile.hero) || hasImage(profile.avatar) ? tokens.color.ink : theme.palette.accent;
}

/** The page's `theme-color`: the hero's colour below the wide canvas, the page's own colour else. */
export function browserThemeColor(profile: Pick<Page["profile"], "hero" | "avatar">, theme: ResolvedCreatorTheme): NonNullable<Viewport["themeColor"]> {
  const top = heroTop(profile, theme);
  return top ? [{ media: BELOW_WORK, color: top }, { color: theme.palette.bg }] : theme.palette.bg;
}

/**
 * The document's background (html and body) behind the page: what Safari 26 tints its bars from and
 * what shows in the safe areas and when the page is pulled past its top.
 */
export function rootBackground(profile: Pick<Page["profile"], "hero" | "avatar">, theme: ResolvedCreatorTheme): string {
  const page = `html,body{background-color:${theme.palette.bg}}`;
  const top = heroTop(profile, theme);
  return top ? `${page}@media ${BELOW_WORK}{html,body{background-color:${top}}}` : page;
}
