"use client";

import { cn, Icon, LogoSymbol } from "@linkyo/ui";
import { ArrowUpRight } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";

import { phoneSizes } from "./assets";

export interface DeckPage {
  slug: string;
  name: string;
  href: string;
  /** The short name on the page's tab. */
  tab: string;
  /**
   * The picture of the page, in the visitor's language where the page has one. A picture taller
   * than the screen scrolls by itself while the page is in front.
   */
  shot: StaticImageData;
  /** An unofficial concept page of a well-known person: labelled as such instead of an address. */
  concept?: boolean;
}

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
 * The hero's pages as a carousel (WAI-ARIA tabbed carousel): three pages, the one in front shown
 * whole. The chip above it is the link to the page: its address, or "Concept · name" for the
 * unofficial concept pages of well-known people (a note under the tabs says so too, ADR 0043).
 * A click on a page beside it, or on a tab, brings that page forward, and the teal highlight glides
 * to its tab.
 *
 * The page in front is alive: its picture scrolls down by itself, as someone reading it would, and
 * returns to the top; then the next page comes forward. That scroll is the deck's clock.
 *
 * Motion without a pause button (WCAG 2.2.2): the deck moves on its own only for two rounds, holds
 * while the mouse is over it or keyboard focus is inside, stops for good as soon as someone chooses
 * a page, and never moves on its own with reduced motion.
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
          <div aria-hidden className="invisible aspect-phone" />

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
                {/* The page itself, edge to edge: no bezel, no frame. In front, it scrolls by itself. */}
                <div className="mk-deck-screen aspect-phone overflow-hidden rounded-xl bg-canvas-muted">
                  <Image
                    src={page.shot}
                    alt=""
                    sizes={phoneSizes.hero}
                    placeholder="blur"
                    preload={index === 0}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    loading={index === 0 ? "eager" : "lazy"}
                    data-tour={front && rotating ? "" : undefined}
                    onAnimationEnd={front && rotating ? advance : undefined}
                    className={cn("h-auto w-full", front && rotating && "mk-deck-scroll")}
                  />
                </div>

                {front ? (
                  <a href={page.href} className="absolute inset-0 rounded-xl focus-visible:focus-ring">
                    {/* The chip above the phone is the visible link: "linkyo.app/name ↗" or "Concept · name ↗". */}
                    <span className="mk-deck-chip absolute inset-x-0 bottom-full mx-auto mb-3 inline-flex h-control-md w-max items-center gap-2 rounded-full border border-line bg-surface-elevated ps-3 pe-1 text-small font-semibold whitespace-nowrap text-fg transition-[translate] duration-standard ease-standard group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
                      <LogoSymbol className="size-4 text-primary" />
                      {page.concept ? <span>{t("deck.conceptNamed", { name: page.name })}</span> : <span dir="ltr">linkyo.app/{page.slug}</span>}
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
        style={{ "--tab": active, "--tabs": count } as CSSProperties}
        className="mk-deck-tabs"
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
                "inline-flex h-control-md items-center justify-center rounded-full px-3 text-small font-semibold whitespace-nowrap transition-colors duration-slow ease-emphasized focus-visible:focus-ring motion-reduce:transition-none sm:px-5",
                selected ? "text-primary-fg" : "text-fg-secondary hover:text-fg",
              )}
            >
              {page.tab}
            </button>
          );
        })}
      </div>
      {pages.some((page) => page.concept) ? <p className="max-w-prose text-center text-caption text-pretty text-fg-secondary">{t("deck.conceptNote")}</p> : null}
    </section>
  );
}
