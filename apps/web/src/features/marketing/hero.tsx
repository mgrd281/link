import { cn, Icon } from "@linkyo/ui";
import { ArrowRight, ArrowUpRight, Gift, MapPin, ShieldCheck, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS } from "@/features/examples/looks";
import { Link } from "@/i18n/navigation";

import { phoneSizes } from "./assets";
import { ClaimForm } from "./claim-form";
import { EXAMPLE_SHOTS, type ExampleShot } from "./examples";

export const order = (n: number) => ({ "--i": n }) as CSSProperties;

type Wide = "start-front" | "start-back" | "end-front" | "end-back";

/**
 * The example pages around the headline (ADR 0038). `fan` is the place in the fan under the address
 * field on phones and tablets: 0 in front in the middle, ±1 beside it, ±2 outermost (tablets only).
 * `wide` is the place beside the headline on wide screens: on each side one page in front, lower and
 * larger, and one behind it, higher and further out. A page without `wide` stays in the fan only.
 */
const PAGES: { slug: ExampleShot; fan: -2 | -1 | 0 | 1 | 2; wide?: Wide }[] = [
  { slug: "kai-moreno", fan: -2, wide: "start-back" },
  { slug: "juno-kade", fan: -1 },
  { slug: "lou-ferreira", fan: 0, wide: "start-front" },
  { slug: "layal-mansour", fan: 1, wide: "end-front" },
  { slug: "nico-hale", fan: 2, wide: "end-back" },
];

/** The three promises under the address field, each with its own icon. */
const PROMISE_ICONS: LucideIcon[] = [Gift, ShieldCheck, MapPin];

/**
 * The first screen, centred and calm: a short news line, the promise on two lines, one sentence,
 * the address field and the three promises. Real example pages frame it: beside the headline on wide
 * screens (always whole inside the first screen), fanned out below it on phones and tablets. Nothing
 * moves on its own: the pages rise in once, and a page straightens and shows its address on hover.
 */
export function Hero() {
  const t = useTranslations("marketing");
  const promises = t.raw("hero.pills") as string[];
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-x-clip">
      <div className="mx-auto grid w-full max-w-content grid-cols-1 justify-items-center gap-5 px-5 pt-10 text-center md:gap-6 md:px-10 md:pt-16 xl:mk-hero-fit xl:content-center xl:py-12">
        <Link
          href="/signup"
          style={order(0)}
          className="mk-rise group inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:border-line-strong hover:text-fg focus-visible:focus-ring"
        >
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-caption font-semibold text-primary-fg">{t("hero.news.badge")}</span>
          <span className="truncate">{t("hero.news.text")}</span>
          <Icon icon={ArrowRight} size="sm" className="shrink-0 transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
        </Link>

        <h1 id="hero-title" className="max-w-full text-h2 tracking-display text-balance md:text-display 2xl:text-display-xl">
          <span className="mk-rise block" style={order(1)}>
            {t("hero.title1")}
          </span>
          <span className="mk-rise block text-link" style={order(2)}>
            {t("hero.title2")}
          </span>
        </h1>

        <p className="mk-rise max-w-prose text-body text-pretty text-fg-secondary md:max-w-none md:text-body-lg" style={order(3)}>
          {t("hero.lead")}
        </p>

        <div className="mk-rise grid w-full max-w-creator justify-items-center gap-4 pt-1" style={order(4)}>
          <ClaimForm id="hero-claim" className="w-full text-start" />
          <ul aria-label={t("hero.promises")} className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {promises.map((promise, index) => (
              <li key={promise} className="inline-flex items-center gap-2 text-small font-medium text-fg-secondary">
                <Icon icon={PROMISE_ICONS[index] ?? ShieldCheck} size="sm" className="text-primary" />
                {promise}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul aria-label={t("hero.pages.label")} className="mk-hero-pages">
        {PAGES.map(({ slug, fan, wide }, index) => {
          const name = EXAMPLES[slug]?.profile.displayName ?? slug;
          return (
            <li key={slug} data-fan={fan} data-wide={wide} style={order(index)} className={cn("mk-hero-page", Math.abs(fan) === 2 && "max-md:hidden")}>
              <a
                href={`/${LOOKS[slug].locale}/p/${slug}`}
                className="group relative block overflow-hidden rounded-xl border border-line bg-surface transition-colors duration-standard hover:border-line-strong focus-visible:focus-ring"
              >
                <span className="relative block aspect-phone">
                  <Image
                    src={EXAMPLE_SHOTS[slug]}
                    alt=""
                    fill
                    sizes={phoneSizes.heroPage}
                    placeholder="blur"
                    preload={fan === 0}
                    fetchPriority={fan === 0 ? "high" : "auto"}
                    loading={fan === 0 ? "eager" : "lazy"}
                    className="object-cover object-top"
                  />
                </span>
                <span className="sr-only">{t("hero.pages.view", { name })}</span>
                {/* The page's address shows on hover and keyboard focus: one link, the whole page. */}
                <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1 rounded-full border border-line bg-surface-elevated py-1 ps-3 pe-1 text-caption font-semibold text-fg opacity-0 transition-opacity duration-standard group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                  <span dir="ltr" className="truncate">
                    linkyo.app/{slug}
                  </span>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-fg">
                    <Icon icon={ArrowUpRight} size="sm" className="rtl:-scale-x-100" />
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
