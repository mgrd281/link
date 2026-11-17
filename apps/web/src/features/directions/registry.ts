import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

/** "poster" is the direction built from the references the user sent; the other three are kept for comparison. */
export const DIRECTIONS = ["poster", "gallery", "stage", "mosaic"] as const;
export type DirectionId = (typeof DIRECTIONS)[number];

export const isDirection = (value: string): value is DirectionId => (DIRECTIONS as readonly string[]).includes(value);

/** Each direction's default creator theme. Any preset works with any direction. */
export const directionTheme: Record<DirectionId, CreatorThemeConfig> = {
  // Poster looks come from templates (see @linkyo/tokens creator.template); Nocturne is the default.
  poster: { template: "nocturne" },
  gallery: { preset: "paper" },
  stage: { preset: "midnight", pairing: "stage", buttonStyle: "glass", buttonShape: "pill" },
  mosaic: { preset: "sunset" },
};

export const THEME_MODES = ["light", "dark"] as const;
export type ThemeModeParam = (typeof THEME_MODES)[number];
export const isThemeMode = (value: string | undefined): value is ThemeModeParam => value === "light" || value === "dark";
