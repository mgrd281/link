"use client";

import { cn, Icon, LogoSymbol } from "@linkyo/ui";
import { ArrowUpRight, Disc3, Mic, Shirt, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { phoneSizes } from "./assets";
import { EXAMPLE_SHOTS, type ExampleShot } from "./examples";

export type DeckKind = "fashion" | "dj" | "music";

export interface DeckPage {
  slug: ExampleShot;
  name: string;
  href: string;
  kind: DeckKind;
}

const KIND_ICONS: Record<DeckKind, LucideIcon> = { fashion: Shirt, dj: Disc3, music: Mic };
const SLOTS = ["front", "next", "prev"] as const;
/** The deck goes round twice on its own, then rests on the first page. */
const ROUNDS = 2;

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
};

/**
 * The hero's example pages as a carousel (WAI-ARIA tabbed carousel). Three phones, the one in front
 * shown whole; its address above it is the link to the real example page. A click on a phone
 * beside it, or on a tab, brings that page forward.
 *
 * Motion without a pause button (WCAG 2.2.2): the deck changes on its own only for two rounds
 * (the line under the chosen tab is the timer), holds while the mouse is over it or keyboard focus
 * is inside, stops for good as soon as someone chooses a page, and never moves on its own with
 * reduced motion.
 */
export function HeroDeck({ pages }: { pages: DeckPage[] }) {
  const t = useTranslations("marketing.hero");
  const id = useId();
  const [active, setActive] = useState(0);
  const [turns, setTurns] = useState(0);
  const [chosen, setChosen] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);
  const count = pages.length;
  const rotating = !chosen && !reduced && turns < count * ROUNDS;

  /** Someone picked a page: the deck stops changing on its own. */
  const choose = (index: number, focus = false) => {
    const next = (index + count) % count;
    setChosen(true);
    setActive(next);
    if (focus) tabs.current[next]?.focus();
  };

  const advance = () => {
    setActive((current) => (current + 1) % count);
    setTurns((done) => done + 1);
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    if (step !== undefined) choose(active + step, true);
    else if (event.key === "Home") choose(0, true);
    else if (event.key === "End") choose(count - 1, true);
    else return;
    event.preventDefault();
  };

  return (
    <section
      aria-roledescription={t("deck.carousel")}
      aria-label={t("deck.label")}
      data-deck
      data-paused={!rotating}
      className="mx-auto grid w-full max-w-creator grid-cols-1 justify-items-center gap-6 md:gap-8"
    >
      {/* Room above the phones for the address; the phones share the front phone's box. */}
      <div aria-live={rotating ? "off" : "polite"} className="mk-phone-in relative w-full pt-16">
        <div className="relative mx-auto w-1/2 md:w-5/12 lg:mk-deck-fit">
          <div aria-hidden className="mk-deck-halo w-[260%] border border-line" />
          <div aria-hidden className="mk-deck-halo w-[215%] bg-tint-teal" />
          {/* Invisible twin of a phone: it gives the box its height. */}
          <div aria-hidden className="invisible rounded-xl p-1">
            <div className="aspect-phone" />
          </div>

          {pages.map((page, index) => {
            const slot = SLOTS[(index - active + count) % count] ?? "next";
            const front = slot === "front";
            return (
              <div
                key={page.slug}
                id={`${id}-slide-${index}`}
                role="tabpanel"
                aria-roledescription={t("deck.slide")}
                aria-labelledby={`${id}-tab-${index}`}
                aria-hidden={!front || undefined}
                data-slot={slot}
                className="mk-deck-card group absolute inset-x-0 top-0"
              >
                <div className="rounded-xl bg-ink p-1">
                  <div className="relative aspect-phone overflow-hidden rounded-lg bg-surface">
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
                </div>

                {front ? (
                  <a href={page.href} className="absolute inset-0 rounded-xl focus-visible:focus-ring">
                    {/* The address above the phone is the visible link: "linkyo.app/name ↗". */}
                    <span className="mk-deck-chip absolute inset-x-0 bottom-full mx-auto mb-3 inline-flex h-control-md w-max items-center gap-2 rounded-full border border-line bg-surface-elevated ps-3 pe-1 text-small font-semibold whitespace-nowrap text-fg transition-[translate] duration-standard ease-standard group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
                      <LogoSymbol className="size-4 text-primary" />
                      <span dir="ltr">linkyo.app/{page.slug}</span>
                      <span className="grid size-control-sm place-items-center rounded-full bg-primary text-primary-fg">
                        <Icon
                          icon={ArrowUpRight}
                          size="sm"
                          className="transition-transform duration-standard ease-standard group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                        />
                      </span>
                    </span>
                    <span className="sr-only">{t("deck.viewNamed", { name: page.name })}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => {
                      choose(index);
                    }}
                    className="absolute inset-0 cursor-pointer rounded-xl"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p id={`${id}-auto`} className="sr-only">
        {t("deck.auto")}
      </p>
      <div
        role="tablist"
        aria-label={t("deck.choose")}
        aria-describedby={`${id}-auto`}
        className="relative flex items-center gap-1 rounded-full bg-canvas-muted p-1"
      >
        {pages.map((page, index) => {
          const selected = index === active;
          return (
            <button
              key={page.slug}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-selected={selected}
              aria-controls={`${id}-slide-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                choose(index);
              }}
              onKeyDown={onTabKey}
              className={cn(
                "relative inline-flex h-control-md items-center gap-2 overflow-hidden rounded-full border border-transparent px-4 text-small font-semibold transition-[background-color,border-color,color] duration-standard ease-standard focus-visible:focus-ring",
                selected ? "border-line bg-surface-elevated text-fg" : "text-fg-secondary hover:text-fg",
              )}
            >
              <Icon icon={KIND_ICONS[page.kind]} size="sm" className={cn(selected ? "text-primary" : "text-fg-tertiary")} />
              {t(`kinds.${page.kind}`)}
              {selected && rotating ? (
                <span key={active} aria-hidden onAnimationEnd={advance} className="mk-progress absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
