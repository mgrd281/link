import { creatorTokens } from "@linkyo/tokens";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { LOOKS as GALLERY } from "@/features/examples/looks";

/**
 * The looks to try: one per template, as different from its neighbours as looks get. Mono comes first
 * (the playground starts there), then Lou Ferreira's own Nocturne (where the demo ends), so on a phone
 * both are in view in the row of looks; three of the newer templates follow (a cinema still, a halo,
 * an arch, ADR 0054). Each is the template's own look, as its gallery example wears it.
 */
export const TRY_LOOKS: { id: string; config: CreatorThemeConfig }[] = [
  { id: "mono", config: GALLERY["nela-voss"].theme },
  // Lou Ferreira's: a black stage, gold, the elegant serif, outlined pill buttons.
  { id: "nocturne", config: { template: "nocturne", accent: creatorTokens.swatches["gold-leaf"], pairing: "elegant", buttonStyle: "outline", buttonShape: "pill" } },
  { id: "studio", config: GALLERY.lenz.theme },
  { id: "aura", config: GALLERY["mira-sol"].theme },
  { id: "bloom", config: GALLERY["dana-issa"].theme },
];
