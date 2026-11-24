import type { HeroStyle } from "@linkyo/tokens/creator";

/**
 * Where an example or prepared page's label goes (preview-chrome.tsx). The portfolio heroes start
 * with the avatar (statement), the plate (plate) or the name itself (strip, titleblock, readme) right
 * at the top: their label stands in the flow above the page instead of over it, where it would
 * cover them on a phone. The other heroes open with a picture or a band of colour the label may lie
 * on (Laufbahn's bleed makes room for it itself).
 */
export const labelInFlow = (hero: HeroStyle): boolean => hero === "plate" || hero === "statement" || hero === "strip" || hero === "titleblock" || hero === "readme";
