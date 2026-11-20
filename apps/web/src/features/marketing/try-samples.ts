import { siInstagram, siTiktok, siYoutube, type SimpleIcon } from "simple-icons";

import actressPoster from "@/assets/examples/ex-actress.jpg";
import necklacePicture from "@/assets/examples/ex2-necklace.jpg";
import perfumePicture from "@/assets/examples/ex3-perfume-2.jpg";
import louPortrait from "@/assets/examples/ex6-lou-ferreira.jpg";

export type SampleId = "instagram" | "necklace" | "perfume" | "youtube" | "tiktok";

/**
 * The playground's example links. They are samples: they show what a pasted link becomes, with the
 * pictures of Lou Ferreira (the fictional fashion and jewellery designer of the template gallery), and
 * are never fetched, looked up or carried into a real account. `chip: false` ones are only pasted by
 * the demo.
 */
export const EXAMPLES: readonly { id: SampleId; label: string; url: string; icon: SimpleIcon | null; chip: boolean }[] = [
  { id: "instagram", label: "Instagram", url: "https://instagram.com/louferreira", icon: siInstagram, chip: true },
  { id: "necklace", label: "Shop", url: "https://maison-ferreira.example/products/collier-soleil", icon: null, chip: true },
  { id: "perfume", label: "Shop", url: "https://maison-ferreira.example/products/ambre", icon: null, chip: false },
  { id: "youtube", label: "YouTube", url: "https://youtu.be/gala-look", icon: siYoutube, chip: true },
  { id: "tiktok", label: "TikTok", url: "https://tiktok.com/@louferreira", icon: siTiktok, chip: true },
];

export const sampleOf = (url: string): SampleId | undefined => EXAMPLES.find((example) => example.url === url)?.id;

/**
 * What the shop and video examples show, the same in the controls and on the page: the picture (as a
 * file for the controls' thumbnails, as a sample key for the page), the price, the length.
 */
export const SAMPLE_FACTS = {
  necklace: { picture: necklacePicture, src: "sample:ex2-necklace", price: 2450, currency: "EUR" },
  perfume: { picture: perfumePicture, src: "sample:ex3-perfume-2", price: 185, currency: "EUR" },
  youtube: { picture: actressPoster, src: "sample:ex-actress", duration: 754 },
} as const;

/** The persona the playground introduces itself with: Lou Ferreira, as in the template gallery. */
export const PERSONA = {
  name: "Lou Ferreira",
  photo: { src: "sample:ex6-lou-ferreira", tone: "dark" as const },
  /** The same portrait as a file, for the photo button (without the page's picture catalogue). */
  picture: louPortrait,
  /** Instagram first (an icon under the name), then two pieces from the shop, side by side on the page. */
  links: ["instagram", "necklace", "perfume"] as const satisfies readonly SampleId[],
  look: "nocturne",
};
