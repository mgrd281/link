import { LogoSymbol } from "@linkyo/ui";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { phoneSizes } from "./assets";
import { ClaimForm } from "./claim-form";
import { EXAMPLE_SHOTS, type ExampleShot } from "./examples";
import { MotionToggle } from "./motion-toggle";

export const order = (n: number) => ({ "--i": n }) as CSSProperties;

/** The three pages that take turns in front, with one number from each page. */
const STACK: { slug: ExampleShot; kind: "comedy" | "music" | "sport"; fact: "followers" | "listeners"; count: number }[] = [
  { slug: "timo-lacht", kind: "comedy", fact: "followers", count: 2_400_000 },
  { slug: "rafael-duarte", kind: "sport", fact: "followers", count: 4_100_000 },
  { slug: "mara-vale", kind: "music", fact: "listeners", count: 12_000_000 },
];
/** Resting slots (front, right, left): where the turns start, and the still layout for reduced motion. */
const SLOTS = [
  { slot: 0, side: 0 },
  { slot: 1, side: 1 },
  { slot: -1, side: 1 },
] as const;

/**
 * Light and calm: the promise on the left, real (example) pages on the right that take turns in
 * front, each with its address above and one number below. Pausable; still for reduced motion.
 */
export function Hero() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const pills = t.raw("hero.pills") as string[];
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto grid w-full max-w-content grid-cols-1 items-center gap-16 px-5 pt-10 pb-12 md:px-10 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 lg:pt-20 lg:pb-20"
    >
      <div className="grid min-w-0 grid-cols-1 justify-items-start gap-6">
        <h1 id="hero-title" className="max-w-full text-display tracking-display text-balance md:text-display-xl">
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

      <MotionToggle
        pauseLabel={t("hero.stackPause")}
        playLabel={t("hero.stackPlay")}
        className="mx-auto w-full max-w-creator"
        buttonClassName="end-0 bottom-0"
      >
        <p className="sr-only">{t("hero.phones")}</p>
        <div aria-hidden className="mk-stack mk-phone-in relative aspect-square w-full">
          {STACK.map((page, index) => (
            <div
              key={page.slug}
              className="mk-stack-card absolute inset-x-0 top-12 mx-auto w-5/12"
              style={{ "--i": index, "--slot": SLOTS[index]?.slot ?? 0, "--side": SLOTS[index]?.side ?? 0 } as CSSProperties}
            >
              <span className="mk-stack-front absolute start-1/2 bottom-full mb-3 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface-elevated px-3 py-1 text-small font-semibold whitespace-nowrap text-fg shadow-e2 rtl:translate-x-1/2">
                <LogoSymbol className="size-4" />
                <span dir="ltr">linkyo.app/{page.slug}</span>
              </span>
              <div className="relative aspect-short overflow-hidden rounded-xl border border-line bg-surface shadow-e3">
                <Image
                  src={EXAMPLE_SHOTS[page.slug]}
                  alt=""
                  fill
                  sizes={phoneSizes.hero}
                  placeholder="blur"
                  preload={index === 0}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="object-cover object-top"
                />
              </div>
              <p className="mk-stack-front absolute inset-x-0 top-full mt-4 flex items-center justify-center gap-2 text-small font-semibold whitespace-nowrap text-fg">
                {t(`hero.kinds.${page.kind}`)}
                <span className="rounded-full bg-primary px-2 py-0.5 text-caption text-primary-fg tabular-nums">
                  {t(`hero.${page.fact}`, { count: compact.format(page.count) })}
                </span>
              </p>
            </div>
          ))}
        </div>
      </MotionToggle>
    </section>
  );
}
