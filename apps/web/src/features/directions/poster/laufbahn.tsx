import type { BlockOf, Profile } from "@linkyo/blocks";
import { formatYears } from "@linkyo/blocks/project";
import { hasImage } from "@linkyo/blocks/rules";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type CSSProperties, type ReactNode } from "react";

import { MediaImage, mediaSizes } from "../shared/creator-kit";
import { IndexList } from "./laufbahn-index";
import { paragraphs, textLink } from "./portfolio-sections";
import { linkDestination } from "./sections";
import { displayStyle, pageSide } from "./styles";

/**
 * Laufbahn (ADR 0069): pages for applications, CVs and personal profiles. Every titled section is
 * announced by a signpost, a square tile with a bold letter like the signs over a warehouse's aisles,
 * and the same signposts form the page's section index: a row of chips under the hero on phones, a
 * sticky list beside the sections on the wide canvas, marking the section being read.
 *
 * The section frame takes every kind of block; about, skills, experience and text have their own
 * calm renderers here, everything else keeps the renderer it has in every template. Plain server HTML:
 * motion is CSS (globals.css, `lb-*`), and the page is complete without it.
 */

const LATIN = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
/** The abjad order (أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ), in which Arabic letters items in a list. */
const ABJAD = ["أ", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن", "س", "ع", "ف", "ص", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ", "غ"];

/** The letter of the section at `index` (0 = the first titled section): A, B, C … or أ، ب، ج …; past the last letter, its number. */
export function signpostLetter(index: number, locale: Profile["locale"]): string {
  return (locale === "ar" ? ABJAD : LATIN)[index] ?? String(index + 1);
}

/** A titled section as the index and its signpost know it. */
export interface Signpost {
  /** The id of the block that opened the section (the section's key). */
  id: string;
  /** The section's own address on the page (`#anchor`), for the index and the hero's "read on". */
  anchor: string;
  letter: string;
  title: string;
  /** The section's view timeline: the index on the wide canvas follows it. */
  timeline: `--${string}`;
}

/** The signposts of a page's sections, in page order; untitled runs of blocks have none. */
export function signposts(sections: readonly { id: string; title: string | null }[], locale: Profile["locale"]): Signpost[] {
  const taken = new Set<string>();
  return sections
    .flatMap((section) => (section.title === null ? [] : [{ id: section.id, title: section.title }]))
    .map((section, index) => {
      const base = `section-${section.id.replace(/[^\w-]/g, "-")}`;
      const anchor = taken.has(base) ? `${base}-${String(index + 1)}` : base;
      taken.add(anchor);
      return { id: section.id, anchor, letter: signpostLetter(index, locale), title: section.title, timeline: `--lb-${String(index)}` };
    });
}

/** The page's index scope: every section's timeline, so the index (outside the sections) can follow them. */
export const indexScope = (entries: readonly Signpost[]): CSSProperties | undefined =>
  entries.length > 0 ? { timelineScope: entries.map((entry) => entry.timeline).join(", ") } : undefined;

/** A signpost's letter: the display face at its pairing's weight (no tracking or case change: it is one letter). */
const signStyle: CSSProperties = { fontWeight: "var(--creator-display-weight)" };

/**
 * The section index: a row of chips to swipe on phones (no scrollbar, each chip snaps, a chip reached
 * with Tab scrolls fully into view), chips that wrap in the reading column on tablets, a sticky list in
 * the start columns on the wide canvas. Plain anchor links, so the keyboard, the back button and a
 * shared address all work; each section keeps clear of the compact bar when it is jumped to.
 */
export function SignpostIndex({ entries }: { entries: readonly Signpost[] }): ReactNode {
  const t = useTranslations("creator");
  return (
    <nav aria-label={t("laufbahn.index")} className="min-w-0 @work:col-span-3">
      <IndexList className="mk-no-scrollbar -mx-creator-gutter flex snap-x snap-mandatory scroll-px-creator-gutter gap-2 overflow-x-auto px-creator-gutter py-1 @prose:mx-0 @prose:flex-wrap @prose:snap-none @prose:overflow-visible @prose:scroll-px-0 @prose:px-0 @work:sticky @work:top-24 @work:grid @work:gap-1">
        {entries.map((entry) => (
          <li key={entry.id} className="shrink-0 snap-start">
            <a
              href={`#${entry.anchor}`}
              style={{ "--lb-t": entry.timeline } as CSSProperties}
              className={cn(
                "flex min-h-touch-target items-center gap-3 rounded-sm border border-creator-line bg-creator-surface py-1 ps-1 pe-4 text-small font-semibold",
                "transition-colors duration-micro hover:border-creator-line-strong focus-visible:focus-ring motion-reduce:transition-none",
                "@work:lb-spy @work:border-transparent @work:bg-transparent @work:pe-2 @work:hover:border-creator-line",
              )}
            >
              <span aria-hidden className="lb-spy-sign grid size-control-sm shrink-0 place-items-center rounded-xs font-creator-display text-body leading-none" style={signStyle}>
                {entry.letter}
              </span>
              <span dir="auto" className={cn(pageSide, "lb-spy-label min-w-0 whitespace-nowrap @work:whitespace-normal")}>
                {entry.title}
              </span>
            </a>
          </li>
        ))}
      </IndexList>
    </nav>
  );
}

/**
 * One section: a hairline across, the signpost and the title, then the content. An untitled run of
 * blocks (before the first title, or the contact band) has no signpost. With motion "reveal" the
 * title row and the content rise in once as they enter the screen (`reveal: "self"`: the content's
 * own tiles and steps rise in one by one instead).
 */
export function SignpostSection({
  entry,
  blockIds,
  ai,
  reveal,
  children,
}: {
  entry: Signpost | undefined;
  blockIds?: string | undefined;
  /** The title comes from an AI-written block. */
  ai: boolean;
  reveal: "none" | "section" | "self";
  children: ReactNode;
}): ReactNode {
  const id = useId();
  const content = cn("grid min-w-0 grid-cols-1 gap-4", reveal === "section" && "lb-reveal");
  if (!entry) {
    return (
      <div data-block-ids={blockIds} className={content}>
        {children}
      </div>
    );
  }
  return (
    <section
      id={entry.anchor}
      aria-labelledby={id}
      data-block-ids={blockIds}
      className="lb-section grid min-w-0 grid-cols-1 gap-6 border-t border-creator-line pt-8 @prose:gap-8 @work:pt-10"
      style={{ viewTimelineName: entry.timeline }}
    >
      <div className={cn("flex min-w-0 items-center gap-4", reveal !== "none" && "lb-reveal")}>
        <span aria-hidden className="grid size-control-lg shrink-0 place-items-center rounded-xs bg-creator-accent font-creator-display text-h3 leading-none text-creator-accent-fg" style={signStyle}>
          {entry.letter}
        </span>
        <h2
          id={id}
          dir="auto"
          className={cn(pageSide, "min-w-0 font-creator-display text-h2 leading-tight text-balance break-words @work:text-h1 rtl:leading-snug")}
          style={displayStyle}
          {...(ai ? { "data-ai-generated": "true" } : {})}
        >
          {entry.title}
        </h2>
      </div>
      <div className={content}>{children}</div>
    </section>
  );
}

/**
 * Who the owner is: the first paragraph as a large lead, the facts as a definition grid under a
 * hairline each, then the rest of the text in a readable measure. A portrait, when there is one,
 * stands at the start of the lead.
 */
export function LaufbahnAbout({ block }: { block: BlockOf<"about"> }): ReactNode {
  const [first, ...rest] = paragraphs(block.text);
  const facts = block.facts ?? [];
  const portrait = hasImage(block.portrait) ? block.portrait : undefined;
  return (
    <div className="grid min-w-0 gap-8">
      {first || portrait ? (
        <div className={cn("grid min-w-0 items-start gap-6", portrait && "@prose:grid-cols-3")}>
          {portrait ? (
            <div className="relative aspect-portrait w-1/2 overflow-hidden rounded-creator-card bg-creator-surface-2 @prose:w-full">
              <MediaImage src={portrait.src} focal={portrait.focal} alt={portrait.alt} sizes={mediaSizes.third} />
            </div>
          ) : null}
          {first ? (
            <p
              dir="auto"
              className={cn(
                pageSide,
                "max-w-prose text-h3 leading-snug font-medium text-pretty whitespace-pre-line text-creator-fg rtl:leading-normal rtl:tracking-normal @work:text-h2 @work:rtl:leading-normal",
                portrait && "@prose:col-span-2",
              )}
            >
              {first}
            </p>
          ) : null}
        </div>
      ) : null}
      {facts.length > 0 ? (
        <dl className="grid min-w-0 grid-cols-1 gap-x-8 @prose:grid-cols-2">
          {facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`} className="grid min-w-0 content-start gap-1 border-t border-creator-line py-4">
              <dt dir="auto" className={cn(pageSide, "text-small text-creator-fg-muted")}>
                {fact.label}
              </dt>
              <dd dir="auto" className={cn(pageSide, "text-body font-semibold break-words")}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {rest.length > 0 ? (
        <div className="grid max-w-prose gap-4">
          {rest.map((part) => (
            <p key={part} dir="auto" className={cn(pageSide, "text-body whitespace-pre-line text-creator-fg @prose:text-body-lg")}>
              {part}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Skills and tools as a grid of flat tiles (two columns on phones, three on the wide canvas), each with
 * its place in the list and the skill. The list is ordered, so the numbers are only its look. Hover
 * gives a stronger hairline and a step in the fill; nothing lifts.
 */
export function LaufbahnSkills({ block, reveal }: { block: BlockOf<"tools">; reveal: boolean }): ReactNode {
  return (
    <ol className="grid min-w-0 grid-cols-2 gap-2 @prose:gap-3 @work:grid-cols-3">
      {block.items.map((item, index) => (
        <li
          key={item}
          className={cn(
            "grid min-h-24 min-w-0 content-between gap-4 rounded-creator-card border border-creator-line bg-creator-surface p-4",
            "transition-colors duration-micro hover:border-creator-line-strong hover:bg-creator-bg motion-reduce:transition-none",
            reveal && "lb-reveal",
          )}
        >
          <span aria-hidden className="text-caption font-semibold text-creator-accent-text tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span dir="auto" className={cn(pageSide, "text-body leading-snug font-semibold hyphens-auto break-words")}>
            {item}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Experience as a vertical timeline in the order the owner entered it: a node per step, the years in
 * tabular figures ("2021–heute" for a step still going on, its node filled), the role, where, and a
 * note. The rail between the nodes fills with the accent as the steps scroll by (drawn in full without
 * scroll-driven animations and with reduced motion). Logical sides: it mirrors in Arabic.
 */
export function LaufbahnTimeline({ block, locale, reveal }: { block: BlockOf<"timeline">; locale: Profile["locale"]; reveal: boolean }): ReactNode {
  const t = useTranslations("creator");
  return (
    <ol className="grid min-w-0 grid-cols-1">
      {block.items.map((item) => (
        <li key={`${item.role}-${String(item.years.from)}-${item.org ?? ""}`} className={cn("lb-step grid min-w-0 justify-items-start gap-1 ps-10 pb-8 last:pb-0", reveal && "lb-reveal")}>
          <span
            aria-hidden
            className={cn("absolute start-0 top-1 size-3 rounded-full border-emphasis border-creator-accent", item.years.to === "now" ? "bg-creator-accent" : "bg-creator-bg")}
          />
          {/* One isolated run in the page's direction, so every range reads from its start, also in Arabic. */}
          <p className="text-small font-semibold text-creator-accent-text tabular-nums">
            <bdi dir={locale === "ar" ? "rtl" : "ltr"}>{formatYears(item.years, t("laufbahn.ongoing"))}</bdi>
          </p>
          <p dir="auto" className={cn(pageSide, "text-title font-semibold text-balance rtl:tracking-normal")}>
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
            <p dir="auto" className={cn(pageSide, "max-w-prose text-body text-pretty text-creator-fg-muted")}>
              {item.note}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** From this many paragraphs (or characters) on, a text is a long read (a letter) and gets its reading column. */
const LONG_PARAGRAPHS = 3;
const LONG_CHARACTERS = 600;
/** Reading speed for the reading-time label (words a minute). */
const WORDS_A_MINUTE = 200;

/**
 * A text block in its paragraphs (a single line break stays one). A short text reads as a lead; a long
 * one, such as a cover letter, is set in a calm reading column on a flat tile with a hairline, under a
 * quiet label with its reading time. The tile runs the column's width like every other edge there; the
 * lines keep the reading measure.
 */
export function LaufbahnText({ text }: { text: string }): ReactNode {
  const t = useTranslations("creator");
  const parts = paragraphs(text);
  if (parts.length < LONG_PARAGRAPHS && text.length < LONG_CHARACTERS) {
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
  const minutes = Math.max(1, Math.round(text.split(/\s+/u).filter(Boolean).length / WORDS_A_MINUTE));
  return (
    <div className="grid min-w-0 gap-5 rounded-creator-card border border-creator-line bg-creator-surface p-6 @prose:gap-6 @prose:p-10">
      <p className="text-caption font-semibold text-creator-fg-muted">{t("laufbahn.readingTime", { minutes })}</p>
      {parts.map((part) => (
        <p key={part} dir="auto" className={cn(pageSide, "max-w-prose text-body whitespace-pre-line text-creator-fg @prose:text-body-lg")}>
          {part}
        </p>
      ))}
    </div>
  );
}
