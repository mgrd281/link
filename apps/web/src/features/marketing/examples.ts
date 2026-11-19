import type { StaticImageData } from "next/image";

import timoLacht from "@/assets/marketing/examples/timo-lacht.jpg";
import rafaelDuarte from "@/assets/marketing/examples/rafael-duarte.jpg";
import maraVale from "@/assets/marketing/examples/mara-vale.jpg";
import coachYara from "@/assets/marketing/examples/coach-yara.jpg";
import nelaVoss from "@/assets/marketing/examples/nela-voss.jpg";
import adamNour from "@/assets/marketing/examples/adam-nour.jpg";
import baeckereiSonnenkorn from "@/assets/marketing/examples/baeckerei-sonnenkorn.jpg";
import sofiaLaurent from "@/assets/marketing/examples/sofia-laurent.jpg";
import novaplays from "@/assets/marketing/examples/novaplays.jpg";
import matbakhReem from "@/assets/marketing/examples/matbakh-reem.jpg";
import studioMira from "@/assets/marketing/examples/studio-mira.jpg";
import lenaVogt from "@/assets/marketing/examples/lena-vogt.jpg";
import karimAlmansour from "@/assets/marketing/examples/karim-almansour.jpg";
import trattoriaLucia from "@/assets/marketing/examples/trattoria-lucia.jpg";

/**
 * Phone captures of our own fictional example pages (390 × 844, the top of each page), taken from
 * the running product with Playwright. The photos are the examples' own (Unsplash, see CREDITS.md).
 * Used on the marketing home: the hero's page stack and the strip of example pages.
 */
export const EXAMPLE_SHOTS = {
  "timo-lacht": timoLacht,
  "rafael-duarte": rafaelDuarte,
  "mara-vale": maraVale,
  "coach-yara": coachYara,
  "nela-voss": nelaVoss,
  "adam-nour": adamNour,
  "baeckerei-sonnenkorn": baeckereiSonnenkorn,
  "sofia-laurent": sofiaLaurent,
  "novaplays": novaplays,
  "matbakh-reem": matbakhReem,
  "studio-mira": studioMira,
  "lena-vogt": lenaVogt,
  "karim-almansour": karimAlmansour,
  "trattoria-lucia": trattoriaLucia,
} satisfies Record<string, StaticImageData>;

export type ExampleShot = keyof typeof EXAMPLE_SHOTS;

/** The strip, in an order that keeps neighbours different (colors, kinds, languages). */
export const STRIP: readonly ExampleShot[] = [
  "coach-yara", "nela-voss", "adam-nour", "baeckerei-sonnenkorn", "sofia-laurent", "novaplays", "matbakh-reem",
  "studio-mira", "lena-vogt", "karim-almansour", "trattoria-lucia", "timo-lacht", "mara-vale", "rafael-duarte",
];
