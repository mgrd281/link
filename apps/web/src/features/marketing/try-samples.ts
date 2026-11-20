import { siInstagram, siTiktok, siYoutube, type SimpleIcon } from "simple-icons";

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
