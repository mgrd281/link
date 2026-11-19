import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS } from "@/features/examples/looks";

import { ClaimForm } from "./claim-form";
import type { ExampleShot } from "./examples";
import { HeroDeck, type DeckKind, type DeckPage } from "./hero-deck";

export const order = (n: number) => ({ "--i": n }) as CSSProperties;

/** The three pages that take turns in front, with one number from each page. */
const STACK: { slug: ExampleShot; kind: DeckKind; fact: "followers" | "listeners"; count: number }[] = [
  { slug: "lou-ferreira", kind: "fashion", fact: "followers", count: 1_200_000 },
  { slug: "juno-kade", kind: "dj", fact: "listeners", count: 2_300_000 },
  { slug: "layal-mansour", kind: "music", fact: "followers", count: 3_400_000 },
];

/**
 * Light and calm: the promise on the left, real (example) pages on the right that take turns in
 * front (HeroDeck), each with its address above and one number beside it.
 */
export function Hero() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const pills = t.raw("hero.pills") as string[];
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const pages: DeckPage[] = STACK.map(({ slug, kind, fact, count }) => ({
    slug,
    kind,
    name: EXAMPLES[slug]?.profile.displayName ?? slug,
    href: `/${LOOKS[slug].locale}/p/${slug}`,
    stat: t(`hero.${fact}`, { count: compact.format(count) }),
  }));
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto grid w-full max-w-content grid-cols-1 items-center gap-16 px-5 pt-10 pb-12 md:px-10 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 lg:pt-20 lg:pb-20"
    >
      <div className="grid min-w-0 grid-cols-1 justify-items-start gap-6">
        <h1 id="hero-title" className="max-w-full text-h1 tracking-tight text-balance md:text-display md:tracking-display">
          <span className="mk-rise block" style={order(0)}>
            {t("hero.title1")}
          </span>
          <span className="mk-rise block text-link" style={order(1)}>
            {t("hero.title2")}
          </span>
        </h1>
        <ul className="mk-rise flex flex-wrap gap-2" style={order(2)}>
          {pills.map((pill) => (
            <li key={pill} className="inline-flex h-control-sm items-center rounded-full bg-canvas-muted px-3 text-small font-medium text-fg">
              {pill}
            </li>
          ))}
        </ul>
        <p className="mk-rise max-w-prose text-body-lg text-pretty text-fg-secondary" style={order(3)}>
          {t("hero.lead")}
        </p>
        <div className="mk-rise w-full max-w-prose" style={order(4)}>
          <ClaimForm id="hero-claim" />
        </div>
      </div>

      <HeroDeck pages={pages} />
    </section>
  );
}
