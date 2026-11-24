import type { StaticImageData } from "next/image";

import yazanKhoury from "@/assets/marketing/examples/yazan-khoury.jpg";
import kaiMoreno from "@/assets/marketing/examples/kai-moreno.jpg";
import moritzAlbrecht from "@/assets/marketing/examples/moritz-albrecht.jpg";
import noahSarkis from "@/assets/marketing/examples/noah-sarkis.jpg";
import theoBaptiste from "@/assets/marketing/examples/theo-baptiste.jpg";
import noelAmadi from "@/assets/marketing/examples/noel-amadi.jpg";
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
import ronjaFeldkamp from "@/assets/marketing/examples/ronja-feldkamp.jpg";
import tobinAchterberg from "@/assets/marketing/examples/tobin-achterberg.jpg";
import alshamiAr from "@/assets/marketing/concepts/alshami.ar.jpg";
import alshamiDe from "@/assets/marketing/concepts/alshami.de.jpg";
import alshamiEn from "@/assets/marketing/concepts/alshami.en.jpg";
import cristianoAr from "@/assets/marketing/concepts/cristiano.ar.jpg";
import cristianoDe from "@/assets/marketing/concepts/cristiano.de.jpg";
import cristianoEn from "@/assets/marketing/concepts/cristiano.en.jpg";
import elonMuskAr from "@/assets/marketing/concepts/elon-musk.ar.jpg";
import elonMuskDe from "@/assets/marketing/concepts/elon-musk.de.jpg";
import elonMuskEn from "@/assets/marketing/concepts/elon-musk.en.jpg";
import jeffBezosAr from "@/assets/marketing/concepts/jeff-bezos.ar.jpg";
import jeffBezosDe from "@/assets/marketing/concepts/jeff-bezos.de.jpg";
import jeffBezosEn from "@/assets/marketing/concepts/jeff-bezos.en.jpg";
import messiAr from "@/assets/marketing/concepts/messi.ar.jpg";
import messiDe from "@/assets/marketing/concepts/messi.de.jpg";
import messiEn from "@/assets/marketing/concepts/messi.en.jpg";
import moSalahAr from "@/assets/marketing/concepts/mo-salah.ar.jpg";
import moSalahDe from "@/assets/marketing/concepts/mo-salah.de.jpg";
import moSalahEn from "@/assets/marketing/concepts/mo-salah.en.jpg";
import mrbeastAr from "@/assets/marketing/concepts/mrbeast.ar.jpg";
import mrbeastDe from "@/assets/marketing/concepts/mrbeast.de.jpg";
import mrbeastEn from "@/assets/marketing/concepts/mrbeast.en.jpg";
import nadineNjeimAr from "@/assets/marketing/concepts/nadine-njeim.ar.jpg";
import nadineNjeimDe from "@/assets/marketing/concepts/nadine-njeim.de.jpg";
import nadineNjeimEn from "@/assets/marketing/concepts/nadine-njeim.en.jpg";
import taylorSwiftAr from "@/assets/marketing/concepts/taylor-swift.ar.jpg";
import taylorSwiftDe from "@/assets/marketing/concepts/taylor-swift.de.jpg";
import taylorSwiftEn from "@/assets/marketing/concepts/taylor-swift.en.jpg";
import alshamiFace from "@/assets/marketing/concepts/faces/alshami.jpg";
import cristianoFace from "@/assets/marketing/concepts/faces/cristiano.jpg";
import elonMuskFace from "@/assets/marketing/concepts/faces/elon-musk.jpg";
import jeffBezosFace from "@/assets/marketing/concepts/faces/jeff-bezos.jpg";
import messiFace from "@/assets/marketing/concepts/faces/messi.jpg";
import moSalahFace from "@/assets/marketing/concepts/faces/mo-salah.jpg";
import mrbeastFace from "@/assets/marketing/concepts/faces/mrbeast.jpg";
import nadineNjeimFace from "@/assets/marketing/concepts/faces/nadine-njeim.jpg";
import taylorSwiftFace from "@/assets/marketing/concepts/faces/taylor-swift.jpg";

/**
 * Phone captures of our own fictional example pages (390 × 844, the top of each page), taken from
 * the running product: `node scripts/capture-example-shots.mjs` retakes them all (after a change to
 * the pages or to Linkyo's chip on them). The photos are the examples' own (Unsplash, see CREDITS.md).
 * Used on the marketing home: the hero's page stack, the strip of example pages and the Portfolio
 * band; and on the Portfolio page.
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
  "yazan-khoury": yazanKhoury,
  "kai-moreno": kaiMoreno,
  "moritz-albrecht": moritzAlbrecht,
  "noah-sarkis": noahSarkis,
  "theo-baptiste": theoBaptiste,
  "noel-amadi": noelAmadi,
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
  // The two portfolio templates (the homepage's Portfolio band and the Portfolio page).
  "ronja-feldkamp": ronjaFeldkamp,
  "tobin-achterberg": tobinAchterberg,
} satisfies Record<string, StaticImageData>;

export type ExampleShot = keyof typeof EXAMPLE_SHOTS;

/**
 * Tall captures (up to two and a half screens) of the unofficial concept pages of well-known people
 * shown in the hero (ADR 0043 to 0045), one per language: these pages exist in German, English and
 * Arabic. The hero scrolls through them. Taken by the same script. The order is the hero's order.
 */
export const CONCEPT_SHOTS = {
  "taylor-swift": { de: taylorSwiftDe, en: taylorSwiftEn, ar: taylorSwiftAr },
  cristiano: { de: cristianoDe, en: cristianoEn, ar: cristianoAr },
  "nadine-njeim": { de: nadineNjeimDe, en: nadineNjeimEn, ar: nadineNjeimAr },
  mrbeast: { de: mrbeastDe, en: mrbeastEn, ar: mrbeastAr },
  alshami: { de: alshamiDe, en: alshamiEn, ar: alshamiAr },
  "jeff-bezos": { de: jeffBezosDe, en: jeffBezosEn, ar: jeffBezosAr },
  "mo-salah": { de: moSalahDe, en: moSalahEn, ar: moSalahAr },
  "elon-musk": { de: elonMuskDe, en: elonMuskEn, ar: elonMuskAr },
  messi: { de: messiDe, en: messiEn, ar: messiAr },
} satisfies Record<string, Record<"de" | "en" | "ar", StaticImageData>>;

export type ConceptShot = keyof typeof CONCEPT_SHOTS;

/**
 * A face for each concept page, cut square from the page's own credited portrait (Al Shami: the
 * artwork of his official video, as on his page). They are the buttons under the hero's pages.
 */
export const CONCEPT_FACES = {
  "taylor-swift": taylorSwiftFace,
  cristiano: cristianoFace,
  "nadine-njeim": nadineNjeimFace,
  mrbeast: mrbeastFace,
  alshami: alshamiFace,
  "jeff-bezos": jeffBezosFace,
  "mo-salah": moSalahFace,
  "elon-musk": elonMuskFace,
  messi: messiFace,
} satisfies Record<ConceptShot, StaticImageData>;

/**
 * The strip, in an order that keeps neighbours different (colors, kinds, languages). The
 * magazine-style portraits lead; older examples with calmer photos follow.
 */
export const STRIP: readonly ExampleShot[] = [
  "lou-ferreira", "yazan-khoury", "juno-kade", "noel-amadi", "layal-mansour", "theo-baptiste", "salma-rahhal", "kai-moreno",
  "fenja-roth", "moritz-albrecht", "nico-hale", "noah-sarkis", "tomas-reyes", "elias-navarro", "sofia-laurent", "mara-vale",
];

/** The tilted wall beside sign-up and sign-in: people pages only, the most striking first. */
export const WALL: readonly ExampleShot[] = [
  "lou-ferreira", "noel-amadi", "juno-kade", "yazan-khoury", "layal-mansour", "theo-baptiste",
  "nico-hale", "salma-rahhal", "kai-moreno", "fenja-roth", "moritz-albrecht", "tomas-reyes",
  "noah-sarkis", "elias-navarro", "sofia-laurent", "mara-vale", "adam-nour", "novaplays",
];
