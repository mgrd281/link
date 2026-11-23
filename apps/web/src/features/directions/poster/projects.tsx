import type { BlockOf, Profile } from "@linkyo/blocks";
import {
  bentoRows,
  chooseProjectsLayout,
  coverImage,
  coverMode,
  figureSize,
  formatYears,
  nearestRatio,
  pictureRatio,
  projectTarget,
  type CoverRatio,
  type ProjectTarget,
} from "@linkyo/blocks/project";
import { FEATURED_PROJECTS } from "@linkyo/blocks/rules";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, Scale, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { MediaImage, mediaSizes, useCreatorFormat } from "../shared/creator-kit";
import { linkDestination } from "./sections";
import { displayStyle, pageSide, pressable, railFrame, railTrack } from "./styles";

type Project = BlockOf<"project">;
type Quotes = BlockOf<"quotes">;

/** "01", "02" …: Latin digits in every language, as wide as each other. */
export const projectNumber = (position: number): string => String(position).padStart(2, "0");

/** The aspect utility of each cover ratio (`nearestRatio`). */
export const RATIO_CLASS: Record<CoverRatio, string> = { portrait: "aspect-portrait", square: "aspect-square", photo: "aspect-photo", video: "aspect-video" };

/**
 * A run of consecutive projects, laid out by `chooseProjectsLayout`: a grid with one large tile
 * (bento), a numbered list, or a row to swipe (rail). A run shows its first six projects; the rest
 * wait in a native `<details>` below, as plain rows.
 *
 * `blocks` is always the whole run. With `leadTaken` the hero already shows its first project (the
 * plate of Werkbogen): the run starts at its second project, numbered 02, and the six count the plate.
 *
 * Every card prints its title, its sentence and role and year; nothing is shown on hover only, and
 * no text sits on a picture. A card leads to the project's page, or to the project's own link when
 * there is nothing more to read, or nowhere. A card is `id="<slug>"`, so the way back from a project
 * lands on the card the visitor came from.
 */
export function ProjectsGroup({
  blocks,
  groupIndex,
  leadTaken,
  theme,
  locale,
  quotes,
  base,
  suffix = "",
  onOpen,
  numbered,
}: {
  blocks: BlockOf<"project">[];
  /** Position of this run among the page's runs of projects (a later run may become a row). */
  groupIndex: number;
  /** The hero already shows the first project (Werkbogen's plate): the grid has no lead tile. */
  leadTaken: boolean;
  theme: ResolvedCreatorTheme;
  locale: Profile["locale"];
  /** The page's quotes: a quote about a project gives it a page of its own. */
  quotes: BlockOf<"quotes">[];
  /** Where project pages live. Absent in previews. */
  base?: string | undefined;
  /** Appended to every project address. */
  suffix?: string | undefined;
  /** Previews without a router: a tap on a card that has a project page. */
  onOpen?: ((id: string) => void) | undefined;
  /** Cards carry their number ("01"). */
  numbered: boolean;
}): ReactNode {
  const t = useTranslations("creator");
  const layout = chooseProjectsLayout(blocks, groupIndex, theme.layout.projects);
  const wide = theme.layout.canvas === "wide";
  // The bold look sets its list very large and its tiles in the body face.
  const loud = theme.layout.headings === "headline";
  const entries: Entry[] = blocks.map((project, index) => ({ project, position: index + 1, target: targetOf(project, quotes, base, suffix, onOpen) }));
  const shown = entries.slice(leadTaken ? 1 : 0, FEATURED_PROJECTS);
  const rest = entries.slice(FEATURED_PROJECTS);
  const shared = { numbered, loud, wide, locale, onOpen };
  if (shown.length === 0 && rest.length === 0) return null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      {shown.length === 0 ? null : layout === "bento" ? (
        // One list that is one grid: every tile is a direct child, in page order (no `order`, no dense flow).
        <div role="list" className={cn("grid grid-cols-2 gap-x-3 gap-y-8", wide && "@prose:gap-x-4 @prose:gap-y-10 @work:grid-cols-6 @work:gap-x-6 @work:gap-y-12")}>
          {bentoTiles(shown, leadTaken).map(({ entry, ...tile }) => (
            <Tile key={entry.project.id} entry={entry} {...tile} {...shared} />
          ))}
        </div>
      ) : layout === "rail" ? (
        // Like every row to swipe on the page: the region scrolls and takes focus, cards snap.
        <div role="region" aria-label={t("scroller", { title: t("portfolio.work") })} tabIndex={0} className={railFrame}>
          <ol
            className={cn(
              "grid grid-flow-col auto-cols-[80%] gap-3 pt-1",
              wide ? "@prose:auto-cols-[40%] @prose:gap-4 @work:auto-cols-[calc((100%-2*var(--spacing-6))/3)] @work:gap-6" : "@prose:auto-cols-[40%]",
              railTrack,
            )}
          >
            {shown.map((entry) => (
              <li key={entry.project.id} id={entry.project.slug} className="grid min-w-0 snap-start scroll-mt-16">
                <Card entry={entry} cover={{ phone: "aspect-portrait", wide: null, sizes: wide ? mediaSizes.workRail : mediaSizes.rail }} lead={false} {...shared} />
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <ol start={shown[0]?.position} className="border-t border-creator-line">
          {shown.map((entry) => (
            <Row key={entry.project.id} entry={entry} compact={false} {...shared} />
          ))}
        </ol>
      )}
      {rest.length > 0 ? (
        // More than six: the others open in place, without script.
        <details className="group/more">
          <summary className="inline-flex min-h-touch-target cursor-pointer list-none items-center gap-2 rounded-xs text-small font-semibold text-creator-accent-text transition-colors duration-micro hover:text-creator-fg focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
            {t("portfolio.allProjects", { count: blocks.length })}
            <Icon icon={ChevronDown} size="sm" className="transition-transform duration-standard ease-standard group-open/more:rotate-180 motion-reduce:transition-none" />
          </summary>
          <ol start={rest[0]?.position} className="mt-2 border-t border-creator-line">
            {rest.map((entry) => (
              <Row key={entry.project.id} entry={entry} compact {...shared} />
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

/**
 * The cover area of a project card, by `coverMode`: the picture cropped around its focal point (the
 * card's title stands beside it, so it has no description here), the first result figure set large,
 * or the title set large. Never a placeholder. A thumbnail (`size: "thumb"`) only exists for a
 * picture and for a figure of up to four characters; otherwise it is nothing.
 */
export function ProjectCover({
  project,
  sizes,
  ratio,
  priority = false,
  size,
}: {
  project: BlockOf<"project">;
  /** The `sizes` attribute of the picture (an entry of `mediaSizes`). */
  sizes: string;
  /** The aspect utility of the cover box ("aspect-photo"). */
  ratio: string;
  priority?: boolean | undefined;
  size: "lead" | "tile" | "thumb";
}): ReactNode {
  return <Cover project={project} sizes={sizes} ratio={ratio} priority={priority} size={size} heading={false} loud={false} />;
}

/** The plate's ratio from the wide canvas on: any of the four. */
const PLATE_WIDE: Record<CoverRatio, string> = { portrait: "@work:aspect-portrait", square: "@work:aspect-square", photo: "@work:aspect-photo", video: "@work:aspect-video" };

/** The frame of a hero plate: edge to edge on phones (no radius), the card's corners from the column on. */
export const plateFrame = "relative -mx-creator-gutter overflow-hidden bg-creator-surface-2 @prose:mx-0 @prose:rounded-creator-card";

/**
 * The ratio of a hero plate. Phones choose between 3:2 and a square only (an upright picture is
 * cropped to a square around its focal point; its own page shows it whole), so the sentence and the
 * button follow within one screen. The wide canvas takes the nearest of all four ratios.
 */
export function plateRatio(image: { w?: number | undefined; h?: number | undefined }, wide: boolean): string {
  const nearest = nearestRatio(image.w, image.h);
  return cn(nearest === "portrait" || nearest === "square" ? "aspect-square" : "aspect-photo", wide && PLATE_WIDE[nearest]);
}

/**
 * The hero plate of Werkbogen: the first project's cover, large, as the link to that project. Its
 * caption sits under it (number 01, title, role and year, an arrow). The link is named "Project 1
 * of N: title", so someone who moves by links meets it as the first project. The page's one
 * preloaded picture.
 */
export function ProjectPlate({
  project,
  total,
  theme,
  locale,
  quotes,
  base,
  suffix = "",
  onOpen,
  priority,
}: {
  project: BlockOf<"project">;
  /** All projects of the run this project opens, the plate's own included. */
  total: number;
  theme: ResolvedCreatorTheme;
  locale: Profile["locale"];
  quotes: BlockOf<"quotes">[];
  base?: string | undefined;
  suffix?: string | undefined;
  onOpen?: ((id: string) => void) | undefined;
  priority: boolean;
}): ReactNode {
  const t = useTranslations("creator");
  const picture = coverImage(project);
  if (!picture) return null;
  const wide = theme.layout.canvas === "wide";
  const entry: Entry = { project, position: 1, target: targetOf(project, quotes, base, suffix, onOpen) };
  const name = t("portfolio.plateLink", { total, title: project.title });
  const linked = entry.target.kind === "page" || entry.target.kind === "link";
  return (
    <div id={project.slug} className="grid min-w-0 scroll-mt-16">
      <Shell entry={entry} onOpen={onOpen} label={name} className="grid min-w-0 grid-cols-1 gap-3 @work:gap-4">
        {/* The link's name begins with these words; they hold the title, so the title below is not read twice. */}
        {linked ? <span className="sr-only">{name}</span> : null}
        <div data-plate className={cn(plateFrame, plateRatio(picture, wide))}>
          <MediaImage src={picture.src} focal={picture.focal} alt="" sizes={wide ? mediaSizes.workPlate : mediaSizes.column} priority={priority} />
        </div>
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="pt-1 text-caption font-semibold text-creator-accent-text tabular-nums">
            {projectNumber(1)}
          </span>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-1">
            <p dir="auto" aria-hidden={linked} className={cn(pageSide, TITLE, "font-creator-display text-h3 leading-tight rtl:leading-snug")} style={displayStyle}>
              {project.title}
            </p>
            <Meta entry={entry} locale={locale} />
          </div>
          <TargetArrow target={entry.target} className="mt-1" />
        </div>
      </Shell>
    </div>
  );
}

// ─── Parts ────────────────────────────────────────────────────────────────────────────────────

interface Entry {
  project: Project;
  /** Position in the run, from 1: the card's number. */
  position: number;
  target: CardTarget;
}

/** Where a card leads on this page: a link, a button of a preview, or nowhere. */
type CardTarget = { kind: "page"; href: string } | { kind: "open"; id: string } | { kind: "link"; href: string } | { kind: "none" };

function targetOf(project: Project, quotes: readonly Quotes[], base: string | undefined, suffix: string, onOpen: ((id: string) => void) | undefined): CardTarget {
  const target: ProjectTarget = projectTarget(project, base ?? "", quotes, suffix);
  if (target.kind !== "page") return target;
  // A project page needs a place to live: an address, or a preview that opens it in place.
  if (base !== undefined) return target;
  return onOpen ? { kind: "open", id: project.id } : { kind: "none" };
}

interface Shared {
  numbered: boolean;
  loud: boolean;
  wide: boolean;
  locale: Profile["locale"];
  onOpen: ((id: string) => void) | undefined;
}

/**
 * The card itself: one link around everything it shows; in a preview without addresses a button
 * laid over the card (a button cannot hold a heading); or a plain box that takes no focus.
 * A link is named by what it shows (so what a visitor reads is what a voice command can say);
 * `label` names the button of a preview, which shows nothing itself.
 */
function Shell({ entry, onOpen, className, label, children }: { entry: Entry; onOpen: Shared["onOpen"]; className: string; label?: string | undefined; children: ReactNode }) {
  const { target, project } = entry;
  if (target.kind === "page" || target.kind === "link") {
    return (
      <a href={target.href} className={cn(className, "rounded-creator-card", pressable)}>
        {children}
      </a>
    );
  }
  if (target.kind === "open" && onOpen) {
    return (
      <div className={cn(className, "relative")}>
        {children}
        <button type="button" aria-label={label ?? project.title} onClick={() => onOpen(target.id)} className={cn("absolute! inset-0 rounded-creator-card", pressable)} />
      </div>
    );
  }
  return <div className={className}>{children}</div>;
}

/** The arrow that says where a card leads: on to the project's page, or out to its own link. */
function TargetArrow({ target, className }: { target: CardTarget; className?: string }) {
  if (target.kind === "none") return null;
  if (target.kind === "link") return <Icon icon={ArrowUpRight} size="sm" className={cn("shrink-0 text-creator-fg-muted rtl:-scale-x-100", className)} />;
  return <Icon icon={ArrowRight} size="sm" className={cn("shrink-0 text-creator-fg-muted rtl:-scale-x-100", className)} />;
}

/**
 * Role and year, the repository's facts when the project has them (as the repository card prints
 * them), and the host a card opens when it leaves the page.
 */
function Meta({ entry, locale, className }: { entry: Entry; locale: Profile["locale"]; className?: string }) {
  const t = useTranslations("creator");
  const f = useCreatorFormat(locale);
  const { project, target } = entry;
  // `whole`: a short fact with an icon, which never breaks inside.
  const parts: { node: ReactNode; whole: boolean }[] = [];
  const add = (node: ReactNode, whole = false) => parts.push({ node, whole });
  if (project.role) add(<span dir="auto">{project.role}</span>);
  // A range of years is one figure: it never breaks at its dash.
  if (project.year) add(<bdi className="whitespace-nowrap tabular-nums">{formatYears(project.year, t("portfolio.untilNow"))}</bdi>);
  if (project.source?.stars !== undefined) {
    add(
      <span className="inline-flex items-center gap-1 align-bottom">
        <Icon icon={Star} size="sm" />
        <span aria-hidden className="font-semibold text-creator-fg">
          {f.compact(project.source.stars)}
        </span>
        <span className="sr-only">{t("stars", { count: project.source.stars })}</span>
      </span>,
      true,
    );
  }
  if (project.source?.language) {
    add(
      <span className="inline-flex items-center gap-1 align-bottom">
        <span aria-hidden className="size-dot rounded-full bg-creator-accent" />
        {project.source.language}
      </span>,
      true,
    );
  }
  if (project.source?.license) {
    add(
      <span className="inline-flex items-center gap-1 align-bottom">
        <Icon icon={Scale} size="sm" />
        <span className="sr-only">{t("portfolio.license", { license: project.source.license })}</span>
        <span aria-hidden>{project.source.license}</span>
      </span>,
      true,
    );
  }
  // Hosts read left to right, also on Arabic pages.
  if (target.kind === "link") add(<bdi dir="ltr">{linkDestination(target.href)}</bdi>);
  if (parts.length === 0) return null;
  return (
    // Running text, so a long line wraps like one; a dot never starts a line (it hangs on the part before it).
    <p className={cn("min-w-0 text-small break-words text-creator-fg-muted", className)}>
      {parts.map(({ node, whole }, index) => (
        // The parts of one project never change order: their position is their key.
        <span key={index}>
          {/* A fact with its icon stays on one line, together with the dot after it. */}
          <span className={whole ? "whitespace-nowrap" : undefined}>
            {node}
            {index < parts.length - 1 ? (
              // The space is read (the parts stay apart for a screen reader), the dot is not.
              <>
                {NO_BREAK_SPACE}
                <span aria-hidden>·</span>
              </>
            ) : null}
          </span>
          {index < parts.length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}

/** Keeps a dot on the line of the part before it. */
const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

const TITLE = "text-balance break-words hyphens-auto";

/** Sizes of a result figure set as a cover, by `figureSize`. */
const FIGURE: Record<"lg" | "md" | "sm", string> = { lg: "text-display-sm", md: "text-h1", sm: "text-h3" };
/** The same on a tile across half the wide canvas or more: one step up, so the figure fills its box. */
const FIGURE_ROOMY: Record<"lg" | "md" | "sm", string> = { lg: "@work:text-display-xl", md: "@work:text-display", sm: "@work:text-h1" };

function Cover({
  project,
  sizes,
  ratio,
  priority,
  size,
  heading,
  loud,
  roomy = false,
}: {
  project: Project;
  sizes: string;
  ratio: string;
  priority: boolean;
  size: "lead" | "tile" | "thumb";
  /** The cover's title is the card's heading (title covers of tiles and row cards). */
  heading: boolean;
  loud: boolean;
  /** A tile across half the wide canvas or more: its figure or title is set one step larger there. */
  roomy?: boolean;
}): ReactNode {
  const mode = coverMode(project);
  const picture = coverImage(project);
  if (mode === "picture" && picture) {
    return (
      // No text in this box, ever: captions sit under or beside a picture.
      <div data-cover="picture" className={cn("relative overflow-hidden rounded-creator-card bg-creator-surface-2", ratio)}>
        <MediaImage src={picture.src} focal={picture.focal} alt="" sizes={sizes} priority={priority} />
      </div>
    );
  }
  const figure = mode === "figure" ? project.results?.[0] : undefined;
  if (figure) {
    const scale = figureSize(figure.value);
    if (size === "thumb") {
      // Up to four characters fit a thumbnail; a longer figure stays with the project's page.
      return scale === "lg" ? (
        <div data-cover="figure" className={cn("grid min-w-0 place-items-center rounded-creator-card bg-creator-surface-2 p-1", ratio)}>
          <span className="max-w-full font-creator-display text-h3 leading-none break-words" style={displayStyle}>
            <bdi>{figure.value}</bdi>
          </span>
        </div>
      ) : null;
    }
    return (
      <div data-cover="figure" className={cn("grid min-w-0 content-end gap-2 rounded-creator-card bg-creator-surface-2", size === "lead" ? "p-6" : "p-4", roomy && "@work:p-6", ratio)}>
        <span className={cn("min-w-0 font-creator-display leading-none break-words", FIGURE[scale], roomy && FIGURE_ROOMY[scale])} style={displayStyle}>
          <bdi>{figure.value}</bdi>
        </span>
        <span dir="auto" className={cn(pageSide, "min-w-0 text-small break-words text-creator-fg-muted")}>
          {figure.label}
        </span>
      </div>
    );
  }
  if (size === "thumb") return null;
  const Title = heading ? "h3" : "span";
  const tag = project.tags?.[0];
  return (
    <div data-cover="title" className={cn("flex min-w-0 flex-col justify-between gap-4 rounded-creator-card bg-creator-surface-2", size === "lead" ? "p-6" : "p-4", roomy && "@work:p-6", ratio)}>
      {project.source ? (
        // The repository's name reads left to right and stays on the page's side.
        <span className="block min-w-0 truncate font-mono text-caption text-creator-fg-muted">
          <bdi dir="ltr">
            {project.source.owner}/{project.source.repo}
          </bdi>
        </span>
      ) : (
        <span dir="auto" className={cn(pageSide, "block min-w-0 text-caption font-medium break-words text-creator-fg-muted")}>
          {tag}
        </span>
      )}
      <Title
        dir="auto"
        className={cn(
          pageSide,
          "block min-w-0 font-creator-display",
          TITLE,
          loud ? "leading-none rtl:leading-tight" : "leading-tight rtl:leading-snug",
          size === "lead" ? "text-h1" : loud ? "text-h2" : "text-h3",
          roomy && "@work:text-display-sm",
        )}
        style={displayStyle}
      >
        {project.title}
      </Title>
    </div>
  );
}

interface CoverBox {
  /** The aspect utility on phones (and on the narrow column). */
  phone: string;
  /** From the wide canvas: another ratio, or "fill" (the cover takes the height its row leaves). */
  wide: "aspect-photo" | "aspect-video" | "fill" | null;
  sizes: string;
}

const WIDE_COVER: Record<NonNullable<CoverBox["wide"]>, string> = {
  "aspect-photo": "@work:aspect-photo",
  "aspect-video": "@work:aspect-video",
  fill: "@work:aspect-auto @work:min-h-32 @work:flex-1",
};

/**
 * A card with its cover on top and the caption under it: the grid's tile and the row's card.
 * The caption reads like a label: the number, then title, sentence, role and year, and an arrow at
 * the inline end. In a `narrow` tile (one of a pair on phones) the number stands above the title
 * and the arrow waits for the wide canvas, so the words keep the tile's whole width.
 */
function Card({
  entry,
  cover,
  lead,
  narrow = false,
  roomy = false,
  numbered,
  loud,
  wide,
  locale,
  onOpen,
}: { entry: Entry; cover: CoverBox; lead: boolean; narrow?: boolean; roomy?: boolean } & Shared) {
  const { project, target } = entry;
  // A title cover is the card's title: the caption does not say it twice.
  const titled = coverMode(project) !== "title";
  return (
    <Shell entry={entry} onOpen={onOpen} className="flex min-w-0 flex-col gap-3">
      <Cover
        project={project}
        sizes={cover.sizes}
        ratio={cn(cover.phone, cover.wide ? WIDE_COVER[cover.wide] : undefined)}
        priority={false}
        size={lead ? "lead" : "tile"}
        heading
        loud={loud}
        roomy={roomy}
      />
      <div className={cn("min-w-0", narrow ? cn("grid grid-cols-1 gap-1", wide && "@work:flex @work:items-start @work:gap-3") : "flex items-start gap-3")}>
        {numbered ? (
          <span aria-hidden className={cn("text-caption font-semibold text-creator-accent-text tabular-nums", narrow ? wide && "@work:pt-1" : "pt-1")}>
            {projectNumber(entry.position)}
          </span>
        ) : null}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1">
          {titled ? (
            <h3
              dir="auto"
              className={cn(
                pageSide,
                TITLE,
                loud ? "font-creator-body text-title leading-snug font-semibold" : "font-creator-display text-h3 leading-tight rtl:leading-snug",
                wide && lead && (loud ? "@work:text-h3" : "@work:text-h2"),
              )}
              style={loud ? undefined : displayStyle}
            >
              {project.title}
            </h3>
          ) : null}
          <p dir="auto" className={cn(pageSide, "line-clamp-2 text-small break-words text-creator-fg-muted")}>
            {project.summary}
          </p>
          <Meta entry={entry} locale={locale} />
        </div>
        <TargetArrow target={target} className={cn("mt-1", narrow && (wide ? "hidden @work:block" : "hidden"))} />
      </div>
    </Shell>
  );
}

interface TileSpec {
  entry: Entry;
  lead: boolean;
  /** Phones: across both columns, or one of a pair. */
  phoneSpan: 1 | 2;
  /** Wide canvas: columns of six, and rows. */
  wideSpan: 2 | 3 | 4 | 6;
  wideRows: 1 | 2;
  cover: CoverBox;
}

const PHONE_SPAN: Record<TileSpec["phoneSpan"], string> = { 1: "col-span-1", 2: "col-span-2" };
const WIDE_SPAN: Record<TileSpec["wideSpan"], string> = { 2: "@work:col-span-2", 3: "@work:col-span-3", 4: "@work:col-span-4", 6: "@work:col-span-6" };
const WIDE_SIZES: Record<TileSpec["wideSpan"], string> = { 2: mediaSizes.workThird, 3: mediaSizes.workHalf, 4: mediaSizes.workTwoThirds, 6: mediaSizes.work };

const isUpright = (project: Project): boolean => {
  const picture = coverImage(project);
  return picture !== undefined && pictureRatio(picture) < 1;
};

/**
 * Every tile of the grid with its place, in page order. Wide canvas: the rows of `bentoRows` (a lead
 * of four columns over two rows with up to two tiles stacked beside it, then rows of equal tiles).
 * Phones: the lead across both columns, the others in pairs; one left over spans both.
 */
export function bentoTiles<T extends { project: Project }>(entries: readonly T[], leadTaken: boolean): (Omit<TileSpec, "entry"> & { entry: T })[] {
  const rows = bentoRows(entries.length, leadTaken);
  const hasLead = rows[0]?.lead === true;
  const others = entries.length - (hasLead ? 1 : 0);
  const tiles: (Omit<TileSpec, "entry"> & { entry: T })[] = [];
  let index = 0;
  for (const row of rows) {
    for (let place = 0; place < row.tiles; place += 1, index += 1) {
      const entry = entries[index];
      if (!entry) continue;
      const lead = row.lead && place === 0;
      const picture = coverImage(entry.project);
      let phoneSpan: TileSpec["phoneSpan"] = 2;
      let phone = picture ? RATIO_CLASS[nearestRatio(picture.w, picture.h)] : "aspect-photo";
      if (!lead) {
        // Pairs among the tiles that are not the lead; one left over stands alone.
        const nth = index - (hasLead ? 1 : 0);
        const partner = entries[nth % 2 === 0 ? index + 1 : index - 1];
        const alone = nth === others - 1 && others % 2 === 1;
        phoneSpan = alone ? 2 : 1;
        phone = alone ? "aspect-video" : partner && isUpright(entry.project) && isUpright(partner.project) ? "aspect-portrait" : "aspect-square";
      }
      let wideSpan: TileSpec["wideSpan"];
      let wideRows: TileSpec["wideRows"] = 1;
      let wide: CoverBox["wide"];
      if (lead) {
        wideSpan = row.tiles === 1 ? 6 : 4;
        wideRows = row.tiles === 3 ? 2 : 1;
        // Beside two stacked tiles the lead's picture fills both rows; beside one tile it sets the height.
        wide = row.tiles === 1 ? "aspect-video" : row.tiles === 3 ? "fill" : "aspect-photo";
      } else if (row.lead) {
        wideSpan = 2;
        // One tile beside the lead stands as tall as the lead.
        wide = row.tiles === 2 ? "fill" : "aspect-photo";
      } else {
        wideSpan = row.tiles === 1 ? 6 : row.tiles === 2 ? 3 : 2;
        wide = row.tiles === 1 ? "aspect-video" : "aspect-photo";
      }
      tiles.push({ entry, lead, phoneSpan, wideSpan, wideRows, cover: { phone, wide, sizes: WIDE_SIZES[wideSpan] } });
    }
  }
  return tiles;
}

function Tile({ entry, lead, phoneSpan, wideSpan, wideRows, cover, wide, ...shared }: TileSpec & Shared) {
  return (
    <div role="listitem" id={entry.project.slug} className={cn("grid min-w-0 scroll-mt-16", PHONE_SPAN[phoneSpan], wide && WIDE_SPAN[wideSpan], wide && wideRows === 2 && "@work:row-span-2")}>
      <Card entry={entry} lead={lead} narrow={phoneSpan === 1} roomy={wide && wideSpan >= 3} wide={wide} cover={wide ? cover : { phone: cover.phone, wide: null, sizes: phoneSpan === 2 ? mediaSizes.column : mediaSizes.half }} {...shared} />
    </div>
  );
}

/**
 * One row of the numbered list: the number, the title set large, the sentence, role and year, and
 * an end box (the cover, a short figure, or just the arrow). On the wide canvas the parts stand in
 * twelve columns. `compact` rows (the projects behind "Show all") carry no thumbnail.
 */
function Row({ entry, compact, numbered, loud, wide, locale, onOpen }: { entry: Entry; compact: boolean } & Shared) {
  const { project, target } = entry;
  const thumb = compact ? null : <Cover project={project} sizes={mediaSizes.thumb} ratio={cn("size-20", wide && "@work:aspect-photo @work:h-auto @work:w-full")} priority={false} size="thumb" heading={false} loud={loud} />;
  // Without a thumbnail the arrow stands in its place: a chevron on to the project's page, the
  // arrow out to the project's own link.
  const hasThumb = !compact && (coverMode(project) === "picture" || (coverMode(project) === "figure" && figureSize(project.results?.[0]?.value ?? "") === "lg"));
  return (
    <li id={project.slug} className="scroll-mt-16 border-b border-creator-line">
      <Shell
        entry={entry}
        onOpen={onOpen}
        className={cn("grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-4", wide && "@work:grid-cols-12 @work:items-center @work:gap-x-6 @work:py-6")}
      >
        {numbered ? (
          <span aria-hidden className={cn("row-span-2 pt-1 text-caption font-semibold text-creator-accent-text tabular-nums", wide && "@work:col-span-1 @work:row-span-1 @work:pt-0 @work:text-small")}>
            {projectNumber(entry.position)}
          </span>
        ) : (
          // Keeps the three columns in place when rows carry no number.
          <span aria-hidden className={cn("row-span-2", wide && "@work:hidden")} />
        )}
        <div className={cn("col-start-2 grid min-w-0 grid-cols-1 gap-1", wide && (numbered ? "@work:col-span-6 @work:col-start-auto" : "@work:col-span-7 @work:col-start-auto"))}>
          <h3
            dir="auto"
            className={cn(
              pageSide,
              TITLE,
              "font-creator-display",
              compact ? "text-title leading-snug" : loud ? "text-h1 leading-none rtl:leading-tight" : "text-h3 leading-tight rtl:leading-snug",
              wide && !compact && (loud ? "@work:text-display" : "@work:text-h2"),
            )}
            style={displayStyle}
          >
            {project.title}
          </h3>
          <p dir="auto" className={cn(pageSide, "line-clamp-2 text-small break-words text-creator-fg-muted", wide && "@work:text-body")}>
            {project.summary}
          </p>
        </div>
        <Meta entry={entry} locale={locale} className={cn("col-start-2 row-start-2", wide && "@work:col-span-3 @work:col-start-auto @work:row-start-auto")} />
        <div data-row-end className={cn("col-start-3 row-span-2 row-start-1 grid justify-items-end", wide && "@work:col-span-2 @work:col-start-auto @work:row-span-1 @work:row-start-auto")}>
          {hasThumb ? (
            thumb
          ) : target.kind === "link" ? (
            <TargetArrow target={target} className={cn("mt-1", wide && "@work:mt-0")} />
          ) : target.kind === "none" ? null : (
            <Icon icon={ChevronRight} size="sm" className={cn("mt-1 shrink-0 text-creator-fg-muted rtl:-scale-x-100", wide && "@work:mt-0")} />
          )}
        </div>
      </Shell>
    </li>
  );
}
