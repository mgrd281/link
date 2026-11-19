import { creatorTokens } from "@linkyo/tokens";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import type { CreatorKind } from "@/features/app/kinds";

const SW = creatorTokens.swatches;

/** Look and page kind of each concept page: what "Use this template" starts with. No page content (safe for the browser). */
export const STAR_LOOKS = {
  alshami: { kind: "music", theme: { template: "nocturne", accent: SW.saffron, buttonStyle: "glass" } },
  cristiano: { kind: "other", theme: { template: "nocturne", accent: SW.ruby, mode: "vivid", pairing: "stage" } },
  "donald-trump": { kind: "other", theme: { template: "daylight", accent: SW.navy, pairing: "classic" } },
  "elon-musk": { kind: "business", theme: { template: "mono" } },
  "friedrich-merz": { kind: "other", theme: { template: "daylight", accent: SW["ink-blue"], pairing: "modern", buttonStyle: "soft" } },
  "jeff-bezos": { kind: "business", theme: { template: "daylight", accent: SW.tangerine, pairing: "modern" } },
  messi: { kind: "other", theme: { template: "daylight", accent: SW.celeste, neutral: SW.celeste, tint: 0.6, pairing: "bold" } },
  "mo-salah": { kind: "other", theme: { template: "pulse", accent: SW.wine, pairing: "bold", buttonShape: "pill" } },
  mrbeast: { kind: "youtube", theme: { template: "nocturne", accent: SW.cyan, mode: "vivid", pairing: "bold", buttonShape: "pill" } },
  "nadine-njeim": { kind: "other", theme: { template: "daylight", accent: SW.rose, pairing: "elegant", buttonShape: "pill" } },
  "taim-hassan": { kind: "other", theme: { template: "nocturne", accent: SW.oxblood, buttonStyle: "minimal" } },
  "taylor-swift": { kind: "music", theme: { template: "atelier", accent: SW.mauve, pairing: "elegant", mode: "dark" } },
} as const satisfies Record<string, { kind: CreatorKind; theme: CreatorThemeConfig }>;
