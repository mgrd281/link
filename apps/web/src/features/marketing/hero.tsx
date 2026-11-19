import { Icon } from "@linkyo/ui";
import { Gift, MapPin, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS } from "@/features/examples/looks";

import { ClaimForm } from "./claim-form";
import type { ExampleShot } from "./examples";
import { HeroDeck, type DeckKind, type DeckPage } from "./hero-deck";

export const order = (n: number) => ({ "--i": n }) as CSSProperties;

/** The three pages that take turns in front. */
const STACK: { slug: ExampleShot; kind: DeckKind }[] = [
  { slug: "lou-ferreira", kind: "fashion" },
  { slug: "juno-kade", kind: "dj" },
  { slug: "layal-mansour", kind: "music" },
];

/** The three promises under the address field, each with its own icon. */
const PROMISE_ICONS: LucideIcon[] = [Gift, ShieldCheck, MapPin];

/**
 * Light and calm: the promise and the address field on one side, real (example) pages on the other
 * (HeroDeck). On wide screens the hero fills the first screen and the phones fit inside it; on
 * phones the first phone comes into view right under the address field.
 */
export function Hero() {
  const t = useTranslations("marketing");
  const promises = t.raw("hero.pills") as string[];
  const pages: DeckPage[] = STACK.map(({ slug, kind }) => ({
    slug,
    kind,
    name: EXAMPLES[slug]?.profile.displayName ?? slug,
    href: `/${LOOKS[slug].locale}/p/${slug}`,
  }));
  return (
    <section aria-labelledby="hero-title" className="overflow-x-clip lg:overflow-x-visible">
      <div className="mx-auto grid w-full max-w-content grid-cols-1 items-center gap-10 px-5 pt-6 pb-12 md:px-10 md:pt-12 lg:mk-hero-fit lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 lg:py-8">
        <div className="grid min-w-0 grid-cols-1 justify-items-start gap-5 md:gap-6">
          <h1 id="hero-title" className="max-w-full text-h1 tracking-tight text-balance md:text-display md:tracking-display">
            <span className="mk-rise block" style={order(0)}>
              {t("hero.title1")}
            </span>
            <span className="mk-rise block text-link" style={order(1)}>
              {t("hero.title2")}
            </span>
          </h1>
          <p className="mk-rise max-w-prose text-body text-pretty text-fg-secondary md:text-body-lg" style={order(2)}>
            {t("hero.lead")}
          </p>
          <div className="mk-rise grid w-full max-w-prose gap-4" style={order(3)}>
            <ClaimForm id="hero-claim" />
            <ul aria-label={t("hero.promises")} className="flex flex-wrap gap-x-5 gap-y-2 ps-1">
              {promises.map((promise, index) => (
                <li key={promise} className="inline-flex items-center gap-2 text-small font-medium text-fg-secondary">
                  <Icon icon={PROMISE_ICONS[index] ?? ShieldCheck} size="sm" className="text-primary" />
                  {promise}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <HeroDeck pages={pages} />
      </div>
    </section>
  );
}
