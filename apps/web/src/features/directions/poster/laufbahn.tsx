import { hasImage, type BlockOf, type Profile } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, ChevronDown, CircleCheck, Clock, Download, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { MediaImage, mediaSizes } from "../shared/creator-kit";
import { iconFor, opensShort, readingMinutes, splitLead, textKind } from "./laufbahn-content";
import { IndexList } from "./laufbahn-index";
import { textLink } from "./portfolio-sections";
import { linkDestination, paragraphs } from "./sections";
import { pageSide } from "./styles";

/**
 * Laufbahn (ADR 0069): pages for applications, CVs and personal profiles, set like a native app and
 * read like a dossier (round 6). Every titled section opens with its title, and the titles form the
 * page's contents: on phones the app bar names the section being read and opens the contents as a
 * sheet; chips that wrap on tablets; on the wide canvas each title hangs in the first three of twelve
 * columns beside its section and stays at the top while the section is read (a running head). Facts
 * and skills are calm lists on one soft sheet (a step in the fill, no frame and no rules; beside a
 * real portrait the facts are a list under hairlines, as in Werkbogen), never tiles that look like
 * buttons, and no word is ever broken: a label too long for its row wraps between words. The career
 * reads as a table, as on paper: the years in the first column, the role, where and a note beside a
 * single rail with a dot for each step.
 *
 * The section frame takes every kind of block; about, skills, experience and text have their own
 * calm renderers here, everything else keeps the renderer it has in every template. Server HTML with
 * one small script (the index); motion is CSS (globals.css, `lb-*`), and the page is complete without it.
 */

/** A titled section as the contents and its heading know it. */
export interface Signpost {
  /** The id of the block that opened the section (the section's key). */
  id: string;
  /** The section's own address on the page (`#anchor`), for the contents and the hero's first action. */
  anchor: string;
  title: string;
}

/** The titled sections of a page, in page order; untitled runs of blocks have none. */
export function signposts(sections: readonly { id: string; title: string | null }[]): Signpost[] {
  const taken = new Set<string>();
  return sections
    .flatMap((section) => (section.title === null ? [] : [{ id: section.id, title: section.title }]))
    .map((section, index) => {
      const base = `section-${section.id.replace(/[^\w-]/g, "-")}`;
      const anchor = taken.has(base) ? `${base}-${String(index + 1)}` : base;
      taken.add(anchor);
      return { id: section.id, anchor, title: section.title };
    });
}

/**
 * The section index on tablets: chips that wrap in the reading column. Phones open the contents from
 * the app bar (SectionSwitcher); on the wide canvas the titles hang beside their sections and the bar
 * opens the contents too. Plain anchor links, so the keyboard, the back button and a shared address
 * all work without the script.
 */
export function SignpostIndex({ entries }: { entries: readonly Signpost[] }): ReactNode {
  const t = useTranslations("creator");
  return (
    <nav aria-label={t("laufbahn.index")} className="hidden min-w-0 @prose:block @work:hidden">
      <IndexList entries={entries.map(({ anchor, title }) => ({ anchor, title }))} className="flex flex-wrap gap-2" />
    </nav>
  );
}

/** A section's content on the wide canvas: nine of the twelve columns, beside its hanging title. */
const CONTENT = "grid min-w-0 grid-cols-1 gap-6 @work:col-span-9 @work:col-start-4";

/**
 * One section: the title, then the content; sections stand apart by space alone (no hairline, no
 * rule), as the screens of an app do, and nothing moves as they scroll in. On the wide canvas the
 * title hangs in the first three columns and stays at the top while its section is read. An untitled
 * run of blocks (before the first title) has no heading; its content keeps the same columns.
 */
export function SignpostSection({
  entry,
  blockIds,
  ai,
  children,
}: {
  entry: Signpost | undefined;
  blockIds?: string | undefined;
  /** The title comes from an AI-written block. */
  ai: boolean;
  children: ReactNode;
}): ReactNode {
  const id = useId();
  if (!entry) {
    return (
      <div data-block-ids={blockIds} className="grid min-w-0 grid-cols-1 @work:grid-cols-12 @work:gap-x-6">
        <div className={CONTENT}>{children}</div>
      </div>
    );
  }
  return (
    <section id={entry.anchor} aria-labelledby={id} data-block-ids={blockIds} className="lb-section grid min-w-0 grid-cols-1 gap-6 @work:grid-cols-12 @work:gap-x-6">
      <h2
        id={id}
        dir="auto"
        className={cn(
          pageSide,
          "min-w-0 font-creator-display text-h2 leading-tight font-bold tracking-tight text-balance break-words rtl:leading-snug rtl:tracking-normal",
          "@work:sticky @work:top-24 @work:col-span-3 @work:self-start",
        )}
        {...(ai ? { "data-ai-generated": "true" } : {})}
      >
        {entry.title}
      </h2>
      <div className={CONTENT}>{children}</div>
    </section>
  );
}

/** A soft square in the accent for an icon (notes): decorative, the words beside it carry the meaning. */
function IconSquare({ icon }: { icon: Parameters<typeof Icon>[0]["icon"] }): ReactNode {
  return (
    <span aria-hidden className="lb-soft grid size-control-md shrink-0 place-items-center rounded-xs text-creator-accent-text">
      <Icon icon={icon} size="md" />
    </span>
  );
}

/** The lead of "About": a size up from the body, larger on the wide canvas, the measure kept. */
const aboutLead = cn(
  pageSide,
  "max-w-prose text-h3 leading-snug font-medium text-pretty whitespace-pre-line text-creator-fg rtl:leading-normal rtl:tracking-normal @work:text-h2",
);

/** The rest of "About" as body, in its paragraphs. */
function AboutBody({ parts }: { parts: readonly string[] }): ReactNode {
  if (parts.length === 0) return null;
  return (
    <div className="grid max-w-prose gap-4">
      {parts.map((part) => (
        <p key={part} dir="auto" className={cn(pageSide, "text-body text-pretty whitespace-pre-line text-creator-fg @work:text-body-lg")}>
          {part}
        </p>
      ))}
    </div>
  );
}

type Fact = NonNullable<BlockOf<"about">["facts"]>[number];

/** The facts sheet's widths: a phone, a tablet (the reading column) and the wide canvas. */
export type SheetWidth = "phone" | "prose" | "work";

/**
 * The most characters a fact's value may have to share a row of so many facts, per width (its label
 * may have four fifths of that): about one line of Geist at text-body in each cell. The cells: a
 * phone's two 143 px (350 px less p-5 and the gap); the reading column's two 288 px and three 184 px
 * (600 px inside p-5); the wide canvas's two 381 px, three 246 px and four 178 px (the 834 px of nine
 * columns less p-6). Anything longer needs fewer facts to a row.
 */
const ROOM: Record<SheetWidth, Partial<Record<number, number>>> = {
  phone: { 2: 18 },
  prose: { 2: 36, 3: 23 },
  work: { 2: 47, 3: 30, 4: 22 },
};

const fits = (fact: Fact, chars: number): boolean => fact.value.length <= chars && fact.label.length <= Math.floor(chars * 0.8);

/**
 * The facts sheet's rows at a width, as the number of facts on each, in the owner's order: as many to
 * a row as the longest fact allows (two on phones, three on tablets, four on the wide canvas at
 * most), the rows as even as they can be with the fuller ones first (five facts: three and two). A
 * fact never stands alone on a row of a sheet in columns, where half the sheet would stay empty
 * beside it: then the sheet takes one fact a row. So three facts are one row of three on the wide
 * canvas and one a row on phones; every row is full.
 */
export function factRows(facts: readonly Fact[], width: SheetWidth): number[] {
  const count = facts.length;
  if (count === 0) return [];
  const most = [4, 3, 2].find((perRow) => perRow <= count && ROOM[width][perRow] !== undefined && facts.every((fact) => fits(fact, ROOM[width][perRow] ?? 0))) ?? 1;
  const rows = Math.ceil(count / most);
  const even = Math.floor(count / rows);
  const sizes = Array.from({ length: rows }, (_, row) => even + (row < count % rows ? 1 : 0));
  return sizes.includes(1) ? Array.from({ length: count }, () => 1) : sizes;
}

/** A fact's share of the sheet's twelve columns, by the number of facts on its row (literal classes for Tailwind). */
const SPANS: Record<SheetWidth, Record<number, string>> = {
  phone: { 1: "col-span-12", 2: "col-span-6" },
  prose: { 1: "@prose:col-span-12", 2: "@prose:col-span-6", 3: "@prose:col-span-4" },
  work: { 1: "@work:col-span-12", 2: "@work:col-span-6", 3: "@work:col-span-4", 4: "@work:col-span-3" },
};

/** Each fact's columns on the sheet's twelve, at every width (`factRows`): every row is filled. */
export function factSpans(facts: readonly Fact[]): string[] {
  const perWidth = (["phone", "prose", "work"] as const).map((width) => factRows(facts, width).flatMap((size) => Array.from({ length: size }, () => SPANS[width][size] ?? "")));
  return facts.map((_, index) => cn(...perWidth.map((spans) => spans[index])));
}

/**
 * Who the owner is: the first paragraph as a lead (a long one leads with its first sentence, and the
 * rest of it opens the body), then the facts, then the rest of the text as body. The facts the head
 * already shows (the position applied for, the employer: `omit`) are not repeated here.
 * - With a portrait (as Werkbogen's "About"): under the lead the portrait on two of five columns at the
 *   start and the facts on the other three beside it; the facts a list with a hairline above each row.
 *   The portrait is the owner's choice: any picture they set on the block stands there, a drawn still
 *   from the library too, with its alt text and focal point (the founder, round 6 review 4). The CV is
 *   stricter: it prints only an uploaded photo, never a drawing (features/documents/photo.ts).
 * - Without one: the facts on one soft sheet in full, even rows (`factRows`): as many to a row as
 *   the longest fact allows at each width, never one alone beside an empty half. No facts left: no
 *   sheet.
 */
export function LaufbahnAbout({ block, omit = [] }: { block: BlockOf<"about">; omit?: readonly Fact[] | undefined }): ReactNode {
  const [opening, ...others] = paragraphs(block.text);
  const [first, more] = opening ? splitLead(opening) : [undefined, null];
  const rest = more ? [more, ...others] : others;
  const shown = (block.facts ?? []).filter((fact) => !omit.some((head) => head.label === fact.label && head.value === fact.value));
  const portrait = hasImage(block.portrait) ? block.portrait : undefined;
  const spans = factSpans(shown);
  if (portrait) {
    return (
      <div className="grid min-w-0 gap-6 @prose:gap-8">
        {first ? (
          <p dir="auto" className={aboutLead}>
            {first}
          </p>
        ) : null}
        <div data-about-portrait className="grid min-w-0 grid-cols-5 items-start gap-x-4 @prose:gap-x-6">
          <div className="relative col-span-2 aspect-portrait overflow-hidden rounded-creator-card bg-creator-surface-2">
            <MediaImage src={portrait.src} focal={portrait.focal} alt={portrait.alt} sizes={mediaSizes.half} />
          </div>
          {shown.length > 0 ? (
            // One fact a row beside the portrait, a hairline above each. Words stay whole: a value wraps
            // between words, and only a word wider than its column may break (WCAG 1.4.10).
            <dl className="col-span-3 grid min-w-0 grid-cols-1 content-start">
              {shown.map((fact) => (
                <div key={`${fact.label}-${fact.value}`} className="grid min-w-0 grid-cols-1 content-start gap-1 border-t border-creator-line py-3">
                  <dt dir="auto" className={cn(pageSide, "text-small text-creator-fg-muted")}>
                    {fact.label}
                  </dt>
                  <dd dir="auto" className={cn(pageSide, "text-small leading-snug font-semibold text-pretty hyphens-manual break-words @prose:text-body")}>
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <AboutBody parts={rest} />
      </div>
    );
  }
  return (
    <div className="grid min-w-0 gap-6 @prose:gap-8">
      {first ? (
        <p dir="auto" className={aboutLead}>
          {first}
        </p>
      ) : null}
      {shown.length > 0 ? (
        // One soft sheet (a step in the fill, no frame, no rules), the label quiet over its value.
        <dl className="grid min-w-0 grid-cols-12 gap-x-6 gap-y-4 rounded-creator-card bg-creator-surface p-5 @work:p-6">
          {shown.map((fact, index) => (
            <div key={`${fact.label}-${fact.value}`} className={cn("grid min-w-0 grid-cols-1 content-start gap-1", spans[index])}>
              <dt dir="auto" className={cn(pageSide, "text-small text-creator-fg-muted")}>
                {fact.label}
              </dt>
              <dd dir="auto" className={cn(pageSide, "text-body leading-snug font-semibold text-pretty hyphens-manual break-words")}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <AboutBody parts={rest} />
    </div>
  );
}

/**
 * Skills and tools as a list on one soft sheet (a step in the fill, no frame and no rules between the
 * rows): one skill a row on phones, two from tablets on, three on the wide canvas. Each row is the
 * skill's icon in the accent (from the skill's own words by a curated map, laufbahn-content.ts; a
 * neutral check where nothing fits) and its label, whole: a long label wraps between words. Nothing
 * about a row says "press me", because nothing happens on a press.
 */
export function LaufbahnSkills({ block, locale }: { block: BlockOf<"tools">; locale: Profile["locale"] }): ReactNode {
  return (
    <ul className="grid min-w-0 grid-cols-1 gap-x-6 rounded-creator-card bg-creator-surface px-4 py-2 @prose:grid-cols-2 @prose:px-6 @prose:py-3 @work:grid-cols-3">
      {block.items.map((item) => (
        <li key={item} className="flex min-h-control-lg min-w-0 items-center gap-3 py-1">
          <Icon icon={iconFor(item, locale) ?? CircleCheck} size="md" className="shrink-0 text-creator-accent-text" />
          <span dir="auto" className={cn(pageSide, "min-w-0 text-body leading-snug font-medium text-pretty hyphens-manual break-words rtl:leading-normal")}>
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A span of years as set: "2021 – heute" (an en dash between spaces), or a single year alone. */
export function yearsText(years: BlockOf<"timeline">["items"][number]["years"], now: string): string {
  if (years.to === undefined || years.to === years.from) return String(years.from);
  return `${String(years.from)} – ${years.to === "now" ? now : String(years.to)}`;
}

/**
 * Experience as a table, as on paper, in the order the owner entered it: from tablet widths on, the
 * years in the first column (tabular figures, "2021 – heute", and the tag "aktuell" under a step still
 * going on), then the role, where and a note beside a single rail with a dot for each step (filled for
 * the current one). On phones the table would leave the words a narrow column (146 px at 320), so the
 * years stand as a small accent line above the role inside the railed column, the tag beside them,
 * and the words take the column's whole width. One DOM for every width: the years come first, the rail
 * is a decorative item of its own between them and the words (or beside both on phones), placed by the
 * grid. The rail fills with the accent as the steps scroll by (drawn in full without scroll-driven
 * animations and with reduced motion). Logical sides: it mirrors in Arabic.
 */
export function LaufbahnTimeline({ block, locale }: { block: BlockOf<"timeline">; locale: Profile["locale"] }): ReactNode {
  const t = useTranslations("creator");
  return (
    // The rail's track is min-content (its 2 px), never stretched by the room the table leaves; the
    // years' track holds their space to the rail (pe-4, pe-6), so the table keeps round 6's measures.
    <ol className="grid min-w-0 grid-cols-[min-content_minmax(0,1fr)] @prose:grid-cols-[minmax(calc(var(--spacing-24)+var(--spacing-4)),max-content)_min-content_minmax(0,1fr)] @work:grid-cols-[minmax(calc(var(--spacing-32)+var(--spacing-6)),max-content)_min-content_minmax(0,var(--container-prose))]">
      {block.items.map((item, index) => {
        const ongoing = item.years.to === "now";
        // The rail ends with the last step's words: no space under the last one (nothing runs on past it).
        const last = index === block.items.length - 1;
        return (
          <li key={`${item.role}-${String(item.years.from)}-${item.org ?? ""}`} className="col-span-full grid min-w-0 grid-cols-subgrid gap-y-1 @prose:gap-y-0">
            {/* Phones: a line above the role, beside the rail, the tag after the years. From tablets on:
                the table's first column, the tag under the years. */}
            <div className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ps-5 @prose:col-start-1 @prose:grid @prose:content-start @prose:justify-items-start @prose:gap-2 @prose:ps-0 @prose:pe-4 @prose:pt-0_5 @work:pe-6">
              {/* One isolated run in the page's direction, so every range reads from its start, also in Arabic. */}
              <p className="text-small font-semibold whitespace-nowrap text-creator-accent-text tabular-nums @work:text-body">
                <bdi dir={locale === "ar" ? "rtl" : "ltr"}>{yearsText(item.years, t("laufbahn.ongoing"))}</bdi>
              </p>
              {ongoing ? <span className="rounded-full lb-soft px-2 text-caption font-semibold text-creator-accent-text">{t("laufbahn.current")}</span> : null}
            </div>
            {/* The rail: one line through every step (its own grid item, beside the years and the words on
                phones, between them from tablets on), with the step's dot on its first line. */}
            <span aria-hidden className="lb-step col-start-1 row-start-1 row-end-3 w-0_5 bg-creator-line @prose:col-start-2 @prose:row-end-2">
              <span
                aria-hidden
                className={cn("lb-node size-dot rounded-full border-[length:var(--spacing-0_5)] border-creator-accent", ongoing ? "bg-creator-accent" : "bg-creator-bg")}
              />
            </span>
            <div
              data-lb-entry
              className={cn("col-start-2 row-start-2 grid min-w-0 content-start justify-items-start gap-1 ps-5 @prose:col-start-3 @prose:row-start-1 @work:ps-8", !last && "pb-8")}
            >
              <p dir="auto" className={cn(pageSide, "text-title font-semibold text-balance rtl:tracking-normal @work:text-h3")}>
                {item.role}
              </p>
              {item.org ? (
                item.url ? (
                  <a href={item.url} className={cn("inline-flex min-h-touch-target max-w-full items-center gap-1", textLink)}>
                    <span dir="auto" className="truncate">
                      {item.org}
                    </span>
                    <Icon icon={ArrowUpRight} size="sm" className="shrink-0 rtl:-scale-x-100" />
                  </a>
                ) : (
                  <p dir="auto" className={cn(pageSide, "text-body text-creator-fg-muted")}>
                    {item.org}
                  </p>
                )
              ) : item.url ? (
                <a href={item.url} className={cn("inline-flex min-h-touch-target max-w-full items-center gap-1", textLink)}>
                  <bdi dir="ltr" className="truncate">
                    {linkDestination(item.url)}
                  </bdi>
                  <Icon icon={ArrowUpRight} size="sm" className="shrink-0 rtl:-scale-x-100" />
                </a>
              ) : null}
              {item.note ? (
                <p dir="auto" className={cn(pageSide, "max-w-prose text-small text-pretty text-creator-fg-muted @work:text-body")}>
                  {item.note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A paragraph of a long read: body on phones, a size up from tablets on, the measure kept. */
const readingParagraph = cn(pageSide, "max-w-prose text-body whitespace-pre-line @prose:text-body-lg");

/** The letter's PDF: its address, file name and page count (features/documents). */
export interface LetterPdf {
  href: string;
  filename: string;
  pages: number;
}

/**
 * A text block in its paragraphs (a single line break stays one), set by its length:
 * - a short note (under 320 characters) is a callout: a soft tile with an icon in a soft accent
 *   square, chosen from the section's title by the skills' map (a light bulb otherwise);
 * - a long read is a reading tile under a quiet line with its reading time; the cover letter is set
 *   as a letter: on white paper in light mode (the page's surface in dark mode), its subject (the same
 *   as the PDF's) above the owner's paragraphs, and its PDF as a small pill in the top line. Over 900
 *   characters it opens on phones with its first two paragraphs and a native disclosure for the rest;
 *   on the wide canvas, and whenever the visitor arrives at the section by its address, it is whole;
 * - anything between is a lead of plain paragraphs.
 */
export function LaufbahnText({
  text,
  title,
  letter,
  locale,
  pdf = null,
  subject = null,
  paper = "light",
}: {
  text: string;
  title: string | null;
  letter: boolean;
  locale: Profile["locale"];
  /** The cover letter's PDF (a Laufbahn page that offers its documents), else null. */
  pdf?: LetterPdf | null | undefined;
  /** The letter's subject ("Bewerbung als …"), the same as the PDF's; null on Arabic pages and without documents. */
  subject?: string | null | undefined;
  /** The page's mode: a letter is white paper on a light page, the page's surface on a dark one. */
  paper?: "light" | "dark" | undefined;
}): ReactNode {
  const t = useTranslations("creator");
  const parts = paragraphs(text);
  const kind = textKind(text);
  if (kind === "note") {
    return (
      <div className="flex min-w-0 items-start gap-4 rounded-creator-card bg-creator-surface p-5 @prose:gap-5 @prose:p-6">
        <IconSquare icon={(title ? iconFor(title, locale) : undefined) ?? Lightbulb} />
        <div className="grid min-w-0 flex-1 gap-4 pt-2">
          {parts.map((part) => (
            <p key={part} dir="auto" className={cn(pageSide, "max-w-prose text-body text-pretty whitespace-pre-line text-creator-fg @prose:text-body-lg")}>
              {part}
            </p>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "plain") {
    return (
      <div className="grid max-w-prose gap-4">
        {parts.map((part) => (
          <p key={part} dir="auto" className={cn(pageSide, "text-body-lg text-pretty whitespace-pre-line text-creator-fg")}>
            {part}
          </p>
        ))}
      </div>
    );
  }
  const short = opensShort(text);
  const [head, rest] = short ? [parts.slice(0, 2), parts.slice(2)] : [parts, []];
  const sheet = letter && paper === "light" ? "bg-white text-ink" : "bg-creator-surface text-creator-fg";
  return (
    <div
      data-lb-letter={letter ? "" : undefined}
      // The paper spans the content's columns like every sheet of the section (one right edge); the
      // words inside keep the reading measure.
      className={cn("grid min-w-0 gap-4 rounded-creator-card p-5 @prose:gap-6 @prose:p-10 @work:px-16 @work:py-12", sheet)}
    >
      <div className="flex min-w-0 max-w-prose flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="inline-flex items-center gap-2 text-small font-medium text-creator-fg-muted">
          <Icon icon={Clock} size="sm" className="shrink-0" />
          {t("laufbahn.readingTime", { minutes: readingMinutes(text) })}
        </p>
        {letter && pdf ? (
          <a
            href={pdf.href}
            download={pdf.filename}
            data-app-download=""
            aria-label={t("laufbahn.letterPdfName", { document: t("laufbahn.letterInSentence"), pages: pdf.pages })}
            className="inline-flex min-h-touch-target items-center gap-2 rounded-full lb-soft px-3 text-small font-semibold text-creator-accent-text transition-[scale] duration-micro focus-visible:focus-ring active:scale-pressed motion-reduce:transition-none motion-reduce:active:scale-none"
          >
            <Icon icon={Download} size="sm" className="shrink-0" />
            {t("laufbahn.pdf")}
          </a>
        ) : null}
      </div>
      {letter && subject ? (
        <p dir="auto" className={cn(pageSide, "max-w-prose text-title font-bold text-balance")}>
          {subject}
        </p>
      ) : null}
      {head.map((part) => (
        <p key={part} dir="auto" className={readingParagraph}>
          {part}
        </p>
      ))}
      {rest.length > 0 ? (
        // The button under the first two paragraphs; opened, it stays where it was pressed (now "Show
        // less", focus and all) and the rest unfolds below it. The wide canvas, and arriving at the
        // section by its address (the hero's button, the index), show everything and no button.
        <details className="lb-more group/more flex min-w-0 flex-col gap-4 @prose:gap-6">
          <summary className="flex min-h-control-lg w-full cursor-pointer list-none items-center justify-center gap-2 rounded-creator-button border border-creator-line-strong px-4 text-body font-semibold transition-[scale,background-color] duration-standard ease-standard select-none hover:bg-creator-bg focus-visible:focus-ring active:scale-pressed motion-reduce:transition-none motion-reduce:active:scale-none @prose:w-auto @prose:justify-self-start [&::-webkit-details-marker]:hidden">
            <span className="group-open/more:hidden">{t(letter ? "laufbahn.readLetterWhole" : "laufbahn.readMore")}</span>
            <span className="hidden group-open/more:inline">{t("laufbahn.readLess")}</span>
            <Icon icon={ChevronDown} size="md" className="shrink-0 transition-transform duration-standard ease-standard group-open/more:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="grid min-w-0 gap-4 @prose:gap-6">
            {rest.map((part) => (
              <p key={part} dir="auto" className={readingParagraph}>
                {part}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
