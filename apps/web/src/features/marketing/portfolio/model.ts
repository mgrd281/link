import type { CreatorTemplateId } from "@linkyo/tokens";

import type { CreatorKind } from "@/features/app/kinds";
import { LOOKS, type LookId } from "@/features/examples/looks";

/*
 * What the Portfolio section of the website shows, read from code: the gallery's "portfolio"
 * category (features/examples/looks.ts) and the templates those pages use. A new portfolio example
 * or template appears here, in the homepage band and on /portfolio without a copy change.
 */

/**
 * The three fields the /portfolio tabs offer, each as the kinds of page that belong to it. A field
 * without an example page is left out; a new kind joins by adding it here.
 */
export const PROFESSIONS = [
  { key: "photography", kinds: ["photographer"] },
  { key: "design", kinds: ["designer"] },
  { key: "build", kinds: ["developer", "engineer", "freelancer"] },
] as const satisfies readonly { key: string; kinds: readonly CreatorKind[] }[];

export type Profession = (typeof PROFESSIONS)[number]["key"];

/** Every example page in the gallery's Portfolio category, in the gallery's order. */
export function portfolioExamples(): LookId[] {
  return (Object.keys(LOOKS) as LookId[]).filter((slug) => LOOKS[slug].category === "portfolio");
}

/** The templates of the portfolio pages, most used first, each with its example pages. */
export function portfolioTemplates(): { id: CreatorTemplateId; examples: LookId[] }[] {
  const byTemplate = new Map<CreatorTemplateId, LookId[]>();
  for (const slug of portfolioExamples()) {
    const id: CreatorTemplateId = LOOKS[slug].theme.template;
    byTemplate.set(id, [...(byTemplate.get(id) ?? []), slug]);
  }
  // A stable sort: equal counts keep the order of their first example.
  return [...byTemplate].map(([id, examples]) => ({ id, examples })).sort((a, b) => b.examples.length - a.examples.length);
}

/** The fields that have an example page, each with its pages. */
export function professions(): { key: Profession; examples: LookId[] }[] {
  const examples = portfolioExamples();
  return PROFESSIONS.map(({ key, kinds }) => ({
    key,
    examples: examples.filter((slug) => (kinds as readonly CreatorKind[]).includes(LOOKS[slug].kind)),
  })).filter((field) => field.examples.length > 0);
}

/** Where "Start with this template" leads: sign-up with that example's look and kind. */
export const startHref = (slug: LookId): string => `/signup?kind=${LOOKS[slug].kind}&look=${slug}`;

/** An example page's own address (each example exists in its own language only). */
export const pageHref = (slug: LookId): string => `/${LOOKS[slug].locale}/p/${slug}`;
