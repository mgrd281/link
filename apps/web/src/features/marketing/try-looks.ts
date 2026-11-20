import { creatorTokens } from "@linkyo/tokens";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { LOOKS as GALLERY } from "@/features/examples/looks";

/**
 * The looks to try: one per template, each a complete look from the template gallery (accent, page
 * color, type, buttons), as different from its neighbours as looks get. The first is Juno Kade's own.
 */
export const TRY_LOOKS: { id: string; config: CreatorThemeConfig }[] = [
  { id: "nocturne", config: GALLERY["juno-kade"].theme },
  { id: "daylight", config: GALLERY["fenja-roth"].theme },
  { id: "pulse", config: { template: "pulse", accent: creatorTokens.swatches.amethyst, pairing: "modern", buttonShape: "pill" } },
  { id: "atelier", config: GALLERY["clara-wendt"].theme },
  { id: "mono", config: GALLERY["nela-voss"].theme },
];
