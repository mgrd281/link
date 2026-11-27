"use client";

import { cn, Icon } from "@linkyo/ui";
import { Check, ChevronDown, Download, FileText, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { bridgeAvailable } from "@/features/app-mode/bridge";

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
 * When the app bar shows (Laufbahn), as an app's navigation bar does: once the large name has passed
 * under it, and not before. An IntersectionObserver on the name (`[data-lb-name]`, else the hero)
 * sets `data-lb-shown` on the bar; the bar then fades in over a short, fixed time (lb-bar), so it is
 * never caught half visible when the page stops, and it never slides with the scroll. Renders nothing
 * of its own. Without this script the bar stays away: the page has everything it needs without it.
 */
export function BarReveal(): ReactNode {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const bar = marker.current?.closest<HTMLElement>(".poster-bar");
    const name = document.querySelector("[data-lb-name]") ?? document.querySelector(".poster-hero-timeline");
    if (!bar || !name) return;
    const height = bar.getBoundingClientRect().height;
    const watch = new IntersectionObserver(
      ([entry]) => {
        // Gone above the bar's foot (not merely below the screen, as it may be on a short screen).
        bar.toggleAttribute("data-lb-shown", entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.top < height);
      },
      { rootMargin: `-${String(Math.round(height))}px 0% 0% 0%` },
    );
    watch.observe(name);
    return () => watch.disconnect();
  }, []);
  return <span ref={marker} hidden />;
}

/**
 * The app bar's title on a signposted page (Laufbahn, on ink), as in a native app: the owner's name
 * and, once a section is being read, that section under it in the secondary white, with a chevron.
 * Pressed, it opens the contents as a sheet (a native modal dialog: focus moves in and stays, Escape
 * and a tap outside close it, focus returns to the title): every section a full-width row of 56 px,
 * the one being read marked with a check and in bold. Choosing one closes the sheet and goes to the
 * section's address, so the page glides there (unless the visitor prefers less motion), the back
 * button returns, and a letter reached this way opens whole (lb-more). A page that offers its
 * documents lists them as a second group: each row downloads its PDF directly.
 */
export function SectionSwitcher({
  entries,
  name,
  ai,
  documents = [],
}: {
  entries: readonly IndexEntry[];
  name: string;
  ai?: Record<string, string> | undefined;
  /** The documents (the CV, the cover letter, both in one file) as direct downloads: the sheet's second group. */
  documents?: readonly { href: string; filename?: string | undefined; row: string; rowName: string; own?: boolean | undefined }[] | undefined;
}): ReactNode {
  const t = useTranslations("creator");
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const groupId = useId();
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
  const row =
    "flex min-h-control-xl items-center justify-between gap-3 px-4 text-body text-creator-fg transition-colors duration-micro hover:bg-creator-bg focus-visible:focus-ring motion-reduce:transition-none";

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="group flex min-h-touch-target min-w-0 flex-1 items-center gap-1 rounded-xs text-start focus-visible:focus-ring-inverse"
      >
        <span className="grid min-w-0">
          <span dir="auto" className={cn(pageSide, "truncate text-small leading-snug font-semibold text-white")} {...ai}>
            {name}
          </span>
          {section ? (
            <span dir="auto" className={cn(pageSide, "truncate text-caption lb-ink-muted")}>
              {section.title}
            </span>
          ) : null}
        </span>
        <Icon icon={ChevronDown} size="sm" className="shrink-0 lb-ink-muted transition-colors duration-micro group-hover:text-white motion-reduce:transition-none" />
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
          <ol className="grid overflow-hidden rounded-creator-card bg-creator-surface">
            {entries.map((entry, index) => (
              <li key={entry.anchor} className="min-w-0 not-first:border-t not-first:border-creator-line">
                <a href={`#${entry.anchor}`} onClick={go} aria-current={index === current ? "true" : undefined} className={cn(row, "font-medium aria-[current=true]:font-bold")}>
                  <span dir="auto" className={cn(pageSide, "min-w-0 text-pretty")}>
                    {entry.title}
                  </span>
                  {index === current ? <Icon icon={Check} size="md" className="shrink-0 text-creator-accent-text" /> : null}
                </a>
              </li>
            ))}
          </ol>
          {documents.length > 0 ? (
            <>
              <h3 id={groupId} className="mt-3 px-1 text-small font-semibold text-creator-fg-muted">
                {t("laufbahn.documentsGroup")}
              </h3>
              <ul aria-labelledby={groupId} className="grid overflow-hidden rounded-creator-card bg-creator-surface">
                {documents.map((document) => (
                  <li key={document.href} className="min-w-0 not-first:border-t not-first:border-creator-line">
                    <a
                      href={document.href}
                      download={document.filename}
                      data-app-download={document.own ? undefined : ""}
                      onClick={go}
                      aria-label={document.own ? undefined : document.rowName}
                      className={cn(row, "font-semibold")}
                    >
                      <span dir="auto" className={cn(pageSide, "min-w-0 text-pretty")}>
                        {document.row}
                      </span>
                      <Icon icon={document.own ? FileText : Download} size="md" className="shrink-0 text-creator-accent-text" />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

/** The page's document links (the CV, the letter, both in one file) carry this: `<a download data-app-download>`. */
const APP_DOWNLOAD = "data-app-download";

/**
 * A press on one of the page's document links inside Linkyo's iPhone app (ADR 0087), where the web
 * view performs no `<a download>`: the PDF (our own address) is fetched and handed to the app, which
 * offers to save or share it; should that fail (the bridge's code not loading included), the web view
 * opens the PDF itself. True when the press was taken over. In a browser, or for any other press (a
 * modifier key, another button, another link), false and nothing happens: the link downloads as always.
 */
export function appDocumentPress(event: Pick<MouseEvent, "target" | "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "preventDefault">): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !bridgeAvailable()) return false;
  const target = event.target;
  const link = target instanceof Element ? target.closest(`a[${APP_DOWNLOAD}]`) : null;
  if (!(link instanceof HTMLAnchorElement)) return false;
  event.preventDefault();
  const { href, download } = link;
  // Should the hand-off fail (the bridge's chunk does not load after a deploy or offline, the fetch or
  // the post fails), the web view opens the PDF itself: a press is never swallowed.
  void import("@/features/app-mode/bridge-files")
    .then(({ appDownloadFrom }) => appDownloadFrom(href, download || "document.pdf"))
    .catch(() => false)
    .then((sent) => {
      if (!sent) window.location.assign(href);
    });
  return true;
}

/** Hands the page's document downloads to the app inside the app (`appDocumentPress`); renders nothing. */
export function AppDownloads(): null {
  useEffect(() => {
    if (!bridgeAvailable()) return;
    const press = (event: MouseEvent) => {
      appDocumentPress(event);
    };
    document.addEventListener("click", press);
    return () => document.removeEventListener("click", press);
  }, []);
  return null;
}
