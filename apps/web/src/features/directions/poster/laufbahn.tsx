import type { BlockOf, Profile } from "@linkyo/blocks";
import { formatYears } from "@linkyo/blocks/project";
import { hasImage } from "@linkyo/blocks/rules";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, Briefcase, ChevronDown, CircleCheck, Clock, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { MediaImage, mediaSizes } from "../shared/creator-kit";
import { CREDENTIAL_ICONS, iconFor, opensShort, readingMinutes, splitLead, textKind } from "./laufbahn-content";
import { IndexList } from "./laufbahn-index";
import { textLink } from "./portfolio-sections";
import { linkDestination, paragraphs } from "./sections";
import { displayStyle, pageSide } from "./styles";

/**
 * Laufbahn (ADR 0069): pages for applications, CVs and personal profiles, set like a native app. Every
 * titled section opens under a hairline with its title, and the titles form the page's contents: on
 * phones the app bar names the section being read and opens the contents as a sheet; chips that wrap
 * on tablets; a sticky list beside the sections on the wide canvas, marking the section being read.
 * Facts and skills are calm lists on one soft sheet (a step in the fill, no frame and no rules), never
 * tiles that look like buttons, and no word is ever broken: a label too long for its row wraps between
 * words. Sections stand apart by space and their titles alone: no hairline above each one.
 *
 * The section frame takes every kind of block; about, skills, experience and text have their own
 * calm renderers here, everything else keeps the renderer it has in every template. Server HTML with
 * one small script (the index); motion is CSS (globals.css, `lb-*`), and the page is complete without it.
 *
 * One rhythm on phones: 48 between sections, 32 under a section's hairline, 24 between a title and
 * its content and between the parts of a content, 16 between paragraphs, 8 between tiles and cells.
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
 * The section index beside the sections. Tablets: chips that wrap in the reading column. The wide
 * canvas: a sticky list in the first three columns. Phones have none in the page: the app bar names
 * the section being read and opens the contents as a sheet (SectionSwitcher). Plain anchor links, so
 * the keyboard, the back button and a shared address all work without the script.
 */
export function SignpostIndex({ entries }: { entries: readonly Signpost[] }): ReactNode {
  const t = useTranslations("creator");
  return (
    <nav aria-label={t("laufbahn.index")} className="hidden min-w-0 @prose:block @work:col-span-3">
      <IndexList entries={entries.map(({ anchor, title }) => ({ anchor, title }))} className="flex flex-wrap gap-2 @work:sticky @work:top-24 @work:grid @work:gap-1" />
    </nav>
  );
}

/**
 * One section: the title, then the content; sections stand apart by space alone (no hairline, no
 * rule), as the screens of an app do, and nothing moves as they scroll in: the page scrolls, the
 * content stays still. An untitled run of blocks (before the first title, or the contact band) has no
 * heading.
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
  const content = "grid min-w-0 grid-cols-1 gap-6";
  if (!entry) {
    return (
      <div data-block-ids={blockIds} className={content}>
        {children}
      </div>
    );
  }
  return (
    <section id={entry.anchor} aria-labelledby={id} data-block-ids={blockIds} className="lb-section grid min-w-0 grid-cols-1 gap-5 @prose:gap-6">
      <h2
        id={id}
        dir="auto"
        className={cn(pageSide, "min-w-0 font-creator-display text-h2 leading-tight text-balance break-words @work:text-h1 rtl:leading-snug")}
        style={displayStyle}
        {...(ai ? { "data-ai-generated": "true" } : {})}
      >
        {entry.title}
      </h2>
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

/**
 * Who the owner is: the first paragraph as a lead (calm on phones, larger from tablets on; a long one
 * leads with its first sentence, so the lead stays within about five lines on a phone, and the rest of
 * it opens the body), the facts as a grouped list, then the rest of the text as body. A portrait, when
 * there is one, stands at the start of the lead.
 */
export function LaufbahnAbout({ block }: { block: BlockOf<"about"> }): ReactNode {
  const [opening, ...others] = paragraphs(block.text);
  const [first, more] = opening ? splitLead(opening) : [undefined, null];
  const rest = more ? [more, ...others] : others;
  const facts = block.facts ?? [];
  const portrait = hasImage(block.portrait) ? block.portrait : undefined;
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
        // One soft sheet (a step in the fill, no frame, no rules): one fact a row on phones (the label
        // above its value), two a row from tablets on, space between. Words stay whole: a value wraps
        // between words, and only a word wider than the whole row (320 px, 400 % zoom) may break (WCAG 1.4.10).
        <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 rounded-creator-card bg-creator-surface p-4 @prose:grid-cols-2 @prose:gap-y-5 @prose:p-6">
          {facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`} className="grid min-w-0 grid-cols-1 content-start gap-1">
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

/**
 * Skills and tools as a list on one soft sheet (a step in the fill, no frame and no rules between the
 * rows): one skill a row on phones, two a row from tablets on. Each row is the skill's icon in the
 * accent (from the skill's own words by a curated map, laufbahn-content.ts; a neutral check where
 * nothing fits) and its label, whole: no automatic hyphenation and no breaks inside words, a long label
 * wraps between words. Nothing about a row says "press me" (no frame of its own, no hover), because
 * nothing happens on a press. No numbers, and nothing moves as it scrolls in.
 */
export function LaufbahnSkills({ block, locale }: { block: BlockOf<"tools">; locale: Profile["locale"] }): ReactNode {
  return (
    <ul className="grid min-w-0 grid-cols-1 gap-x-6 rounded-creator-card bg-creator-surface px-4 py-2 @prose:grid-cols-2 @prose:px-6 @prose:py-3">
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

/**
 * Experience as a vertical timeline in the order the owner entered it: an icon node per step (a
 * briefcase; a licence or a certificate when the role names one), the years in tabular figures
 * ("2021–heute" for a step still going on, its node filled), the role, where, and a note. The rail
 * between the nodes fills with the accent as the steps scroll by (drawn in full without scroll-driven
 * animations and with reduced motion). Logical sides: it mirrors in Arabic.
 */
export function LaufbahnTimeline({ block, locale }: { block: BlockOf<"timeline">; locale: Profile["locale"] }): ReactNode {
  const t = useTranslations("creator");
  return (
    <ol className="grid min-w-0 grid-cols-1">
      {block.items.map((item) => {
        const named = iconFor(item.role, locale);
        const icon = named && CREDENTIAL_ICONS.includes(named) ? named : Briefcase;
        const ongoing = item.years.to === "now";
        return (
          <li key={`${item.role}-${String(item.years.from)}-${item.org ?? ""}`} className="lb-step grid min-w-0 justify-items-start gap-1 ps-12 pb-8 last:pb-0">
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
 * - a short note (under 320 characters) is a callout: a soft tile (a step in the fill, no frame) with
 *   an icon in a soft accent square, chosen from the section's title by the skills' map (a light bulb
 *   otherwise);
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
      <div className="flex min-w-0 items-start gap-4 rounded-creator-card bg-creator-surface p-5 @prose:gap-5 @prose:p-6">
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
    <div className="grid min-w-0 gap-4 rounded-creator-card bg-creator-surface p-5 @prose:gap-6 @prose:p-10">
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
