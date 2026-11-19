"use client";

import { cn, Icon, IconButton, LogoSymbol } from "@linkyo/ui";
import { ArrowUpRight, Laugh, Music, Pause, Play, Trophy, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";

import { phoneSizes } from "./assets";
import { EXAMPLE_SHOTS, type ExampleShot } from "./examples";

export type DeckKind = "comedy" | "music" | "sport";

export interface DeckPage {
  slug: ExampleShot;
  name: string;
  href: string;
  kind: DeckKind;
  /** One number from the page, already formatted ("2.4M followers"). */
  stat: string;
}

const KIND_ICONS: Record<DeckKind, LucideIcon> = { comedy: Laugh, music: Music, sport: Trophy };
const SLOTS = ["front", "next", "prev"] as const;

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
};

/**
 * The hero's example pages as a carousel (WAI-ARIA tabbed carousel): the page in front opens the
 * real example page, the ones beside it come forward on a click, and the tabs below choose one
 * directly. It moves on by itself (the line under the tab is the timer) and holds while the mouse
 * is over it or keyboard focus is inside (CSS), and stops with the pause button; with reduced
 * motion it never moves on its own.
 */
export function HeroDeck({ pages }: { pages: DeckPage[] }) {
  const t = useTranslations("marketing.hero");
  const id = useId();
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);
  const rotating = !stopped && !reduced;
  const count = pages.length;

  const choose = (index: number, focus = false) => {
    const next = (index + count) % count;
    setActive(next);
    if (focus) tabs.current[next]?.focus();
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
      data-paused={stopped}
      className="mx-auto grid w-full max-w-creator grid-cols-1 justify-items-center gap-8"
    >
      <div aria-live={rotating ? "off" : "polite"} className="mk-phone-in relative aspect-11/12 w-full">
        {/* A soft teal disc and a thin ring hold the cards together on the white page. */}
        <div aria-hidden className="absolute inset-x-0 top-1/2 mx-auto aspect-square w-full -translate-y-1/2 rounded-full border border-line" />
        <div aria-hidden className="absolute inset-x-0 top-1/2 mx-auto aspect-square w-10/12 -translate-y-1/2 rounded-full bg-tint-teal" />

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
              className="mk-deck-card group absolute inset-x-0 top-1/2 mx-auto w-5/12"
            >
              <div className="rounded-xl bg-ink p-1 shadow-e3">
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
                <>
                  <a href={page.href} aria-label={t("deck.viewNamed", { name: page.name })} className="absolute inset-0 rounded-xl focus-visible:focus-ring">
                    <span
                      style={{ "--i": 2 } as CSSProperties}
                      className="mk-deck-chip absolute inset-x-0 -bottom-5 mx-auto inline-flex h-control-md w-max items-center gap-2 rounded-full bg-primary ps-4 pe-3 text-small font-semibold whitespace-nowrap text-primary-fg shadow-e3 transition-colors duration-standard ease-standard group-hover:bg-primary-hover"
                    >
                      {t("deck.view")}
                      <Icon icon={ArrowUpRight} size="sm" className="rtl:-scale-x-100" />
                    </span>
                  </a>
                  <span
                    aria-hidden
                    className="mk-deck-chip pointer-events-none absolute inset-x-0 bottom-full mx-auto mb-3 inline-flex h-control-sm w-max items-center gap-2 rounded-full bg-surface-elevated px-3 text-small font-semibold whitespace-nowrap text-fg shadow-e2"
                  >
                    <LogoSymbol className="size-4 text-primary" />
                    <span dir="ltr">linkyo.app/{page.slug}</span>
                  </span>
                  <span
                    aria-hidden
                    style={{ "--i": 1 } as CSSProperties}
                    className="mk-deck-chip pointer-events-none absolute top-1/3 -start-16 inline-flex items-center gap-2 rounded-lg bg-surface-elevated py-2 ps-2 pe-3 shadow-e3 max-sm:hidden"
                  >
                    <span className="grid size-control-sm place-items-center rounded-md bg-primary text-primary-fg">
                      <Icon icon={KIND_ICONS[page.kind]} size="sm" />
                    </span>
                    <span className="text-small font-semibold whitespace-nowrap text-fg tabular-nums">{page.stat}</span>
                  </span>
                </>
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

      <div className="flex items-center gap-2">
        <IconButton
          icon={stopped ? Play : Pause}
          label={stopped ? t("stackPlay") : t("stackPause")}
          variant="secondary"
          onClick={() => {
            setStopped((value) => !value);
          }}
          className="rounded-full motion-reduce:hidden"
        />
        <div role="tablist" aria-label={t("deck.choose")} className="flex items-center gap-1 rounded-full bg-canvas-muted p-1">
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
                  "relative inline-flex h-control-md items-center gap-2 overflow-hidden rounded-full px-3 text-small font-semibold transition-[background-color,color,box-shadow] duration-standard ease-standard focus-visible:focus-ring sm:px-4",
                  selected ? "bg-surface-elevated text-fg shadow-e1" : "text-fg-secondary hover:text-fg",
                )}
              >
                <Icon icon={KIND_ICONS[page.kind]} size="sm" className={cn("max-sm:hidden", selected && "text-primary")} />
                {t(`kinds.${page.kind}`)}
                {selected ? (
                  <span
                    key={active}
                    aria-hidden
                    onAnimationEnd={() => {
                      choose(active + 1);
                    }}
                    className="mk-progress absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-primary sm:inset-x-4"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
