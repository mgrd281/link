import type { CreatorTemplateId } from "@linkyo/tokens";
import type { StaticImageData } from "next/image";

import atelier from "@/assets/templates/atelier.webp";
import aura from "@/assets/templates/aura.webp";
import bloom from "@/assets/templates/bloom.webp";
import daylight from "@/assets/templates/daylight.webp";
import folio from "@/assets/templates/folio.webp";
import laufbahn from "@/assets/templates/laufbahn.webp";
import marquee from "@/assets/templates/marquee.webp";
import mono from "@/assets/templates/mono.webp";
import nocturne from "@/assets/templates/nocturne.webp";
import pulse from "@/assets/templates/pulse.webp";
import signal from "@/assets/templates/signal.webp";
import studio from "@/assets/templates/studio.webp";
import tiefdruck from "@/assets/templates/tiefdruck.webp";
import werkbogen from "@/assets/templates/werkbogen.webp";

/**
 * The real look of each template: the top of a phone's first screen (9:16) of the Poster prototype
 * with the fictional sample creator, taken by `node scripts/capture-example-shots.mjs templates`
 * (portfolio templates show the portfolio sample). The template pickers (Design, the welcome flow,
 * the prototype's dashboard) and the team's Vorlagen show these instead of drawn skeletons.
 *
 * A new template needs its capture and one import here; until then its picker card falls back to its
 * colours, and template-previews.test.ts fails so the gap is never shipped unnoticed.
 */
export const TEMPLATE_PREVIEWS: Partial<Record<CreatorTemplateId, StaticImageData>> = {
  nocturne,
  daylight,
  marquee,
  pulse,
  atelier,
  mono,
  studio,
  aura,
  folio,
  signal,
  bloom,
  werkbogen,
  tiefdruck,
  laufbahn,
};

/** Picker cards: up to a quarter of the 840 px column on laptops, nearly half the screen on phones. */
export const TEMPLATE_PREVIEW_SIZES = "(min-width: 64rem) 14rem, (min-width: 40rem) 30vw, 45vw";
