import type { StaticImageData } from "next/image";

import louFerreira from "@/assets/marketing/examples/lou-ferreira.jpg";
import junoKade from "@/assets/marketing/examples/juno-kade.jpg";
import fenjaRoth from "@/assets/marketing/examples/fenja-roth.jpg";
import nicoHale from "@/assets/marketing/examples/nico-hale.jpg";
import salmaRahhal from "@/assets/marketing/examples/salma-rahhal.jpg";
import eliasNavarro from "@/assets/marketing/examples/elias-navarro.jpg";
import layalMansour from "@/assets/marketing/examples/layal-mansour.jpg";
import tomasReyes from "@/assets/marketing/examples/tomas-reyes.jpg";
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
  "lou-ferreira": louFerreira,
  "juno-kade": junoKade,
  "layal-mansour": layalMansour,
  "nico-hale": nicoHale,
  "fenja-roth": fenjaRoth,
  "salma-rahhal": salmaRahhal,
  "elias-navarro": eliasNavarro,
  "tomas-reyes": tomasReyes,
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

/**
 * The strip, in an order that keeps neighbours different (colors, kinds, languages). The
 * magazine-style portraits lead; older examples with calmer photos follow.
 */
export const STRIP: readonly ExampleShot[] = [
  "lou-ferreira", "juno-kade", "salma-rahhal", "fenja-roth", "nico-hale", "layal-mansour", "tomas-reyes", "elias-navarro",
  "sofia-laurent", "novaplays", "mara-vale", "studio-mira", "timo-lacht", "matbakh-reem",
];

/** The tilted wall beside sign-up and sign-in: people pages only, the most striking first. */
export const WALL: readonly ExampleShot[] = [
  "lou-ferreira", "juno-kade", "layal-mansour", "nico-hale", "salma-rahhal", "fenja-roth",
  "tomas-reyes", "elias-navarro", "sofia-laurent", "mara-vale", "adam-nour", "novaplays",
];
