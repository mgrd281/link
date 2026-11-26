import { tokens } from "@linkyo/tokens";
import type { MetadataRoute } from "next";

import { NAV_ANCHORS } from "@/features/app/routes";
import { isRtl, type Locale } from "@/i18n/routing";

/**
 * Linkyo as an app (ADR draft "installable app"): one web app manifest per language, served at
 * `/<locale>/manifest.webmanifest` and linked by the language's root layout. Every language installs
 * the same app (one `id`), which opens the dashboard in that language in its own window.
 *
 * - Colours: the dashboard's grey ground (the console palette's muted canvas, ADR 0062) for the title
 *   bar and the launch screen, so a start from the icon shows no white before the dashboard. A
 *   manifest has one colour for each; dark mode is the page's own: the dashboard's `theme-color` metas
 *   (one per colour scheme) take over the title bar as soon as it loads, and the ground is dark.
 * - `display_override` stays out: the dashboard does not draw into the title bar area
 *   (window-controls-overlay), so `standalone` is all it asks for.
 * - The share target hands what was shared to `/<locale>/app/share` (`features/pwa/share-target.ts`).
 */

/** The installed app's identity: the same for every language, and the one the first manifest (start_url /app) implied. */
export const APP_ID = "/app";

/** Where a start from the icon lands; `source=app` tells such a start from a visit in the browser. */
export const startUrl = (locale: Locale) => `/${locale}/app?source=app`;

/** Where Android and desktop Chrome send a shared link (GET; the names of the three fields are the spec's). */
export const shareAction = (locale: Locale) => `/${locale}/app/share`;

/** The icons (scripts/generate-app-icons.mjs draws them from the brand files). */
export const MANIFEST_ICONS: NonNullable<MetadataRoute.Manifest["icons"]> = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  { src: "/icons/monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
];

/**
 * The pictures Chrome's richer install dialog shows (scripts/capture-app-screenshots.mjs takes them
 * from the demo build, with the fictional sample creator): the dashboard and a creator page, on a
 * phone (narrow) and on a laptop (wide). One set per language, under `/screenshots/<locale>/`: the
 * dashboard's own words and the sample page in that language, mirrored in Arabic.
 */
export const MANIFEST_SCREENSHOTS = [
  { file: "dashboard-phone.jpg", sizes: "780x1688", form_factor: "narrow", label: "dashboard" },
  { file: "page-phone.jpg", sizes: "780x1688", form_factor: "narrow", label: "page" },
  { file: "dashboard-laptop.jpg", sizes: "1440x900", form_factor: "wide", label: "dashboard" },
  { file: "page-laptop.jpg", sizes: "1440x900", form_factor: "wide", label: "page" },
] as const;

/** A screenshot's address in a language's set. */
export const screenshotSrc = (locale: Locale, file: string) => `/screenshots/${locale}/${file}`;

/** The words a manifest needs, under `pwa` in the messages. */
export type ManifestKey =
  | "shortName"
  | "description"
  | "shortcuts.editor"
  | "shortcuts.editorDescription"
  | "shortcuts.add"
  | "shortcuts.addDescription"
  | "shortcuts.analytics"
  | "shortcuts.analyticsDescription"
  | "shortcuts.share"
  | "shortcuts.shareDescription"
  | "screenshots.dashboard"
  | "screenshots.page";

/**
 * Fields the web app manifest has and Next's type does not list yet. Browsers read them from the
 * JSON as they are (`launch_handler`: Chrome and Edge; `share_target`: Chrome on Android and desktop;
 * `form_factor` on screenshots: Chrome's richer install dialog).
 */
export interface AppManifest extends Omit<MetadataRoute.Manifest, "screenshots"> {
  id: string;
  lang: string;
  dir: "ltr" | "rtl";
  launch_handler: { client_mode: "focus-existing" | "navigate-existing" | "navigate-new" | "auto" };
  screenshots: { src: string; sizes: string; type: string; form_factor: "narrow" | "wide"; label: string }[];
  share_target: { action: string; method: "GET"; enctype: "application/x-www-form-urlencoded"; params: { title: string; text: string; url: string } };
}

/** The manifest of one language. `t` reads the `pwa` messages of that language. */
export function appManifest(locale: Locale, t: (key: ManifestKey) => string): AppManifest {
  const ground = tokens.semantic.canvasMuted.console.light;
  const app = `/${locale}/app`;
  return {
    id: APP_ID,
    name: "Linkyo",
    short_name: t("shortName"),
    description: t("description"),
    lang: locale,
    dir: isRtl(locale) ? "rtl" : "ltr",
    start_url: startUrl(locale),
    scope: "/",
    display: "standalone",
    theme_color: ground,
    background_color: ground,
    categories: ["social", "productivity", "business"],
    launch_handler: { client_mode: "focus-existing" },
    icons: MANIFEST_ICONS,
    shortcuts: [
      { name: t("shortcuts.editor"), description: t("shortcuts.editorDescription"), url: `${app}/editor` },
      // Home opens the Add sheet for `?add=1` (features/app/install/intents.ts).
      { name: t("shortcuts.add"), description: t("shortcuts.addDescription"), url: `${app}?add=1` },
      { name: t("shortcuts.analytics"), description: t("shortcuts.analyticsDescription"), url: `${app}/analytics` },
      // Home's link card: copy, share, QR code (the section panel's "Your link" jumps there the same way).
      { name: t("shortcuts.share"), description: t("shortcuts.shareDescription"), url: `${app}#${NAV_ANCHORS.homeLink}` },
    ],
    screenshots: MANIFEST_SCREENSHOTS.map(({ file, label, ...shot }) => ({ src: screenshotSrc(locale, file), ...shot, type: "image/jpeg", label: t(`screenshots.${label}`) })),
    // `enctype` only matters for POST; Chrome reports its absence as a (non-critical) manifest error.
    share_target: { action: shareAction(locale), method: "GET", enctype: "application/x-www-form-urlencoded", params: { title: "title", text: "text", url: "url" } },
  };
}
