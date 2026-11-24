import type { BlockOf, ContactKind, LinkIcon, Profile } from "@linkyo/blocks";
import { contactStatus, formatYears, linkLabelKey, projectTarget } from "@linkyo/blocks/project";
import { hasImage } from "@linkyo/blocks/rules";
import { tokens } from "@linkyo/tokens";
import { cn, Icon } from "@linkyo/ui";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { MediaImage, mediaSizes } from "../shared/creator-kit";
import { LinkIconGlyph } from "../shared/link-icons";
import { linkDestination, paragraphs } from "./sections";
import { displayStyle, pageSide, pressable } from "./styles";

/**
 * The portfolio's sections beside the work: about, skills and tools, experience, quotes, clients as
 * names, and the contact band that closes the page.
 *
 * All of it is plain server HTML: lists, a definition list, figures, links. No form, no embed, no
 * script. Text sits on the page or on a fill step, never on a picture. Layouts for the wide canvas
 * (`@work:`) apply only when the page says it is wide: templates with the narrow column keep the
 * phone layout at every width.
 */

/** A text link on a creator page: colour and weight, never a line under it. */
export const textLink = "rounded-xs font-semibold text-creator-accent-text transition-colors duration-micro hover:text-creator-fg focus-visible:focus-ring";

/**
 * `sizes` of the about portrait, from the layout tokens: about a third of the column, and a third of
 * the wide canvas from the width at which a page has one.
 */
const portraitSizes = (wide: boolean): string =>
  wide ? `(min-width: ${String(tokens.layout.work)}px) ${String(Math.round(tokens.layout.work / 3))}px, ${mediaSizes.third}` : mediaSizes.third;

/**
 * Who the owner is: a lead paragraph, a portrait beside up to four facts, then the rest of the text.
 * The lead is set in the display face where the template's face suits running text (`lead`), in the
 * body face otherwise. Wide canvas: the portrait takes the start columns, the words the rest; without
 * a portrait the words take the first eight columns and the facts stand beside them in the last four,
 * one under the other (P-09), so the section spans the canvas.
 */
export function AboutSection({ block, wide, lead = "body" }: { block: BlockOf<"about">; wide: boolean; lead?: "display" | "body" | undefined }): ReactNode {
  const [first, ...rest] = paragraphs(block.text);
  const portrait = hasImage(block.portrait) ? block.portrait : undefined;
  const facts = block.facts ?? [];
  // Beside a portrait the words keep to the end columns; without one they take eight columns.
  const words = wide ? (portrait ? "@work:col-span-6 @work:col-start-6" : "@work:col-span-8") : undefined;
  // Without a portrait the facts stand in the last four columns, beside the words.
  const factsBeside = wide && !portrait ? "@work:col-span-4 @work:col-start-9 @work:row-span-2 @work:row-start-1 @work:grid-cols-1" : words;
  return (
    // Wide, beside a portrait: the words keep their own height and the last row takes what the portrait leaves over.
    <div className={cn("grid grid-cols-5 gap-x-4 gap-y-6", wide && "@work:grid-cols-12 @work:gap-x-6", wide && portrait && "@work:grid-rows-[auto_auto_1fr]")}>
      {first ? (
        <p
          dir="auto"
          className={cn(pageSide, "col-span-5 whitespace-pre-line text-creator-fg", lead === "display" ? "font-creator-display text-h3 leading-snug text-pretty" : "text-body-lg", words)}
          style={lead === "display" ? displayStyle : undefined}
        >
          {first}
        </p>
      ) : null}
      {portrait ? (
        <div className={cn("relative col-span-2 aspect-portrait self-start overflow-hidden rounded-creator-card bg-creator-surface-2", wide && "@work:col-span-4 @work:col-start-1 @work:row-span-3 @work:row-start-1")}>
          <MediaImage src={portrait.src} focal={portrait.focal} alt={portrait.alt} sizes={portraitSizes(wide)} />
        </div>
      ) : null}
      {facts.length > 0 ? (
        <dl className={cn("grid content-start gap-x-4", portrait ? "col-span-3 grid-cols-1 @prose:grid-cols-2" : "col-span-5 grid-cols-2", factsBeside)}>
          {facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`} className="grid min-w-0 content-start gap-0.5 border-t border-creator-line py-3">
              <dt dir="auto" className={cn(pageSide, "text-caption text-creator-fg-muted")}>{fact.label}</dt>
              <dd dir="auto" className={cn(pageSide, "text-small font-semibold break-words")}>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {rest.length > 0 ? (
        <div className={cn("col-span-5 grid max-w-prose gap-4", words)}>
          {rest.map((part) => (
            <p key={part} dir="auto" className={cn(pageSide, "text-body whitespace-pre-line text-creator-fg")}>
              {part}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Skills and tools as plain chips: no levels, no logos, no links. */
export function ToolsSection({ block }: { block: BlockOf<"tools"> }): ReactNode {
  return (
    <ul className="flex flex-wrap gap-2">
      {block.items.map((item) => (
        <li key={item} className="inline-flex h-control-sm max-w-full items-center rounded-creator-button border border-creator-line px-3 text-small">
          <span dir="auto" className="truncate">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Experience: roles and years in the order the owner entered them. Hairlines between the rows are
 * all the drawing there is: no line with dots, so nothing has to mirror in Arabic.
 */
export function TimelineSection({ block, locale }: { block: BlockOf<"timeline">; locale: Profile["locale"] }): ReactNode {
  const t = useTranslations("creator");
  return (
    <ol className="grid grid-cols-1">
      {block.items.map((item) => (
        <li key={`${item.role}-${String(item.years.from)}-${item.org ?? ""}`} className="grid grid-cols-1 gap-x-6 gap-y-1 border-t border-creator-line py-4 first:border-t-0 first:pt-0 last:pb-0 @prose:grid-cols-4">
          {/* One isolated run in the page's direction, so every range reads from its start: "2015–2021" and "2021–now" alike, also in Arabic. */}
          <p className="text-small text-creator-fg-muted tabular-nums @prose:pt-0.5">
            <bdi dir={locale === "ar" ? "rtl" : "ltr"}>{formatYears(item.years, t("portfolio.untilNow"))}</bdi>
          </p>
          <div className="grid min-w-0 justify-items-start gap-0.5 @prose:col-span-3">
            <p dir="auto" className={cn(pageSide, "text-title font-semibold")}>{item.role}</p>
            {item.org ? (
              item.url ? (
                <a href={item.url} className={cn("inline-flex min-h-touch-target max-w-full items-center gap-1", textLink)}>
                  <span dir="auto" className="truncate">{item.org}</span>
                  <Icon icon={ArrowUpRight} size="sm" className="shrink-0" />
                </a>
              ) : (
                <p dir="auto" className={cn(pageSide, "text-body text-creator-fg-muted")}>{item.org}</p>
              )
            ) : item.url ? (
              // An address without an organisation still leads somewhere: its host is the link text.
              <a href={item.url} className={cn("inline-flex min-h-touch-target max-w-full items-center gap-1", textLink)}>
                <bdi dir="ltr" className="truncate">{linkDestination(item.url)}</bdi>
                <Icon icon={ArrowUpRight} size="sm" className="shrink-0" />
              </a>
            ) : null}
            {item.note ? <p dir="auto" className={cn(pageSide, "text-small text-creator-fg-muted")}>{item.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

type Quote = BlockOf<"quotes">["items"][number];

/**
 * Quotation marks come from the page's language through CSS, not from what the owner typed:
 * „…“ in German, “…” in English, «…» in Arabic.
 */
const quoteMarks = "[quotes:'“'_'”'] before:content-[open-quote] after:content-[close-quote] [&:lang(ar)]:[quotes:'«'_'»'] [&:lang(de)]:[quotes:'„'_'“']";

/** How many quotes show at once; further ones wait behind "More quotes". */
const QUOTES_SHOWN = 3;

function QuoteFigure({ item, alone, wide, project }: { item: Quote; alone: boolean; wide: boolean; project: { title: string; href: string } | undefined }) {
  const t = useTranslations("creator");
  return (
    <figure className={cn("grid content-start justify-items-start gap-4", !alone && "rounded-creator-card bg-creator-surface-2 p-6")}>
      <blockquote>
        <p
          dir="auto"
          className={cn(pageSide, quoteMarks, "break-words", alone ? cn("font-creator-display text-h2 leading-tight text-pretty", wide && "@work:text-h1") : "text-body-lg")}
          style={alone ? displayStyle : undefined}
        >
          {item.text}
        </p>
      </blockquote>
      {/* A figure's caption is its first or last child, so the project link sits inside it. */}
      <figcaption className="grid min-w-0 justify-items-start gap-3">
        <span className="flex min-w-0 items-center gap-3">
          {hasImage(item.photo) ? (
            <span className="relative size-avatar-md shrink-0 overflow-hidden rounded-full bg-creator-surface-2">
              {/* The name stands beside the picture. */}
              <MediaImage src={item.photo.src} focal={item.photo.focal} alt="" sizes={mediaSizes.thumb} />
            </span>
          ) : null}
          <span className="grid min-w-0 gap-0.5">
            <span dir="auto" className={cn(pageSide, "text-small font-semibold")}>{item.name}</span>
            <span dir="auto" className={cn(pageSide, "text-small text-creator-fg-muted")}>{item.role}</span>
          </span>
        </span>
        {project ? (
          <a href={project.href} className={cn("inline-flex min-h-touch-target items-center gap-1 text-small", textLink)}>
            <span>
              {t("portfolio.seeProject")}
              <span className="sr-only">
                {": "}
                <bdi>{project.title}</bdi>
              </span>
            </span>
            <Icon icon={ArrowRight} size="sm" className="shrink-0" />
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}

/**
 * Quotes the owner chose and may publish. `projects` are the page's projects: a quote about one of
 * them links to it (where project pages have an address). One quote alone is set large; several sit
 * on fill steps, three at a time, the rest behind "More quotes". Always ends with the line that
 * says who chose them.
 */
export function QuotesSection({
  block,
  ownerName,
  projects,
  base,
  suffix = "",
  wide,
}: {
  block: BlockOf<"quotes">;
  ownerName: string;
  projects: BlockOf<"project">[];
  base?: string | undefined;
  /** Appended to every project address (the sample route's query). */
  suffix?: string | undefined;
  wide: boolean;
}): ReactNode {
  const t = useTranslations("creator");
  const alone = block.items.length === 1;
  const shown = block.items.slice(0, QUOTES_SHOWN);
  const more = block.items.slice(QUOTES_SHOWN);
  const figure = (item: Quote, index: number) => {
    const about = item.project ? projects.find((project) => project.id === item.project) : undefined;
    // A quote about a project gives that project a page of its own, so the target is always that page.
    const target = about && base !== undefined ? projectTarget(about, base, [block], suffix) : undefined;
    return <QuoteFigure key={`${item.name}-${String(index)}`} item={item} alone={alone} wide={wide} project={about && target?.kind === "page" ? { title: about.title, href: target.href } : undefined} />;
  };
  const columns = (count: number) => cn("grid grid-cols-1 gap-4", wide && count === 2 && "@work:grid-cols-2", wide && count >= 3 && "@work:grid-cols-3");
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className={columns(shown.length)}>{shown.map(figure)}</div>
      {more.length > 0 ? (
        <details className="group">
          <summary className={cn("flex min-h-touch-target w-fit cursor-pointer list-none items-center gap-2 text-small [&::-webkit-details-marker]:hidden", textLink)}>
            {t("portfolio.moreQuotes")}
            <Icon icon={ChevronDown} size="sm" className="transition-transform duration-micro group-open:-scale-y-100 motion-reduce:transition-none" />
          </summary>
          <div className={cn(columns(more.length), "pt-2")}>{more.map((item, index) => figure(item, QUOTES_SHOWN + index))}</div>
        </details>
      ) : null}
      <p className="text-caption text-creator-fg-muted">{t("portfolio.quotesNote", { name: ownerName })}</p>
    </div>
  );
}

const CONTACT_ICONS: Record<ContactKind, LinkIcon> = { email: "mail", phone: "phone", whatsapp: "chat", calendar: "calendar", cv: "file", link: "link" };

/** Does the address lead to a PDF? Then the CV link says so. */
function isPdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/**
 * The closing band: the owner's line, the status, the page's one primary action and other ways to
 * reach them, then what happens after the first message. Plain links only: no form, no embedded
 * calendar. E-mail addresses, phone numbers and hosts always run left to right.
 */
export function ContactBand({ block, now, wide }: { block: BlockOf<"contact">; now: Date; wide: boolean }): ReactNode {
  const t = useTranslations("creator");
  const id = useId();
  const status = contactStatus(block, now);
  const links = block.links ?? [];
  const steps = block.steps ?? [];
  const label = (link: (typeof links)[number]): string => {
    if (link.label?.trim()) return link.label;
    switch (link.kind) {
      case "email":
        return t("portfolio.contactEmail");
      case "phone":
        return t("portfolio.contactPhone");
      case "whatsapp":
        return t("portfolio.contactWhatsapp");
      case "calendar":
        return t("portfolio.contactCalendar");
      case "cv":
        return t(isPdf(link.url) ? "portfolio.cvPdf" : "portfolio.cv");
      case "link":
        return t(`portfolio.${linkLabelKey(link.url)}`);
    }
  };
  return (
    <section aria-labelledby={id} className={cn("grid grid-cols-1 justify-items-start gap-6 rounded-creator-card bg-creator-surface-2 p-6 @prose:p-10", wide && "@work:p-12")}>
      <div className="grid max-w-prose gap-3">
        <h2 id={id} dir="auto" className={cn(pageSide, "font-creator-display text-h1 leading-tight text-balance break-words", wide && "@work:text-display-sm")} style={displayStyle}>
          {block.title}
        </h2>
        {block.text ? <p dir="auto" className={cn(pageSide, "text-body-lg text-creator-fg-muted")}>{block.text}</p> : null}
      </div>
      {/* Title, text, then the status (plan 1.4.9): whoever lands on the heading still meets it. */}
      {status ? (
        <p className="flex items-center gap-2 text-small">
          {/* The text carries the meaning; the dot only marks the line. */}
          <span aria-hidden className="size-dot shrink-0 rounded-full bg-creator-accent" />
          <span dir="auto">{status}</span>
        </p>
      ) : null}
      <a href={block.primary.url} className={cn("inline-flex min-h-control-xl w-full min-w-0 items-center justify-center gap-2 rounded-creator-button bg-creator-accent px-6 py-3 text-center text-body font-semibold text-creator-accent-fg @prose:w-auto", pressable)}>
        {block.primary.icon ? <LinkIconGlyph icon={block.primary.icon} size="sm" className="shrink-0" /> : null}
        {/* The page's one primary action is never cut: a long label wraps. */}
        <span dir="auto" className="min-w-0 text-balance break-words">{block.primary.label}</span>
      </a>
      {links.length > 0 ? (
        <ul className="grid w-full grid-cols-1 gap-x-8 @prose:flex @prose:flex-wrap">
          {links.map((link) => {
            // WhatsApp's address says nothing a visitor needs; the others show where they lead. A long
            // address wraps under its label (and breaks inside itself only when it alone is too wide):
            // an e-mail address cut off with "…" cannot be read.
            const address = link.kind === "whatsapp" ? "" : linkDestination(link.url);
            return (
              <li key={`${link.kind}-${link.url}`} className="min-w-0">
                <a href={link.url} className={cn("inline-flex min-h-touch-target max-w-full flex-wrap items-center gap-x-2 text-small", textLink)}>
                  <LinkIconGlyph icon={CONTACT_ICONS[link.kind]} size="sm" className="shrink-0" />
                  <span dir="auto" className="shrink-0">{label(link)}</span>
                  {address ? (
                    <bdi dir="ltr" className="min-w-0 font-regular break-all text-creator-fg-muted">
                      {address}
                    </bdi>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
      {steps.length > 0 ? (
        <div className="grid w-full gap-3">
          <h3 className="text-small font-semibold text-creator-fg-muted">{t("portfolio.steps")}</h3>
          <ol className={cn("grid grid-cols-1 gap-x-6 gap-y-3", wide && "@work:grid-cols-3")}>
            {steps.map((step, index) => (
              <li key={step} className="grid content-start gap-1 border-t border-creator-line-strong pt-3">
                {/* The list itself counts; the figure is its look. */}
                <span aria-hidden className="text-caption font-semibold text-creator-accent-text tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span dir="auto" className={cn(pageSide, "text-body")}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

/** Text that finds its own direction without turning its box around (borders and padding keep the page's sides). */
const ownDirection = "[unicode-bidi:plaintext]";

/**
 * Clients without any logo: their names in the display face, flowing like a line of text, a
 * hairline between neighbours. A name with an address stays a link, marked by its colour.
 */
export function BrandNames({ block }: { block: BlockOf<"brands"> }): ReactNode {
  return (
    // The list is pulled one gap towards the start and clipped there, so the hairline before the
    // first name of every line is cut off: hairlines only stand between names.
    <div className="-mx-1 overflow-x-clip px-1">
      <ul className="-ms-5 flex flex-wrap gap-y-1">
        {block.items.map((item) => (
          // The hairline stays on the page's start side whatever the name's script; the name itself
          // runs in its own direction (a Latin name on an Arabic page keeps its punctuation in place).
          <li key={item.name} className={cn("min-w-0 border-s border-creator-line px-5 py-2 font-creator-display text-h3 leading-tight break-words", ownDirection)} style={displayStyle}>
            {item.url ? (
              // The link is a full 44 px target (the spacing scale has no 10 px step to reach it by
              // padding alone); the row's own padding is pulled back, so the row grows by 4 px at most.
              <a href={item.url} className={cn("-my-2 inline-flex min-h-touch-target items-center rounded-xs text-creator-accent-text transition-colors duration-micro hover:text-creator-fg focus-visible:focus-ring", ownDirection)}>
                {item.name}
              </a>
            ) : (
              item.name
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
