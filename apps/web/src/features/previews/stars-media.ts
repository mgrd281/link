import type { StaticImageData } from "next/image";

import starCristiano from "@/assets/stars/cristiano.jpg";
import starDonaldTrump from "@/assets/stars/donald-trump.jpg";
import starElonMusk from "@/assets/stars/elon-musk.jpg";
import starFriedrichMerz from "@/assets/stars/friedrich-merz.jpg";
import starJeffBezos from "@/assets/stars/jeff-bezos.jpg";
import starMessi from "@/assets/stars/messi.jpg";
import starMessiArgentina from "@/assets/stars/messi-argentina.jpg";
import starMessiBarcelona from "@/assets/stars/messi-barcelona.jpg";
import starMessiPsg from "@/assets/stars/messi-psg.jpg";
import starMessiMiami from "@/assets/stars/messi-miami.jpg";
import starMessiG1 from "@/assets/stars/messi-g1.jpg";
import starMessiG2 from "@/assets/stars/messi-g2.jpg";
import starMessiG3 from "@/assets/stars/messi-g3.jpg";
import starMessiG4 from "@/assets/stars/messi-g4.jpg";
import starMessiWc2022 from "@/assets/stars/messi-wc2022.jpg";
import starMessiWc2026 from "@/assets/stars/messi-wc2026.jpg";
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
  "sample:star-messi-argentina": starMessiArgentina,
  "sample:star-messi-barcelona": starMessiBarcelona,
  "sample:star-messi-psg": starMessiPsg,
  "sample:star-messi-miami": starMessiMiami,
  "sample:star-messi-g1": starMessiG1,
  "sample:star-messi-g2": starMessiG2,
  "sample:star-messi-g3": starMessiG3,
  "sample:star-messi-g4": starMessiG4,
  "sample:star-messi-wc2022": starMessiWc2022,
  "sample:star-messi-wc2026": starMessiWc2026,
  "sample:star-mo-salah": starMoSalah,
  "sample:star-mrbeast": starMrbeast,
  "sample:star-nadine-njeim": starNadineNjeim,
  "sample:star-taylor-swift": starTaylorSwift,
} satisfies Record<string, StaticImageData>;
