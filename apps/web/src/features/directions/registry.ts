import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

export const DIRECTIONS = ["gallery", "stage", "mosaic"] as const;
export type DirectionId = (typeof DIRECTIONS)[number];

export const isDirection = (value: string): value is DirectionId => (DIRECTIONS as readonly string[]).includes(value);

/** Each direction's default creator theme. Any preset works with any direction. */
export const directionTheme: Record<DirectionId, CreatorThemeConfig> = {
  gallery: { preset: "paper" },
  stage: { preset: "midnight", pairing: "stage", buttonStyle: "glass", buttonShape: "pill" },
  mosaic: { preset: "sunset" },
};
