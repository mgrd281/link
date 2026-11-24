"use client";

import { cn, Icon } from "@linkyo/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/** How far one card is from the next in a row (its width and the gap), whatever the direction. */
export function cardStep(first: { left: number; width: number } | undefined, second: { left: number } | undefined): number {
  if (!first) return 0;
  return second ? Math.abs(second.left - first.left) : first.width;
}

/** Whether a row stands at its start or its end. Scroll offsets run negative in right-to-left layouts. */
export function railEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): { start: boolean; end: boolean; scrolls: boolean } {
  const offset = Math.abs(scrollLeft);
  const scrolls = scrollWidth - clientWidth > 1;
  return { start: offset < 2, end: offset + clientWidth >= scrollWidth - 2, scrolls };
}

const BUTTON =
  "grid size-touch-target place-items-center rounded-full border border-creator-line-strong bg-creator-bg text-creator-fg transition-colors duration-micro hover:bg-creator-surface focus-visible:focus-ring aria-disabled:cursor-default aria-disabled:opacity-secondary aria-disabled:hover:bg-creator-bg";

/**
 * Back and on for a row of project cards (P-02): a mouse cannot swipe, and a wheel scrolls the page,
 * not the row. Each press moves the row by one card; at either end that button is disabled. The
 * chevrons follow the reading direction (mirrored in Arabic) and the row moves at once with reduced
 * motion. The island sits beside its row inside `[data-rail-group]` and pages the list that
 * scrolls there (`[data-rail-track]`).
 *
 * Its place is kept from the first paint on wider screens (no shift when script arrives); the buttons
 * show once script runs and only when the row has more than fits. Phones swipe and see none.
 */
export function RailButtons() {
  const t = useTranslations("creator.portfolio");
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ start: boolean; end: boolean; scrolls: boolean } | null>(null);

  const rail = () => box.current?.closest("[data-rail-group]")?.querySelector<HTMLElement>("[data-rail-track]") ?? null;

  useEffect(() => {
    const element = box.current?.closest("[data-rail-group]")?.querySelector<HTMLElement>("[data-rail-track]");
    if (!element) return;
    const measure = () => setState(railEdges(element.scrollLeft, element.clientWidth, element.scrollWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, []);

  const page = (direction: 1 | -1) => {
    const element = rail();
    if (!element) return;
    const cards = element.querySelectorAll("li");
    const step = cardStep(cards[0]?.getBoundingClientRect(), cards[1]?.getBoundingClientRect());
    if (step === 0) return;
    const rtl = getComputedStyle(element).direction === "rtl";
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    element.scrollBy({ left: direction * (rtl ? -1 : 1) * step, behavior });
  };

  const shown = state?.scrolls === true;
  return (
    <div ref={box} data-rail-buttons className={cn("hidden justify-end gap-2 @prose:flex", !shown && "invisible")}>
      <button type="button" onClick={() => !state?.start && page(-1)} aria-label={t("railBack")} aria-disabled={!shown || state.start || undefined} className={BUTTON}>
        <Icon icon={ChevronLeft} size="md" className="rtl:-scale-x-100" />
      </button>
      <button type="button" onClick={() => !state?.end && page(1)} aria-label={t("railOn")} aria-disabled={!shown || state.end || undefined} className={BUTTON}>
        <Icon icon={ChevronRight} size="md" className="rtl:-scale-x-100" />
      </button>
    </div>
  );
}
