import { tokens } from "@linkyo/tokens";
import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";

/**
 * Installable as an app ("Add to Home Screen"): opens full screen without the browser's bars, straight
 * into the dashboard (the address gets the visitor's language on the way). Icons: the Linkyo symbol on
 * teal, full bleed, so iOS and Android can round the corners themselves (the symbol sits inside the
 * 80 % safe zone of maskable icons).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "meta" });
  return {
    name: "Linkyo",
    short_name: "Linkyo",
    description: t("description"),
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: tokens.semantic.canvas.light,
    theme_color: tokens.semantic.canvas.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
