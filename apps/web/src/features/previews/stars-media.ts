import type { StaticImageData } from "next/image";

import starCristiano from "@/assets/stars/cristiano.jpg";
import starDonaldTrump from "@/assets/stars/donald-trump.jpg";
import starElonMusk from "@/assets/stars/elon-musk.jpg";
import starFriedrichMerz from "@/assets/stars/friedrich-merz.jpg";
import starJeffBezos from "@/assets/stars/jeff-bezos.jpg";
import starMessi from "@/assets/stars/messi.jpg";
import starMoSalah from "@/assets/stars/mo-salah.jpg";
import starMrbeast from "@/assets/stars/mrbeast.jpg";
import starNadineNjeim from "@/assets/stars/nadine-njeim.jpg";
import starTaylorSwift from "@/assets/stars/taylor-swift.jpg";

/** Free-licensed portraits for concept pages (credits in assets/stars/CREDITS.md and on each page). */
export const starMedia = {
  "sample:star-cristiano": starCristiano,
  "sample:star-donald-trump": starDonaldTrump,
  "sample:star-elon-musk": starElonMusk,
  "sample:star-friedrich-merz": starFriedrichMerz,
  "sample:star-jeff-bezos": starJeffBezos,
  "sample:star-messi": starMessi,
  "sample:star-mo-salah": starMoSalah,
  "sample:star-mrbeast": starMrbeast,
  "sample:star-nadine-njeim": starNadineNjeim,
  "sample:star-taylor-swift": starTaylorSwift,
} satisfies Record<string, StaticImageData>;
