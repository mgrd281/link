"use client";

import { cn, Icon } from "@linkyo/ui";
import { Check, ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { pageSide } from "./styles";

/** A section as the index lists it. */
export interface IndexEntry {
  anchor: string;
  title: string;
}

/** Where reading happens: a section is being read once its start has passed this share of the screen's height. */
const READING_LINE = 0.35;

/**
 * The section being read (its index in `entries`), or null before the observer has looked (the
 * server's HTML claims no section): found by an IntersectionObserver on a thin band at a third of the
 * screen (no scroll handler), and the last one once the end of the content (`[data-lb-end]`) is on
 * screen. Above the first section: the first one (`top: "first"`, an index that always marks where
 * the reader is headed) or none (the app bar, which names a section only once it is being read).
 */
export function useCurrentSection(entries: readonly IndexEntry[], top: "first" | "none" = "first"): number | null {
  const [current, setCurrent] = useState<number | null>(null);
  useEffect(() => {
    const sections = entries.map((entry) => document.getElementById(entry.anchor)).filter((section): section is HTMLElement => section !== null);
    const end = document.querySelector("[data-lb-end]");
    if (sections.length === 0) return;
    let atEnd = false;
    const decide = () => {
      const line = window.innerHeight * READING_LINE;
      const passed = sections.findLastIndex((section) => section.getBoundingClientRect().top <= line);
      setCurrent(atEnd ? sections.length - 1 : passed >= 0 ? passed : top === "first" ? 0 : null);
    };
    // A band one percent tall that ends at the reading line: a section's top enters it just as it passes
    // the line going down (so `decide` already counts it as read) and leaves it just as it goes back
    // below the line going up. A band that began at the line reported the entry while the top was still
    // a hair below it, and nothing more until the section had been read: the bar named the one before.
    const at = READING_LINE * 100;
    const band = new IntersectionObserver(decide, { rootMargin: `-${String(at - 1)}% 0% -${String(100 - at)}% 0%` });
    for (const section of sections) band.observe(section);
    const tail = new IntersectionObserver(([entry]) => {
      atEnd = entry?.isIntersecting === true;
      decide();
    });
    if (end) tail.observe(end);
    decide();
    return () => {
      band.disconnect();
      tail.disconnect();
    };
  }, [entries, top]);
  return current;
}

/**
 * The section index beside the sections (Laufbahn, ADR 0069): words only, chips that wrap in the
 * reading column on tablets, a sticky list in the first three columns of the wide canvas, the
 * section being read marked (`aria-current`, a filled row). Plain anchor links that work without
 * this script (and then mark nothing: a mark that cannot follow the reader would be wrong). Phones
 * have no row of chips: the app bar's title opens the same list as a sheet (SectionSwitcher).
 */
export function IndexList({ entries, className }: { entries: readonly IndexEntry[]; className: string }): ReactNode {
  const current = useCurrentSection(entries);
  return (
    <ol className={className}>
      {entries.map((entry, index) => (
        <li key={entry.anchor} className="min-w-0">
          <a
            href={`#${entry.anchor}`}
            aria-current={index === current ? "true" : undefined}
            className={cn(
              "flex min-h-touch-target items-center rounded-creator-button border border-creator-line px-4 text-small font-semibold text-creator-fg-muted",
              "transition-colors duration-micro hover:border-creator-line-strong hover:text-creator-fg focus-visible:focus-ring motion-reduce:transition-none",
              "aria-[current=true]:border-creator-fg aria-[current=true]:bg-creator-fg aria-[current=true]:text-creator-bg",
              "@work:rounded-xs @work:border-transparent @work:px-3 @work:hover:border-creator-line",
              "@work:aria-[current=true]:border-transparent @work:aria-[current=true]:bg-creator-surface @work:aria-[current=true]:text-creator-fg",
            )}
          >
            <span dir="auto" className={cn(pageSide, "min-w-0 text-pretty")}>
              {entry.title}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * The app bar's title on a signposted page (Laufbahn), as in a native app: the owner's name and,
 * once a section is being read, that section under it with a chevron. Pressed, it opens the
 * contents as a sheet (a native modal dialog: focus moves in and stays, Escape and a tap outside
 * close it, focus returns to the title): every section a full-width row of 56 px, the one being
 * read marked with a check. Choosing one closes the sheet and goes to the section's address, so the
 * page glides there (unless the visitor prefers less motion), the back button returns, and a letter
 * reached this way opens whole (lb-more).
 */
export function SectionSwitcher({ entries, name, ai }: { entries: readonly IndexEntry[]; name: string; ai?: Record<string, string> | undefined }): ReactNode {
  const t = useTranslations("creator");
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const current = useCurrentSection(entries, "none");
  const section = current === null ? undefined : entries[current];

  const open = () => sheet.current?.showModal();
  const close = () => sheet.current?.close();
  // A tap on the backdrop lands on the dialog itself (its content fills the box inside it) and closes
  // the sheet, as on a phone; the keyboard has Escape (the dialog's own) and the close button.
  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog) return;
    const outside = (event: globalThis.MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", outside);
    return () => dialog.removeEventListener("click", outside);
  }, []);
  // The sheet closes before the link does its own work (the page is no longer inert by then): the
  // address changes, so :target, the back button and a shared link all follow.
  const go = () => close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="group flex min-h-touch-target min-w-0 flex-1 items-center gap-1 rounded-xs text-start focus-visible:focus-ring"
      >
        <span className="grid min-w-0">
          <span
            dir="auto"
            className={cn(pageSide, "truncate transition-[font-size,color] duration-standard ease-standard motion-reduce:transition-none", section ? "text-caption text-creator-fg-muted" : "text-body font-semibold")}
            {...ai}
          >
            {name}
          </span>
          {section ? (
            <span dir="auto" className={cn(pageSide, "truncate text-body leading-snug font-semibold")}>
              {section.title}
            </span>
          ) : null}
        </span>
        <Icon icon={ChevronDown} size="sm" className="shrink-0 text-creator-fg-muted transition-colors duration-micro group-hover:text-creator-fg" />
        <span className="sr-only">{t("laufbahn.openSections")}</span>
      </button>
      <dialog ref={sheet} aria-labelledby={titleId} className="lb-sheet">
        <div className="grid gap-2 px-creator-gutter pt-3 pb-[max(var(--spacing-6),env(safe-area-inset-bottom))]">
          {/* The grabber says "sheet" at a glance, as on iOS; decorative. */}
          <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-creator-line-strong @prose:hidden" />
          <div className="flex min-h-touch-target items-center justify-between gap-3">
            <h2 id={titleId} className="text-title font-semibold">
              {t("laufbahn.sections")}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("laufbahn.close")}
              className="grid size-touch-target shrink-0 place-items-center rounded-full bg-creator-surface-2 text-creator-fg transition-colors duration-micro hover:bg-creator-line focus-visible:focus-ring motion-reduce:transition-none"
            >
              <Icon icon={X} size="md" />
            </button>
          </div>
          <ol className="grid overflow-hidden rounded-creator-card border border-creator-line bg-creator-surface">
            {entries.map((entry, index) => (
              <li key={entry.anchor} className="min-w-0 not-first:border-t not-first:border-creator-line">
                <a
                  href={`#${entry.anchor}`}
                  onClick={go}
                  aria-current={index === current ? "true" : undefined}
                  className="flex min-h-control-xl items-center justify-between gap-3 px-4 text-body font-semibold text-creator-fg transition-colors duration-micro hover:bg-creator-bg focus-visible:focus-ring motion-reduce:transition-none"
                >
                  <span dir="auto" className={cn(pageSide, "min-w-0 text-pretty")}>
                    {entry.title}
                  </span>
                  {index === current ? <Icon icon={Check} size="md" className="shrink-0 text-creator-accent-text" /> : null}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </dialog>
    </>
  );
}
