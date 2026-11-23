"use client";

import { cn } from "@linkyo/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { pageSide, signStyle } from "./styles";

/** A section as the index lists it. */
export interface IndexEntry {
  anchor: string;
  letter: string;
  title: string;
}

/** Where reading happens: a section is being read once its start has passed this share of the screen's height. */
const READING_LINE = 0.35;

/**
 * The section index's list (Laufbahn, ADR 0069). Plain anchor links that work without this script
 * (and then mark nothing: a mark that cannot follow the reader would be wrong wherever they are); with it:
 * - the section being read is marked (`aria-current`), found by an IntersectionObserver on a thin
 *   band at a third of the screen (no scroll handler), the first one at the top of the page and the
 *   last one once the end of the content is on screen;
 * - on phones, where the chips are a row to swipe, the marked chip and a chip reached with Tab are
 *   scrolled fully into the row (the row only, never the page), and the row fades at an edge only while
 *   more chips lie beyond it.
 */
export function IndexList({ entries, className }: { entries: readonly IndexEntry[]; className: string }): ReactNode {
  const list = useRef<HTMLOListElement>(null);
  // Nothing is marked until the observer has looked: the server's HTML claims no section.
  const [current, setCurrent] = useState<number | null>(null);

  // The section being read.
  useEffect(() => {
    const sections = entries.map((entry) => document.getElementById(entry.anchor)).filter((section): section is HTMLElement => section !== null);
    const end = document.querySelector("[data-lb-end]");
    if (sections.length === 0) return;
    let atEnd = false;
    const decide = () => {
      const line = window.innerHeight * READING_LINE;
      const passed = sections.findLastIndex((section) => section.getBoundingClientRect().top <= line);
      setCurrent(atEnd ? sections.length - 1 : Math.max(0, passed));
    };
    // A band one percent tall at the reading line: it fires whenever a section's edge crosses it.
    const top = READING_LINE * 100;
    const band = new IntersectionObserver(decide, { rootMargin: `-${String(top)}% 0% -${String(100 - top - 1)}% 0%` });
    for (const section of sections) band.observe(section);
    const tail = new IntersectionObserver(([entry]) => {
      atEnd = entry?.isIntersecting === true;
      decide();
    });
    if (end) tail.observe(end);
    return () => {
      band.disconnect();
      tail.disconnect();
    };
  }, [entries]);

  // Phones: the row keeps the marked chip, and a chip reached with Tab, whole in view; its edges fade
  // only while chips lie beyond them.
  useEffect(() => {
    const row = list.current;
    if (!row) return;
    const fades = () => {
      const room = row.scrollWidth - row.clientWidth;
      const offset = Math.abs(row.scrollLeft);
      row.toggleAttribute("data-fade-start", room > 1 && offset > 1);
      row.toggleAttribute("data-fade-end", room > 1 && offset < room - 1);
    };
    const reveal = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) bringIntoRow(row, event.target, false);
    };
    fades();
    row.addEventListener("scroll", fades, { passive: true });
    row.addEventListener("focusin", reveal);
    const resize = new ResizeObserver(fades);
    resize.observe(row);
    return () => {
      row.removeEventListener("scroll", fades);
      row.removeEventListener("focusin", reveal);
      resize.disconnect();
    };
  }, []);

  // The marked chip comes into view, unless the visitor is moving along the chips with the keyboard:
  // then the focused chip stays where they put it.
  useEffect(() => {
    const row = list.current;
    const chip = current === null ? undefined : row?.querySelectorAll("a")[current];
    if (row && chip && !row.contains(document.activeElement)) bringIntoRow(row, chip, true);
  }, [current]);

  return (
    <ol ref={list} className={className}>
      {entries.map((entry, index) => (
        <li key={entry.anchor} className="shrink-0 snap-start">
          <a
            href={`#${entry.anchor}`}
            aria-current={index === current ? "true" : undefined}
            className={cn(
              "group flex min-h-touch-target items-center gap-3 rounded-sm border border-creator-line bg-creator-surface py-1 ps-1 pe-4 text-small font-semibold text-creator-fg-muted",
              "transition-colors duration-micro hover:border-creator-line-strong hover:text-creator-fg focus-visible:focus-ring motion-reduce:transition-none",
              "aria-[current=true]:border-creator-line-strong aria-[current=true]:text-creator-fg",
              "@work:border-transparent @work:bg-transparent @work:pe-2 @work:hover:border-creator-line @work:aria-[current=true]:border-transparent",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-control-sm shrink-0 place-items-center rounded-xs bg-creator-surface-2 font-creator-display text-body leading-none text-creator-fg-muted",
                "transition-colors duration-micro motion-reduce:transition-none",
                "group-aria-[current=true]:bg-creator-accent group-aria-[current=true]:text-creator-accent-fg",
              )}
              style={signStyle}
            >
              {entry.letter}
            </span>
            <span dir="auto" className={cn(pageSide, "min-w-0 whitespace-nowrap @work:whitespace-normal")}>
              {entry.title}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Scrolls a row of chips (and only the row) so that `chip` stands in it whole: when any of it lies
 * outside the row's padding, the row goes to the chip's own snap position (its start at the row's
 * padding), so the row's snapping keeps it there instead of pulling it back half out. Works the same
 * in a right-to-left row. Nothing happens where the row does not scroll (tablets, the wide canvas).
 */
function bringIntoRow(row: HTMLElement, chip: HTMLElement, gentle: boolean): void {
  if (row.scrollWidth <= row.clientWidth) return;
  const [frame, box, style] = [row.getBoundingClientRect(), chip.getBoundingClientRect(), getComputedStyle(row)];
  const pad = Number.parseFloat(style.paddingInlineStart) || 0;
  if (box.left >= frame.left + pad - 1 && box.right <= frame.right - pad + 1) return;
  const delta = style.direction === "rtl" ? box.right - (frame.right - pad) : box.left - (frame.left + pad);
  if (Math.abs(delta) < 1) return;
  const still = !gentle || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  row.scrollBy({ left: delta, behavior: still ? "instant" : "smooth" });
}
