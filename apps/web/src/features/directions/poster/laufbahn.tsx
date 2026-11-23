import type { BlockOf, Profile } from "@linkyo/blocks";
import { formatYears } from "@linkyo/blocks/project";
import { hasImage } from "@linkyo/blocks/rules";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, Briefcase, ChevronDown, CircleCheck, Clock, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { MediaImage, mediaSizes } from "../shared/creator-kit";
import { CREDENTIAL_ICONS, factSpans, iconFor, opensShort, readingMinutes, skillLayout, softJoints, splitLead, textKind } from "./laufbahn-content";
import { IndexList } from "./laufbahn-index";
import { textLink } from "./portfolio-sections";
import { linkDestination, paragraphs } from "./sections";
import { displayStyle, pageSide, signStyle } from "./styles";

/**
 * Laufbahn (ADR 0069): pages for applications, CVs and personal profiles. Every titled section is
 * announced by a signpost, a square tile with a bold letter like the signs over a warehouse's aisles,
 * and the same signposts form the page's section index: a sticky row of chips on phones, chips that
 * wrap on tablets, a sticky list beside the sections on the wide canvas, marking the section being read.
 *
 * The section frame takes every kind of block; about, skills, experience and text have their own
 * calm renderers here, everything else keeps the renderer it has in every template. Server HTML with
 * one small script (the index); motion is CSS (globals.css, `lb-*`), and the page is complete without it.
 *
 * One rhythm on phones: 48 between sections, 32 under a section's hairline, 24 between a title and
 * its content and between the parts of a content, 16 between paragraphs, 8 between tiles and cells.
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
  /** The section's own address on the page (`#anchor`), for the index and the hero's first action. */
  anchor: string;
  letter: string;
  title: string;
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
      return { id: section.id, anchor, letter: signpostLetter(index, locale), title: section.title };
    });
}

/**
 * The section index. Phones: a compact row of chips that sticks flush under the compact bar once the
 * hero has passed, on the page's solid ground (a hairline under it only while it is stuck), to swipe
 * sideways, the section being read marked and kept in view. Tablets: chips that wrap in the reading
 * column. The wide canvas: a sticky list in the first three columns. Plain anchor links throughout,
 * so the keyboard, the back button and a shared address all work without the script.
 */
export function SignpostIndex({ entries }: { entries: readonly Signpost[] }): ReactNode {
  const t = useTranslations("creator");
  return (
    <nav aria-label={t("laufbahn.index")} className="lb-index layer-sticky -mx-creator-gutter min-w-0 bg-creator-bg @prose:mx-0 @prose:bg-transparent @work:col-span-3">
      <IndexList
        entries={entries.map(({ anchor, letter, title }) => ({ anchor, letter, title }))}
        className="mk-no-scrollbar lb-fade flex snap-x scroll-px-creator-gutter gap-2 overflow-x-auto px-creator-gutter py-1 @prose:flex-wrap @prose:snap-none @prose:overflow-visible @prose:scroll-px-0 @prose:px-0 @work:sticky @work:top-24 @work:grid @work:gap-1"
      />
      <span aria-hidden className="lb-index-edge absolute inset-x-0 bottom-0 @prose:hidden" />
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
  const content = cn("grid min-w-0 grid-cols-1 gap-6", reveal === "section" && "lb-reveal");
  if (!entry) {
    return (
      <div data-block-ids={blockIds} className={content}>
        {children}
      </div>
    );
  }
  return (
    <section id={entry.anchor} aria-labelledby={id} data-block-ids={blockIds} className="lb-section grid min-w-0 grid-cols-1 gap-6 border-t border-creator-line pt-8 @prose:gap-8 @work:pt-10">
      <div className={cn("flex min-w-0 items-center gap-4", reveal !== "none" && "lb-reveal")}>
        <span
          aria-hidden
          className="grid size-control-md shrink-0 place-items-center rounded-xs bg-creator-accent font-creator-display text-title leading-none text-creator-accent-fg @prose:size-control-lg @prose:text-h3"
          style={signStyle}
        >
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

/** A soft square in the accent for an icon (skills, notes): decorative, the words beside it carry the meaning. */
function IconSquare({ icon, size = "sm" }: { icon: Parameters<typeof Icon>[0]["icon"]; size?: "sm" | "md" }): ReactNode {
  return (
    <span aria-hidden className={cn("lb-soft grid shrink-0 place-items-center rounded-xs text-creator-accent-text", size === "sm" ? "size-control-sm" : "size-control-md")}>
      <Icon icon={icon} size="md" />
    </span>
  );
}

/** How a fact cell spans the two columns, by its span (closing every row). */
const FACT_SPAN = { 1: "", 2: "col-span-2" } as const;

/**
 * Who the owner is: the first paragraph as a lead (calm on phones, larger from tablets on; a long one
 * leads with its first sentence, so the lead stays within about five lines on a phone, and the rest of
 * it opens the body), the facts as a two-by-two sheet of cells between hairlines, then the rest of the
 * text as body. A portrait, when there is one, stands at the start of the lead.
 */
export function LaufbahnAbout({ block, locale }: { block: BlockOf<"about">; locale: Profile["locale"] }): ReactNode {
  const [opening, ...others] = paragraphs(block.text);
  const [first, more] = opening ? splitLead(opening) : [undefined, null];
  const rest = more ? [more, ...others] : others;
  const facts = block.facts ?? [];
  const portrait = hasImage(block.portrait) ? block.portrait : undefined;
  const values = facts.map((fact) => softJoints(fact.value, locale));
  const spans = factSpans(values) as (1 | 2)[];
  return (
    <div className="grid min-w-0 gap-6 @prose:gap-8">
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
                "max-w-prose text-title leading-normal font-medium text-pretty whitespace-pre-line text-creator-fg rtl:tracking-normal @prose:text-h3 @prose:leading-snug @work:text-h2 @prose:rtl:leading-normal",
                portrait && "@prose:col-span-2",
              )}
            >
              {first}
            </p>
          ) : null}
        </div>
      ) : null}
      {facts.length > 0 ? (
        <dl className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-creator-card border border-creator-line bg-creator-line">
          {facts.map((fact, index) => (
            // One shrinkable column (grid-cols-1), so a long value breaks inside its cell instead of widening it (WCAG 1.4.12 at 320 px).
            <div key={`${fact.label}-${fact.value}`} className={cn("grid min-w-0 grid-cols-1 content-start gap-1 bg-creator-surface p-4 @prose:px-5", FACT_SPAN[spans[index] ?? 1])}>
              <dt dir="auto" className={cn(pageSide, "text-small text-creator-fg-muted")}>
                {fact.label}
              </dt>
              <dd dir="auto" className={cn(pageSide, "text-body leading-snug font-semibold text-balance hyphens-manual break-words")}>
                {values[index]}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {rest.length > 0 ? (
        <div className="grid max-w-prose gap-4">
          {rest.map((part) => (
            <p key={part} dir="auto" className={cn(pageSide, "text-body text-pretty whitespace-pre-line text-creator-fg @prose:text-body-lg")}>
              {part}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A tile's columns on phones (of two) and from tablets on (of three). */
const PHONE_SPAN = { 1: "", 2: "col-span-2" } as const;
const WIDE_SPAN = { 1: "@prose:col-span-1", 2: "@prose:col-span-2", 3: "@prose:col-span-3" } as const;

/**
 * Skills and tools as a bento of flat tiles: two columns on phones, three from tablets on, the first
 * skill leading across when there are five or more. Every tile lies flat: the icon in a soft accent
 * square beside the label (body size, semibold), both centred in a row of one height (56 px, a little
 * more for a label of two lines), so a phone shows twelve skills in about 500 px. The icon comes from
 * the skill's own words by a curated map (laufbahn-content.ts; a neutral check where nothing fits). No
 * automatic hyphenation: German compounds break only at their joints, and a label that would not fit
 * beside its icon in two lines (or would have to break a word on a 360 px phone) takes the whole row;
 * the next half tile may move up past at most two such rows to share one (skillLayout). Hover gives a
 * stronger hairline and a step in the fill. No numbers.
 */
export function LaufbahnSkills({ block, locale, reveal }: { block: BlockOf<"tools">; locale: Profile["locale"]; reveal: boolean }): ReactNode {
  const labels = block.items.map((item) => softJoints(item, locale));
  const layout = skillLayout(labels);
  return (
    <ul className="grid min-w-0 grid-cols-2 gap-2 @prose:grid-cols-3 @prose:gap-3">
      {layout.order.map((index, place) => {
        const item = block.items[index] ?? "";
        return (
          <li
            key={item}
            className={cn(
              // The label sits beside the icon while its widest piece fits there (always from 360 px on: skillLayout);
              // on a narrower screen it wraps under the icon rather than break a word.
              "flex min-h-control-xl min-w-0 flex-wrap content-center items-center gap-x-3 gap-y-2 rounded-creator-card border border-creator-line bg-creator-surface py-2 ps-3 pe-2 @prose:pe-3",
              "transition-colors duration-micro hover:border-creator-line-strong hover:bg-creator-bg motion-reduce:transition-none",
              PHONE_SPAN[(layout.phone[place] ?? 1) as 1 | 2],
              WIDE_SPAN[(layout.wide[place] ?? 1) as 1 | 2 | 3],
              reveal && "lb-reveal",
            )}
          >
            <IconSquare icon={iconFor(item, locale) ?? CircleCheck} />
            <span dir="auto" className={cn(pageSide, "min-w-0 grow basis-[min-content] text-body leading-snug font-semibold text-balance hyphens-manual break-words rtl:leading-normal")}>
              {labels[index]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Experience as a vertical timeline in the order the owner entered it: an icon node per step (a
 * briefcase; a licence or a certificate when the role names one), the years in tabular figures
 * ("2021–heute" for a step still going on, its node filled), the role, where, and a note. The rail
 * between the nodes fills with the accent as the steps scroll by (drawn in full without scroll-driven
 * animations and with reduced motion). Logical sides: it mirrors in Arabic.
 */
export function LaufbahnTimeline({ block, locale, reveal }: { block: BlockOf<"timeline">; locale: Profile["locale"]; reveal: boolean }): ReactNode {
  const t = useTranslations("creator");
  return (
    <ol className="grid min-w-0 grid-cols-1">
      {block.items.map((item) => {
        const named = iconFor(item.role, locale);
        const icon = named && CREDENTIAL_ICONS.includes(named) ? named : Briefcase;
        const ongoing = item.years.to === "now";
        return (
          <li key={`${item.role}-${String(item.years.from)}-${item.org ?? ""}`} className={cn("lb-step grid min-w-0 justify-items-start gap-1 ps-12 pb-8 last:pb-0", reveal && "lb-reveal")}>
            <span
              aria-hidden
              className={cn(
                "absolute start-0 top-0 grid size-control-sm place-items-center rounded-full border",
                ongoing ? "border-creator-accent bg-creator-accent text-creator-accent-fg" : "border-creator-line-strong bg-creator-surface text-creator-accent-text",
              )}
            >
              <Icon icon={icon} size="sm" />
            </span>
            {/* One isolated run in the page's direction, so every range reads from its start, also in Arabic.
                As tall as the node, so the years stand level with its centre. */}
            <p className="flex min-h-control-sm items-center text-small font-semibold text-creator-accent-text tabular-nums">
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
        );
      })}
    </ol>
  );
}

/** A paragraph of a long read: body on phones, a size up from tablets on, the measure kept. */
const readingParagraph = cn(pageSide, "max-w-prose text-body whitespace-pre-line text-creator-fg @prose:text-body-lg");

/**
 * A text block in its paragraphs (a single line break stays one), set by its length:
 * - a short note (under 320 characters) is a callout: a flat tile with a hairline and an icon in a
 *   soft accent square, chosen from the section's title by the skills' map (a light bulb otherwise);
 * - a long read (a cover letter) is a reading tile under a quiet line with its reading time; over
 *   900 characters it opens on phones with its first two paragraphs and a native disclosure for the
 *   rest ("Read the whole letter", or "Read more" when it is not a letter), keyboard and screen
 *   readers included, no script; from the wide canvas on, and whenever the visitor arrives at the
 *   section by its address (the hero's "Read the letter", the index), it is whole;
 * - anything between is a lead of plain paragraphs.
 */
export function LaufbahnText({ text, title, letter, locale }: { text: string; title: string | null; letter: boolean; locale: Profile["locale"] }): ReactNode {
  const t = useTranslations("creator");
  const parts = paragraphs(text);
  const kind = textKind(text);
  if (kind === "note") {
    return (
      <div className="flex min-w-0 items-start gap-4 rounded-creator-card border border-creator-line bg-creator-surface p-5 @prose:gap-5 @prose:p-6">
        <IconSquare icon={(title ? iconFor(title, locale) : undefined) ?? Lightbulb} size="md" />
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
  return (
    <div className="grid min-w-0 gap-4 rounded-creator-card border border-creator-line bg-creator-surface p-5 @prose:gap-6 @prose:p-10">
      <p className="inline-flex items-center gap-2 text-small font-medium text-creator-fg-muted">
        <Icon icon={Clock} size="sm" className="shrink-0" />
        {t("laufbahn.readingTime", { minutes: readingMinutes(text) })}
      </p>
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
          <summary className="flex min-h-control-lg w-full cursor-pointer list-none items-center justify-center gap-2 rounded-creator-button border border-creator-line-strong px-4 text-body font-semibold text-creator-fg transition-[scale,background-color] duration-standard ease-standard select-none hover:bg-creator-bg focus-visible:focus-ring active:scale-pressed motion-reduce:transition-none motion-reduce:active:scale-none @prose:w-auto @prose:justify-self-start [&::-webkit-details-marker]:hidden">
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
