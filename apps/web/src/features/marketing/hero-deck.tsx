"use client";

import { tokens } from "@linkyo/tokens";
import { cn, Icon, LogoSymbol } from "@linkyo/ui";
import { ArrowUpRight } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { pageAddress } from "@/lib/page-url";

import { faceSize, phoneSizes } from "./assets";

export interface DeckPage {
  slug: string;
  name: string;
  href: string;
  /** The face on the page's button under the deck. */
  face: StaticImageData;
  /**
   * The picture of the page, in the visitor's language where the page has one. A picture taller
   * than the screen scrolls by itself while the page is in front.
   */
  shot: StaticImageData;
  /** An unofficial concept page of a well-known person: its address carries a "Concept" tag. */
  concept?: boolean;
}

/**
 * Where a page stands: in front, beside it (next on the reading side, prev on the other), or out of
 * sight behind one of them, waiting for its turn (after: it comes in next; before: it just left).
 */
function slotOf(index: number, active: number, count: number) {
  const offset = (index - active + count) % count;
  if (offset === 0) return "front";
  if (offset === 1) return "next";
  if (offset === count - 1) return "prev";
  return offset <= count / 2 ? "after" : "before";
}
/** The deck goes through all its pages once on its own, then rests on the first. */
const ROUNDS = 1;

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
};

/**
 * The hero's pages as a carousel (WAI-ARIA tabbed carousel): nine pages, three in view, the one in
 * front shown whole. The chip above it is the link to the page: its address, plus a "Concept"
 * tag on the unofficial concept pages of well-known people (a note at the bottom says so too, ADR
 * 0043). Under the pages a row of faces, one per page, like stories: a click on a face, or on a page
 * beside the front one, brings that page forward. The ring around the face of the page in front is
 * the deck's timer: it fills while that page's time runs. On phones the row scrolls and keeps the chosen
 * face in view. Every page's picture is fetched ahead, so the page is there the moment it is chosen.
 *
 * The page in front is alive: its picture scrolls down by itself, as someone reading it would, and
 * returns to the top; then the next page comes forward. That scroll is the deck's clock.
 *
 * Motion without a pause button (WCAG 2.2.2): the deck goes through its pages once on its own,
 * holds while the mouse is over it or keyboard focus is inside, stops for good as soon as someone
 * chooses a page, and never moves on its own with reduced motion.
 */
export function HeroDeck({ pages }: { pages: DeckPage[] }) {
  const t = useTranslations("marketing.hero");
  const id = useId();
  const [active, setActive] = useState(0);
  const [turns, setTurns] = useState(0);
  const [chosen, setChosen] = useState(false);
  const [warm, setWarm] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const row = useRef<HTMLDivElement | null>(null);
  // A finger swiping across the phones turns the deck, as in an app (the page still scrolls up and down).
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);
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

  // On narrow screens the row of faces scrolls: keep the chosen face in the middle. Only the row
  // moves (scrollIntoView would also move the page).
  useEffect(() => {
    const list = row.current;
    const tab = tabs.current[active];
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
  }, [active, reduced]);

  /**
   * The first picture is there: now the pages still out of sight fetch theirs, quietly, so a tap on
   * any face shows its page at once. Not when the browser asks to save data: there a picture loads
   * when its page comes near.
   */
  const warmUp = () => {
    const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (!connection?.saveData) setWarm(true);
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
      <div
        aria-live={rotating ? "off" : "polite"}
        onPointerDown={(event) => {
          swiped.current = false;
          if (event.pointerType === "mouse") return;
          swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
        }}
        onKeyDownCapture={() => {
          swiped.current = false;
        }}
        onPointerUp={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (start?.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          // At least a finger's width, and more sideways than down: otherwise it was a tap or a scroll.
          if (Math.abs(dx) < tokens.size.touchTarget || Math.abs(dx) < Math.abs(event.clientY - start.y)) return;
          const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
          swiped.current = true;
          choose(active + (dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
        // A swipe is not a tap: the page in front does not open.
        onClickCapture={(event) => {
          if (!swiped.current) return;
          swiped.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        className="mk-phone-in relative w-full touch-pan-y touch-pinch-zoom pt-16"
      >
        <div className="relative mx-auto w-1/2 md:w-5/12 lg:mk-deck-fit">
          <div aria-hidden className="mk-deck-halo w-[260%] border border-line" />
          <div aria-hidden className="mk-deck-halo w-[215%] bg-tint-teal" />
          {/* Invisible twin of a phone: it gives the box its height. */}
          <div aria-hidden className="invisible aspect-phone" />

          {pages.map((page, index) => {
            const slot = slotOf(index, active, count);
            const front = slot === "front";
            const beside = slot === "next" || slot === "prev";
            // Pictures load for the pages in view and the two about to come into view; the others
            // follow once the first is there (warmUp).
            const near = [0, 1, 2, count - 2, count - 1].includes((index - active + count) % count);
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
                  {near || warm ? (
                    <Image
                      src={page.shot}
                      alt=""
                      sizes={phoneSizes.hero}
                      placeholder="blur"
                      preload={index === 0}
                      fetchPriority={index === 0 ? "high" : near ? "auto" : "low"}
                      loading={index === 0 || !beside ? "eager" : "lazy"}
                      onLoad={index === 0 ? warmUp : undefined}
                      data-tour={front && rotating ? "" : undefined}
                      onAnimationEnd={front && rotating ? advance : undefined}
                      className={cn("h-auto w-full", front && rotating && "mk-deck-scroll")}
                    />
                  ) : null}
                </div>

                {front ? (
                  <a href={page.href} className="absolute inset-0 rounded-xl focus-visible:focus-ring">
                    {/* The chip above the phone is the visible link: "linkyo.app/name ↗", with a "Concept" tag on concept pages. */}
                    {/* Centred on the phone whatever its width (wider than the phone on small screens); the entrance
                        animation moves the chip itself, so it never slides sideways. */}
                    <span className="absolute bottom-full left-1/2 mb-3 w-max -translate-x-1/2">
                      <span className="mk-deck-chip inline-flex h-control-md w-max items-center gap-2 rounded-full border border-line bg-surface-elevated ps-3 pe-1 text-small font-semibold whitespace-nowrap text-fg transition-[translate] duration-standard ease-standard group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
                        <LogoSymbol className="size-4 text-primary" />
                        <span dir="ltr">{pageAddress(page.slug)}</span>
                        {/* A well-known person's page is never shown as theirs: the address carries a "Concept" tag (ADR 0020). */}
                        {page.concept ? (
                          <span className="rounded-full border border-line px-2 text-caption font-medium text-fg-secondary">{t("deck.conceptTag")}</span>
                        ) : null}
                        <span className="grid size-control-sm place-items-center rounded-full bg-primary text-primary-fg">
                          <Icon
                            icon={ArrowUpRight}
                            size="sm"
                            className="transition-transform duration-standard ease-standard group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5"
                          />
                        </span>
                      </span>
                    </span>
                    <span className="sr-only">{t("deck.viewNamed", { name: page.name })}</span>
                  </a>
                ) : beside ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => {
                      choose(index);
                    }}
                    className="absolute inset-0 cursor-pointer rounded-xl"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p id={`${id}-auto`} className="sr-only">
        {t("deck.auto")}
      </p>
      <div
        ref={row}
        role="tablist"
        aria-label={t("deck.choose")}
        aria-describedby={`${id}-auto`}
        className="mk-no-scrollbar relative flex w-full items-center justify-between gap-1 overflow-x-auto rounded-full bg-canvas-muted p-1"
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
              aria-label={page.name}
              aria-selected={selected}
              aria-controls={`${id}-slide-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                choose(index);
              }}
              onKeyDown={onTabKey}
              className="group relative size-touch-target shrink-0 rounded-full p-1 transition-[scale] duration-micro focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none"
            >
              {/* The ring: a quiet track on every face. On the page in front it fills while the page's
                  time runs (the same clock as the page's scroll); once the deck has stopped it is full. */}
              <svg aria-hidden viewBox="0 0 44 44" className="pointer-events-none absolute inset-0 size-full -rotate-90">
                <circle
                  cx="22"
                  cy="22"
                  r="21"
                  className={cn("mk-deck-track", selected ? "stroke-line-strong" : "stroke-line group-hover:stroke-line-strong")}
                />
                {selected ? (
                  <circle key={rotating ? active : "full"} cx="22" cy="22" r="21" pathLength="1" data-ring data-running={rotating ? "" : undefined} className="mk-deck-ring" />
                ) : null}
              </svg>
              <Image src={page.face} alt="" sizes={faceSize} className="size-full rounded-full object-cover" />
            </button>
          );
        })}
      </div>
      {pages.some((page) => page.concept) ? <p className="max-w-prose text-center text-caption text-pretty text-fg-secondary">{t("deck.conceptNote")}</p> : null}
    </section>
  );
}
