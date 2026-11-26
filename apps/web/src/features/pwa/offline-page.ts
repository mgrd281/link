import { tokens } from "@linkyo/tokens";

import { isRtl, type Locale } from "@/i18n/routing";
import { themeInitScript } from "@/lib/theme-script";

/**
 * The page the dashboard's service worker shows when a dashboard page cannot load because the device
 * is offline (features/pwa/service-worker.ts). It is one self-contained document, written into the
 * worker when the site is built: the browser keeps it with the worker, so it needs nothing from the
 * network and no cache. Black and grey like the dashboard (the console palette, ADR 0062), light or
 * dark as the device or the stored choice says, the Linkyo symbol, one sentence and "Erneut versuchen",
 * which loads the address again (as does the device coming back online).
 */

export type OfflineKey = "title" | "body" | "retry";

const semantic = tokens.semantic;
/** The dashboard's roles this page draws with, in the console palette (light and dark). */
const PALETTE = {
  ground: semantic.canvasMuted.console,
  fg: semantic.fg.console,
  muted: semantic.fgSecondary.console,
  primary: semantic.primary.console,
  primaryHover: semantic.primaryHover.console,
  primaryFg: semantic.primaryFg.console,
  focus: semantic.focus.console,
} as const;

type Declarations = Record<string, string | number>;
const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const rule = (selector: string, declarations: Declarations) =>
  `${selector}{${Object.entries(declarations)
    .map(([name, value]) => `${kebab(name)}:${String(value)}`)
    .join(";")}}`;
const px = (value: number) => `${String(value)}px`;
const colors = (mode: "light" | "dark"): Declarations => ({
  colorScheme: mode,
  ...Object.fromEntries(Object.entries(PALETTE).map(([name, pair]) => [`--${kebab(name)}`, pair[mode]])),
});

const { spacing, size, radius, text, layout, borderWidth, motion } = tokens;

const STYLE = [
  rule(":root", colors("light")),
  `@media (prefers-color-scheme: dark){${rule(":root:not([data-theme=light])", colors("dark"))}}`,
  rule(":root[data-theme=dark]", colors("dark")),
  rule("html", { backgroundColor: "var(--ground)" }),
  rule("body", {
    margin: 0,
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    backgroundColor: "var(--ground)",
    color: "var(--fg)",
    fontFamily: tokens.font.family.sans.stack,
    textSizeAdjust: "100%",
  }),
  rule("main", {
    boxSizing: "border-box",
    display: "grid",
    justifyItems: "center",
    gap: px(spacing["3"]),
    width: `min(100%, ${px(layout.prose)})`,
    padding: `max(${px(spacing["6"])}, env(safe-area-inset-top)) max(${px(spacing["6"])}, env(safe-area-inset-right)) max(${px(spacing["6"])}, env(safe-area-inset-bottom)) max(${px(spacing["6"])}, env(safe-area-inset-left))`,
    textAlign: "center",
  }),
  rule(".symbol", { width: px(size.controlXl), height: px(size.controlXl), marginBottom: px(spacing["2"]) }),
  rule(".tile", { fill: "var(--fg)" }),
  rule(".tile-stroke", { stroke: "var(--fg)" }),
  rule(".cut", { stroke: "var(--ground)" }),
  rule("h1", { margin: 0, fontSize: px(text.h3.fontSize), lineHeight: text.h3.lineHeight, fontWeight: text.h3.fontWeight, letterSpacing: text.h3.letterSpacing }),
  // Arabic letters must not be spaced apart.
  rule(":root[dir=rtl] h1", { letterSpacing: "normal" }),
  rule("p", { margin: 0, fontSize: px(text.body.fontSize), lineHeight: text.body.lineHeight, color: "var(--muted)", textWrap: "pretty" }),
  rule("button", {
    marginTop: px(spacing["3"]),
    minHeight: px(size.controlLg),
    padding: `0 ${px(spacing["5"])}`,
    border: 0,
    borderRadius: px(radius.md),
    backgroundColor: "var(--primary)",
    color: "var(--primary-fg)",
    font: "inherit",
    fontSize: px(text.body.fontSize),
    fontWeight: tokens.font.weight.semibold,
    cursor: "pointer",
    transition: `background-color ${String(motion.duration.micro)}ms`,
  }),
  rule("button:hover", { backgroundColor: "var(--primary-hover)" }),
  rule("button:focus-visible", { outline: `${px(borderWidth.focus)} solid var(--focus)`, outlineOffset: px(borderWidth.focusOffset) }),
  `@media (prefers-reduced-motion: reduce){${rule("button", { transition: "none" })}}`,
].join("");

/**
 * The Linkyo symbol from the brand's own file (public/favicon.svg: the teal tile, the white y, the tile
 * colour around the short arm), recoloured by the page's styles into the dashboard's mono tone: the
 * tile in the text colour, the y cut out of it in the ground colour.
 */
export function monoSymbol(favicon: string): string {
  const teal = tokens.color.teal["700"];
  const white = tokens.color.white;
  return favicon
    .trim()
    .replace(/<svg\b[^>]*>/, '<svg class="symbol" viewBox="0 0 32 32" aria-hidden="true" focusable="false">')
    .replace(new RegExp(` fill="${teal}"`, "gi"), ' class="tile"')
    .replace(new RegExp(` stroke="${teal}"`, "gi"), ' class="tile-stroke"')
    .replace(new RegExp(` stroke="${white}"`, "gi"), ' class="cut"');
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Reloads the address, on the button and as soon as the device is online again. */
const RETRY_SCRIPT = `(function(){function r(){location.reload()}document.getElementById("retry").addEventListener("click",r);addEventListener("online",r)})();`;

/** The offline page of one language. `t` reads `pwa.offline`; `favicon` is public/favicon.svg. */
export function offlinePage(locale: Locale, t: (key: OfflineKey) => string, favicon: string): string {
  const title = escapeHtml(t("title"));
  const ground = PALETTE.ground;
  return [
    "<!doctype html>",
    `<html lang="${locale}" dir="${isRtl(locale) ? "rtl" : "ltr"}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="robots" content="noindex">',
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${ground.light}">`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${ground.dark}">`,
    `<title>${title} · Linkyo</title>`,
    `<script>${themeInitScript}</script>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    "<main>",
    monoSymbol(favicon),
    `<h1>${title}</h1>`,
    `<p>${escapeHtml(t("body"))}</p>`,
    `<button type="button" id="retry">${escapeHtml(t("retry"))}</button>`,
    "</main>",
    `<script>${RETRY_SCRIPT}</script>`,
    "</body>",
    "</html>",
  ].join("");
}
