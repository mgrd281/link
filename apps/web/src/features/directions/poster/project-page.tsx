import { hasImage, isBlockActive, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import {
  coverMode,
  figureSize,
  formatYears,
  hasDetail,
  linkLabelKey,
  pictureRatio,
  plateRows,
  primaryAction,
  repositoryUrl,
  shownPictures,
  type PlateRow,
} from "@linkyo/blocks/project";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { tokens, type CreatorButtonStyle } from "@linkyo/tokens";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, ChevronLeft, ChevronRight, Scale, Star } from "lucide-react";
import { getImageProps } from "next/image";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { linkStyleClasses } from "@/features/creator/link-button";
import { themeStyle } from "@/features/creator/theme";
import { jsonLd } from "@/lib/json-ld";

import { CopyButton } from "../shared/copy-button";
import { CreatorFooter, MediaImage, mediaSizes, useCreatorFormat, type CreatorFooterLinks } from "../shared/creator-kit";
import { LinkIconGlyph } from "../shared/link-icons";
import { resolveMedia } from "../shared/media";
import { PictureViewer } from "../shared/picture-viewer";
import { CodeBox } from "./code-box";
import { ContactBand } from "./portfolio-sections";
import { ProjectCover, projectNumber } from "./projects";
import { ShareButton } from "./share";
import { displayStyle, pageSide, pressable, sectionTitle } from "./styles";

type Project = BlockOf<"project">;
type Quotes = BlockOf<"quotes">;
type Picture = NonNullable<Project["pictures"]>[number];
type Locale = Page["profile"]["locale"];

/** Written by an AI draft, edited afterwards or not (machine-readable marking, AI Act Art. 50(2)). */
const isAi = (block: Block): boolean => block.origin === "ai" || block.origin === "ai-edited";

/** A result figure on the project page, by `figureSize`. */
const FIGURE: Record<"lg" | "md" | "sm", string> = { lg: "text-h2", md: "text-h3", sm: "text-title" };
/** The same beside the title on the wide canvas, one step larger: the result reads before the facts. */
const FIGURE_WIDE: Record<"lg" | "md" | "sm", string> = { lg: "@work:text-display-sm", md: "@work:text-h1", sm: "@work:text-h3" };

const TITLE = "text-balance break-words hyphens-auto";

/** Paragraphs are split at blank lines; a single line break stays a line break. */
const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

/** The host a link opens, as people read it ("github.com"): left to right, without "www.". */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The largest file our own image optimizer serves for a picture: what a picture link opens without
 * script (the viewer shows the same file). Sample pictures and uploads go through the optimizer;
 * the address never leaves our origin.
 */
export function largePictureHref(src: string): string {
  const resolved = resolveMedia(src);
  const { props } = getImageProps({ src: resolved, alt: "", fill: true, sizes: "100vw" });
  return typeof props.src === "string" ? props.src : src;
}

/**
 * A box that keeps a picture at its own ratio and never grows taller than the screen below the
 * bar: its width stops at (viewport height − bar) × ratio. `--ratio` is the box's own ratio (or a
 * pair's sum of ratios on the row that holds them).
 */
const FIT_SCREEN = "max-w-[calc((100dvh_-_var(--spacing-16))_*_var(--ratio))]";
const ratioVar = (ratio: number): CSSProperties => ({ "--ratio": String(ratio) }) as CSSProperties;

// `sizes` for this page's pictures, from layout tokens: the width each one is drawn at, so the
// browser asks for no more pixels than it shows (plan §3.4 P10). Phones are up to breakpoint sm,
// the creator column up to the wide canvas, then the canvas. Inside the page's side padding the
// phone width is written as calc(100vw − 2 gutters): a bare "100vw" would also make next/image
// leave every candidate under 640 px out of the srcset, too wide for a picture drawn half as wide
// in the column.
const px = (n: number): string => `${String(n)}px`;
const ON_PHONE = `(max-width: ${px(tokens.breakpoint.sm)})`;
const IN_COLUMN = `(max-width: ${px(tokens.layout.work - 1)})`;
const PHONE_TEXT = `calc(100vw - ${px(2 * tokens.spacing.creatorGutter)})`;
/** As wide as `max`, or as FIT_SCREEN lets a picture of this ratio be under the bar if that is less. */
const fitScreen = (max: number, ratio: number): string => `min(${px(max)}, calc((100vh - ${px(tokens.spacing["16"])}) * ${ratio.toFixed(3)}))`;
/** The cover: edge to edge on phones, then the column or the canvas, never taller than the screen. */
const coverSizes = (ratio: number): string => `${ON_PHONE} 100vw, ${IN_COLUMN} ${fitScreen(tokens.layout.creator, ratio)}, ${fitScreen(tokens.layout.work, ratio)}`;

/** The aspect-ratio of a stored picture (3:2 when its size is unknown). */
function aspect(image: { w?: number | undefined; h?: number | undefined }): CSSProperties {
  return image.w && image.h ? { aspectRatio: `${String(image.w)} / ${String(image.h)}` } : { aspectRatio: "3 / 2" };
}

/** What the next-project row and the links need to know about where pages live. */
interface Places {
  base: string | undefined;
  suffix: string;
  onOpenProject: ((id: string) => void) | undefined;
}

/**
 * A project's own page: what the card has no room for. Phone first, one column, in this order on
 * every width: the bar (back to the card it came from, the page's primary action), the kicker,
 * title and sentence, the result figures (before the facts: the result comes first), the links,
 * the facts, the repository, the cover whole at its own ratio, the story, the code, what clients
 * said about it, the pictures by ratio, the next project and the page's closing band. From the
 * wide canvas the header splits into the words (eight columns) and the figures and facts (four),
 * the story's labels stand beside their text, and pictures follow their ratios across the canvas.
 *
 * Everything is server HTML; script only adds the share and copy buttons and the picture viewer.
 * In a preview (the dashboard, the AI draft) the way back is a button and the page sits inside the
 * dashboard's own <main>.
 */
export function ProjectPage({
  page,
  theme,
  project,
  base,
  suffix = "",
  backHref,
  onBack,
  onOpenProject,
  footerLinks,
  preview = false,
  overlay,
  dock,
}: {
  page: Page;
  theme: ResolvedCreatorTheme;
  project: BlockOf<"project">;
  /** Where project pages live ("/<username>"); absent in previews. */
  base?: string | undefined;
  /** Appended to every project address. */
  suffix?: string | undefined;
  /** The portfolio this project belongs to (the bar's way back on a routed page). */
  backHref?: string | undefined;
  /** Previews without a router: the way back is a button. */
  onBack?: (() => void) | undefined;
  /** Previews without a router: "next project" opens in place. */
  onOpenProject?: ((id: string) => void) | undefined;
  footerLinks?: CreatorFooterLinks | undefined;
  preview?: boolean | undefined;
  /** Linkyo's own chrome on example and sample pages: the "Example" badge and the dock. */
  overlay?: ReactNode;
  dock?: ReactNode;
}): ReactNode {
  const t = useTranslations("creator");
  const { profile } = page;
  const locale = profile.locale;
  const rtl = locale === "ar";
  const now = new Date();
  const blocks = page.blocks.filter((block) => isBlockActive(block, now));
  const projects = blocks.filter((block): block is Project => block.type === "project");
  const quotes = blocks.filter((block): block is Quotes => block.type === "quotes");
  const primary = primaryAction(blocks, now);
  const contact = primary ? blocks.find((block): block is BlockOf<"contact"> => block.type === "contact") : undefined;
  const places: Places = { base, suffix, onOpenProject };

  // The cover: the owner's cover, else the first picture that may be shown (it then leads the page
  // instead of standing among the pictures). A picture still waiting for its description is never shown.
  const shown = shownPictures(project);
  const ownCover = hasImage(project.cover) ? project.cover : undefined;
  const firstShown = ownCover ? undefined : shown[0];
  const cover = ownCover ? { image: ownCover, alt: ownCover.alt } : firstShown ? { image: firstShown.image, alt: firstShown.decorative ? "" : firstShown.image.alt } : undefined;
  const pictures = firstShown ? shown.slice(1) : shown;
  const about = quotes.flatMap((block) => block.items.filter((item) => item.project === project.id));
  const next = nextProject(projects, project, quotes, places);
  // A preview sits inside the dashboard, which already has the page's one <main>.
  const Main = preview ? "div" : "main";
  const ai = isAi(project);

  return (
    <div
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      data-project-page={project.slug}
      className={cn(
        "poster-scope @container relative isolate overflow-clip bg-creator-bg font-creator-body text-creator-fg [--color-focus:var(--creator-accent-text)]",
        preview ? "min-h-full" : "min-h-dvh",
      )}
    >
      {/* Tabbing never leaves the focused element under the bar (WCAG 2.4.11). */}
      {preview ? null : <style>{"html{scroll-padding-top:var(--spacing-16)}"}</style>}
      {preview ? null : <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData(page, project)) }} />}
      <ProjectBar profile={profile} primary={primary} backHref={backHref} onBack={onBack} />
      {/* Linkyo's own label on example pages, in the flow right under the bar: it never covers the page. */}
      {overlay ? <div className="flex justify-center px-creator-gutter pt-4">{overlay}</div> : null}

      <div className="mx-auto max-w-creator @work:box-content @work:max-w-work @work:px-creator-gutter">
        <Main className="grid grid-cols-1 gap-12 px-creator-gutter pt-8 pb-4 @prose:gap-16 @prose:px-0 @prose:pt-12 @work:gap-20 @work:pt-16">
          <article aria-labelledby={`project-${project.id}`} className="grid min-w-0 grid-cols-1 gap-12 @prose:gap-16 @work:gap-20" {...(ai ? { "data-ai-generated": "true" } : {})}>
            <Header project={project} locale={locale} theme={theme} />
            {cover ? <Cover image={cover.image} alt={cover.alt} priority={!preview} /> : null}
            <Story project={project} theme={theme} />
            {project.code ? <CodeBox code={project.code} className="@work:ms-auto @work:w-3/4" /> : null}
            {about.length > 0 ? <ProjectQuotes items={about} ownerName={profile.displayName} /> : null}
            {pictures.length > 0 ? <Pictures pictures={pictures} /> : null}
          </article>
          {next ? <NextProject next={next} /> : null}
          {contact ? (
            <div className="grid min-w-0 gap-4">
              <p dir="auto" className={cn(pageSide, "font-creator-display text-h3 leading-tight")} style={displayStyle}>
                {t("portfolio.similar")}
              </p>
              <ContactBand block={contact} now={now} wide />
            </div>
          ) : null}
        </Main>
        {/* With a Linkyo bar at the bottom, the footer drops its own Linkyo credit (one is enough). */}
        <CreatorFooter className={cn("px-creator-gutter", dock ? "pb-24" : undefined)} credit={!dock} links={footerLinks} />
      </div>
      {/* The viewer waits for a press on a picture and only then loads (shared/picture-viewer.tsx). */}
      {pictures.length > 0 ? <PictureViewer /> : null}
      {dock}
    </div>
  );
}

// ─── The bar ──────────────────────────────────────────────────────────────────────────────────

/**
 * Solid and there from the first paint, flush with the top: the way back to the portfolio (to the
 * very card this project came from), the page's primary action and the share button.
 */
function ProjectBar({
  profile,
  primary,
  backHref,
  onBack,
}: {
  profile: Page["profile"];
  primary: BlockOf<"contact">["primary"] | null;
  backHref: string | undefined;
  onBack: (() => void) | undefined;
}) {
  const t = useTranslations("creator");
  const label = t("portfolio.backTo", { name: profile.displayName });
  // The name is "Back to Mila Aurel". A phone's bar shows the owner's name alone (drawn from
  // `data-name`, so "Back to" is not cut down to "Back t…" beside the primary action); from the
  // column on it shows the whole words. The words are always in the control (visually hidden on
  // phones) and the label names it once.
  const body = (
    <>
      <Icon icon={ChevronLeft} size="md" className="shrink-0" />
      {hasImage(profile.avatar) ? (
        <span className="relative size-control-sm shrink-0 overflow-hidden rounded-full bg-creator-surface-2">
          <MediaImage src={profile.avatar.src} focal={profile.avatar.focal} alt="" sizes={px(tokens.size.controlSm)} />
        </span>
      ) : null}
      <span
        dir="auto"
        data-name={profile.displayName}
        className={cn(pageSide, "min-w-0 truncate text-small font-semibold before:content-[attr(data-name)] @prose:text-body @prose:before:content-none")}
      >
        <span className="sr-only @prose:not-sr-only">{label}</span>
      </span>
    </>
  );
  const back = "flex min-h-touch-target min-w-0 items-center gap-2 rounded-creator-button pe-2";
  return (
    <div data-project-bar className="sticky top-0 layer-sticky h-16 border-b border-creator-line bg-creator-bg">
      <div className="mx-auto flex h-full max-w-creator items-center gap-2 ps-2 pe-2 @prose:ps-0 @prose:pe-0 @work:box-content @work:max-w-work @work:px-creator-gutter">
        <div className="flex min-w-0 flex-1">
          {backHref ? (
            <a href={backHref} aria-label={label} className={cn(back, pressable)}>
              {body}
            </a>
          ) : onBack ? (
            <button type="button" onClick={onBack} aria-label={label} className={cn(back, pressable)}>
              {body}
            </button>
          ) : null}
        </div>
        {primary ? (
          // The label may be cut short here; the link's name is still the whole label.
          <a
            href={primary.url}
            data-bar-action
            className={cn("inline-flex min-h-touch-target max-w-1/2 shrink-0 items-center gap-2 rounded-creator-button bg-creator-accent px-3 text-small @prose:px-4 font-semibold text-creator-accent-fg", pressable)}
          >
            {primary.icon ? <LinkIconGlyph icon={primary.icon} size="sm" className="hidden shrink-0 @prose:block" /> : null}
            <span dir="auto" className="truncate">
              {primary.label}
            </span>
          </a>
        ) : null}
        {/* Sharing needs an address of its own: a routed page has one, a preview does not. */}
        {backHref ? <ShareButton title={profile.displayName} /> : null}
      </div>
    </div>
  );
}

// ─── Header: kicker, title, sentence, figures, links, facts, repository ──────────────────────

function Header({ project, locale, theme }: { project: Project; locale: Locale; theme: ResolvedCreatorTheme }) {
  const t = useTranslations("creator");
  const links = project.links?.length ? project.links : project.source ? [{ url: repositoryUrl(project.source) }] : [];
  const results = project.results ?? [];
  const rtl = locale === "ar";
  return (
    <header className="relative grid min-w-0 grid-cols-1 gap-6 @prose:gap-8 @work:grid-cols-12 @work:gap-x-6 @work:gap-y-10">
      {/* The Linkyo bar of example pages slides in once the header has scrolled away (its end marks it). */}
      <div data-poster-sentinel aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-0" />
      <div className="grid min-w-0 content-start gap-4 @work:col-span-8 @work:row-start-1">
        {project.source ? (
          <p className="min-w-0 truncate font-mono text-small text-creator-accent-text">
            <bdi dir="ltr">
              {project.source.owner}/{project.source.repo}
            </bdi>
          </p>
        ) : project.tags?.length ? (
          <p dir="auto" className={cn(pageSide, "min-w-0 text-small font-medium break-words text-creator-accent-text")}>
            {project.tags.join(" · ")}
          </p>
        ) : null}
        <h1
          id={`project-${project.id}`}
          dir="auto"
          className={cn(
            pageSide,
            TITLE,
            "font-creator-display text-display-sm @prose:text-display @work:text-display-xl",
            rtl ? "leading-snug" : "leading-none",
          )}
          style={displayStyle}
        >
          {project.title}
        </h1>
        <p dir="auto" className={cn(pageSide, "max-w-prose text-body-lg text-pretty break-words text-creator-fg-muted @work:text-h3 @work:font-regular")}>
          {project.summary}
        </p>
      </div>
      {results.length > 0 ? (
        // The result comes first: directly under the title block, before the facts.
        <div role="group" aria-label={t("portfolio.figures")} className="min-w-0 @work:col-span-4 @work:col-start-9 @work:row-start-1 @work:self-end">
          <dl className={cn("grid grid-cols-1 border-y border-creator-line", results.length > 1 && "@prose:grid-cols-3 @work:grid-cols-1")}>
            {results.map((result, index) => (
              <div
                key={`${result.value}-${result.label}`}
                className={cn(
                  "flex min-w-0 flex-row-reverse items-baseline justify-end gap-4 py-4",
                  index > 0 && "border-t border-creator-line",
                  results.length > 1 && "@prose:flex-col-reverse @prose:items-start @prose:justify-end @prose:gap-1 @prose:border-t-0 @prose:pe-4 @work:flex-row-reverse @work:items-baseline @work:justify-end @work:gap-4 @work:pe-0",
                  results.length > 1 && index > 0 && "@prose:border-s @prose:ps-4 @work:border-s-0 @work:border-t @work:ps-0",
                )}
              >
                <dt dir="auto" className={cn(pageSide, "min-w-0 text-caption break-words text-creator-fg-muted")}>
                  {result.label}
                </dt>
                <dd className={cn("min-w-0 shrink-0 font-creator-display leading-none tabular-nums break-words", FIGURE[figureSize(result.value)], FIGURE_WIDE[figureSize(result.value)])} style={displayStyle}>
                  <bdi>{result.value}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {links.length > 0 ? <Links links={links} style={theme.buttonStyle} /> : null}
      <Facts project={project} locale={locale} />
      {project.source ? <Repository source={project.source} title={project.title} locale={locale} /> : null}
    </header>
  );
}

function Links({ links, style }: { links: { url: string; label?: string | undefined }[]; style: CreatorButtonStyle }) {
  const t = useTranslations("creator");
  return (
    <ul className="grid min-w-0 grid-cols-1 gap-3 @prose:flex @prose:flex-wrap @work:col-span-8 @work:col-start-1">
      {links.map((link, index) => {
        // One button leads: on pages with filled buttons a second link turns soft.
        const variant: CreatorButtonStyle = index > 0 && style === "filled" ? "soft" : style;
        const onColor = variant === "filled";
        return (
          <li key={link.url} className="min-w-0">
            <a
              href={link.url}
              className={cn(
                "flex min-h-creator-button min-w-0 items-center gap-4 rounded-creator-button py-2 ps-4 pe-4",
                linkStyleClasses[variant],
                variant === "minimal" && "ps-0 pe-1 after:hidden",
                pressable,
              )}
            >
              <span className="grid min-w-0 flex-1 gap-0.5 text-start">
                <span dir="auto" className={cn(pageSide, "truncate text-body leading-snug font-semibold")}>
                  {link.label?.trim() ? link.label : t(`portfolio.${linkLabelKey(link.url)}`)}
                </span>
                <span className={cn("truncate text-small", !onColor && "text-creator-fg-muted")}>
                  <Opens words={t("portfolio.opens", { host: HOST_MARK })} host={hostOf(link.url)} />
                </span>
              </span>
              <Icon icon={ArrowUpRight} size="sm" className="shrink-0" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Stands in for the host in "opens {host}" (a private-use character no translation contains). */
const HOST_MARK = "\u{E000}";

/** "opens github.com": the sentence in the page's language, the host in it left to right. */
function Opens({ words, host }: { words: string; host: string }) {
  const [before = "", after = ""] = words.split(HOST_MARK);
  return (
    <>
      {before}
      <bdi dir="ltr">{host}</bdi>
      {after}
    </>
  );
}

/** For, Role, Year, Topics: what is filled, in two columns. A confidential client has no name to show. */
function Facts({ project, locale }: { project: Project; locale: Locale }) {
  const t = useTranslations("creator");
  const facts: { key: string; term: string; value: ReactNode }[] = [];
  if (project.confidential) facts.push({ key: "for", term: t("portfolio.factFor"), value: t("portfolio.confidential") });
  else if (project.client?.trim()) facts.push({ key: "for", term: t("portfolio.factFor"), value: <span dir="auto">{project.client}</span> });
  if (project.role?.trim()) facts.push({ key: "role", term: t("portfolio.factRole"), value: <span dir="auto">{project.role}</span> });
  if (project.year) facts.push({ key: "year", term: t("portfolio.factYear"), value: <bdi className="tabular-nums">{formatYears(project.year, t("portfolio.untilNow"))}</bdi> });
  if (project.tags?.length && project.source) facts.push({ key: "topics", term: t("portfolio.factTopics"), value: <span dir="auto">{project.tags.join(" · ")}</span> });
  if (facts.length === 0) return null;
  return (
    <dl lang={locale} className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-4 @work:col-span-4 @work:col-start-9">
      {facts.map((fact) => (
        <div key={fact.key} className="grid min-w-0 content-start gap-1">
          <dt className="text-caption text-creator-fg-muted">{fact.term}</dt>
          <dd className={cn(pageSide, "min-w-0 text-small font-medium break-words")}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The repository's facts as the repository card prints them, and the install command to copy. */
function Repository({ source, title, locale }: { source: NonNullable<Project["source"]>; title: string; locale: Locale }) {
  const t = useTranslations("creator");
  // Latin digits in every language (1.3K, 1280), as the page's figures and years.
  const f = useCreatorFormat(`${locale}-u-nu-latn`);
  const facts = source.stars !== undefined || Boolean(source.language) || Boolean(source.license);
  if (!facts && !source.install) return null;
  return (
    <div className="grid min-w-0 content-start gap-3 @work:col-span-8 @work:col-start-1">
      {facts ? (
        <ul aria-label={t("portfolio.repository")} className="flex flex-wrap items-center gap-x-5 gap-y-1 text-small text-creator-fg-muted">
          {source.stars !== undefined ? (
            <li className="inline-flex items-center gap-1">
              <Icon icon={Star} size="sm" />
              <span aria-hidden className="font-semibold text-creator-fg tabular-nums">
                {f.compact(source.stars)}
              </span>
              <span className="sr-only">{t("stars", { count: source.stars })}</span>
            </li>
          ) : null}
          {source.language ? (
            <li className="inline-flex items-center gap-1">
              <span aria-hidden className="size-dot rounded-full bg-creator-accent" />
              <bdi dir="ltr">{source.language}</bdi>
            </li>
          ) : null}
          {source.license ? (
            <li className="inline-flex items-center gap-1">
              <Icon icon={Scale} size="sm" />
              <span className="sr-only">{t("portfolio.license", { license: source.license })}</span>
              <bdi aria-hidden dir="ltr">
                {source.license}
              </bdi>
            </li>
          ) : null}
        </ul>
      ) : null}
      {source.install ? (
        <div dir="ltr" className="flex min-w-0 items-center gap-2 rounded-creator-card bg-creator-surface-2 py-1 ps-4 pe-1">
          {/* Wraps instead of cutting off, so the whole command stays readable on a phone. */}
          <code className="min-w-0 flex-1 py-2 font-mono text-small wrap-anywhere">
            <span aria-hidden className="text-creator-accent-text select-none">
              ${" "}
            </span>
            {source.install}
          </code>
          <CopyButton value={source.install} label={t("copyInstall", { name: title })} className="grid size-touch-target shrink-0 place-items-center rounded-md text-creator-fg hover:bg-creator-line" />
        </div>
      ) : null}
    </div>
  );
}

// ─── Cover, story, quotes, pictures ───────────────────────────────────────────────────────────

/**
 * The cover, whole: at its own ratio (3:2 when unknown), never taller than the screen below the
 * bar, edge to edge on phones. The page's one preloaded picture.
 */
function Cover({ image, alt, priority }: { image: NonNullable<Project["cover"]>; alt: string; priority: boolean }) {
  return (
    <div className="-mx-creator-gutter @prose:mx-0">
      <div
        data-cover
        data-w={image.w}
        data-h={image.h}
        className={cn("relative mx-auto w-full overflow-hidden bg-creator-surface-2 @prose:rounded-creator-card", FIT_SCREEN)}
        style={{ ...aspect(image), ...ratioVar(pictureRatio(image)) }}
      >
        <MediaImage src={image.src} focal={image.focal} alt={alt} sizes={coverSizes(pictureRatio(image))} priority={priority} />
      </div>
    </div>
  );
}

/** The story's parts with their neutral labels, in a fixed order. */
const PARTS = [
  ["problem", "storyProblem"],
  ["solution", "storySolution"],
  ["result", "storyResult"],
] as const;

/**
 * The words: `about` as a lead, then Starting point, Approach and Result, each under its label in
 * the template's title style (without numbers). From the wide canvas the label stands in the first
 * three columns and the text in the next six; running text never gets wider than a reading column.
 */
function Story({ project, theme }: { project: Project; theme: ResolvedCreatorTheme }) {
  const t = useTranslations("creator");
  const story = project.story ?? {};
  const lead = story.about?.trim() ? paragraphs(story.about) : [];
  const parts = PARTS.filter(([key]) => story[key]?.trim());
  if (lead.length === 0 && parts.length === 0) return null;
  const heading = sectionTitle(theme.layout.headings);
  const marker = theme.layout.headings === "marker";
  return (
    <div data-story className="grid min-w-0 grid-cols-1 gap-10 @prose:gap-12">
      {lead.length > 0 ? (
        <div className="grid min-w-0 gap-4 @work:grid-cols-12 @work:gap-x-6">
          {lead.map((paragraph, index) => (
            // The first paragraph leads: in the display face where the template's face suits running
            // text (Werkbogen's serif, as its about section does), else larger in the body face.
            <p
              key={paragraph}
              dir="auto"
              className={cn(
                pageSide,
                "max-w-prose break-words text-creator-fg @work:col-span-6 @work:col-start-4",
                index > 0 ? "text-body" : marker ? "font-creator-display text-h3 leading-snug @work:text-h2" : "text-body-lg @work:text-h3 @work:leading-snug @work:font-regular",
              )}
              style={index === 0 && marker ? displayStyle : undefined}
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
      {parts.map(([key, label]) => (
        <section key={key} aria-labelledby={`story-${project.id}-${key}`} className={cn("grid min-w-0 grid-cols-1 gap-3 @work:grid-cols-12 @work:gap-x-6", marker && "border-t border-creator-line pt-3")}>
          <h2 id={`story-${project.id}-${key}`} className={cn(heading.className, "min-w-0 @work:col-span-3")} style={heading.style}>
            <span className={cn(pageSide, "min-w-0")}>{t(`portfolio.${label}`)}</span>
            {theme.layout.headings === "rule" ? <span aria-hidden className="h-px min-w-6 flex-1 bg-creator-line-strong" /> : null}
          </h2>
          <div className="grid min-w-0 gap-4 @work:col-span-6 @work:col-start-4">
            {paragraphs(story[key] ?? "").map((paragraph) => (
              <p key={paragraph} dir="auto" className={cn(pageSide, "max-w-prose text-body break-words text-creator-fg")}>
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const quoteMarks = "[quotes:'“'_'”'] before:content-[open-quote] after:content-[close-quote] [&:lang(ar)]:[quotes:'«'_'»'] [&:lang(de)]:[quotes:'„'_'“']";

/** What clients said about this project, set large, and once the line that says who chose them. */
function ProjectQuotes({ items, ownerName }: { items: Quotes["items"]; ownerName: string }) {
  const t = useTranslations("creator");
  return (
    <div className="grid min-w-0 gap-8 @work:grid-cols-12 @work:gap-x-6">
      {items.map((item) => (
        <figure key={`${item.name}-${item.text}`} className="grid min-w-0 content-start gap-4 border-t border-creator-line-strong pt-6 @work:col-span-9 @work:col-start-4">
          <blockquote>
            <p dir="auto" className={cn(pageSide, quoteMarks, "font-creator-display text-h3 leading-snug text-pretty break-words")} style={displayStyle}>
              {item.text}
            </p>
          </blockquote>
          <figcaption className="flex min-w-0 items-center gap-3">
            {hasImage(item.photo) ? (
              <span className="relative size-avatar-md shrink-0 overflow-hidden rounded-full bg-creator-surface-2">
                <MediaImage src={item.photo.src} focal={item.photo.focal} alt="" sizes={px(tokens.size.avatarMd)} />
              </span>
            ) : null}
            <span className="grid min-w-0 gap-0.5">
              <span dir="auto" className={cn(pageSide, "text-small font-semibold")}>
                {item.name}
              </span>
              <span dir="auto" className={cn(pageSide, "text-small text-creator-fg-muted")}>
                {item.role}
              </span>
            </span>
          </figcaption>
        </figure>
      ))}
      <p dir="auto" className={cn(pageSide, "max-w-prose text-caption text-creator-fg-muted @work:col-span-9 @work:col-start-4")}>
        {t("portfolio.quotesNote", { name: ownerName })}
      </p>
    </div>
  );
}

/**
 * The pictures, laid out by ratio (`plateRows`): a landscape picture takes the whole width; two
 * upright or square ones share a row, as wide as their ratios ask so both stand equally tall (true
 * portraits also on phones, the others from the column on); one alone stands narrower, centred.
 * Each is a link to its large file (the viewer opens it with script) named by its description and
 * "Enlarge, picture n of N"; the caption sits under it, never on it.
 */
function Pictures({ pictures }: { pictures: Picture[] }) {
  const t = useTranslations("creator");
  const rows = plateRows(pictures);
  const total = pictures.length;
  return (
    <div data-pictures className="grid min-w-0 grid-cols-1 gap-8 @prose:gap-10 @work:gap-12">
      {rows.map((row) => (
        <PictureRow key={row.items.map((item) => item.index).join("-")} row={row} pictures={pictures} total={total} enlarge={(n) => t("portfolio.enlarge", { n, total })} />
      ))}
    </div>
  );
}

/** `sizes` for each kind of row: the whole canvas, half of it, or a narrow picture standing alone. */
const ROW_SIZES = {
  full: mediaSizes.work,
  pairPhone: mediaSizes.workHalf,
  // Across the screen on phones, beside its partner (about half) from the column on.
  pairStack: `${ON_PHONE} ${PHONE_TEXT}, ${IN_COLUMN} ${px(tokens.layout.creator / 2)}, ${px(tokens.layout.work / 2)}`,
  // Three fifths of the screen and of the column (w-3/5), half of the canvas (@work:w-1/2).
  narrow: `${ON_PHONE} calc(${PHONE_TEXT} * 0.6), ${IN_COLUMN} ${px((tokens.layout.creator * 3) / 5)}, ${px(tokens.layout.work / 2)}`,
} as const;

function PictureRow({ row, pictures, total, enlarge }: { row: PlateRow; pictures: Picture[]; total: number; enlarge: (n: number) => string }) {
  if (row.kind === "full") {
    const item = row.items[0];
    const picture = pictures[item.index];
    if (!picture) return null;
    return <PictureFigure picture={picture} n={item.index + 1} total={total} enlarge={enlarge} sizes={ROW_SIZES.full} className={cn("mx-auto w-full", FIT_SCREEN)} style={ratioVar(item.ratio)} />;
  }
  if (row.kind === "narrow") {
    const item = row.items[0];
    const picture = pictures[item.index];
    if (!picture) return null;
    return (
      <PictureFigure picture={picture} n={item.index + 1} total={total} enlarge={enlarge} sizes={ROW_SIZES.narrow} className={cn("mx-auto w-3/5 @work:w-1/2", FIT_SCREEN)} style={ratioVar(item.ratio)} />
    );
  }
  const side = row.phone === "pair";
  const sum = row.items.reduce((total, item) => total + item.ratio, 0);
  return (
    <div className={cn("mx-auto flex w-full min-w-0 gap-3 @prose:gap-4 @work:gap-6", side ? "flex-row" : "flex-col @prose:flex-row", FIT_SCREEN)} style={ratioVar(sum)}>
      {row.items.map((item) => {
        const picture = pictures[item.index];
        if (!picture) return null;
        return (
          <PictureFigure
            key={item.index}
            picture={picture}
            n={item.index + 1}
            total={total}
            enlarge={enlarge}
            sizes={side ? ROW_SIZES.pairPhone : ROW_SIZES.pairStack}
            // Widths in proportion to the ratios: both pictures stand equally tall.
            className={side ? "min-w-0 grow-(--grow) basis-0" : "min-w-0 @prose:grow-(--grow) @prose:basis-0"}
            style={{ "--grow": String(item.ratio) } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

function PictureFigure({
  picture,
  n,
  total,
  enlarge,
  sizes,
  className,
  style,
}: {
  picture: Picture;
  n: number;
  total: number;
  enlarge: (n: number) => string;
  sizes: string;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const { image } = picture;
  // A decorative picture says nothing itself: the link is named by "Enlarge, picture n of N" alone.
  const alt = picture.decorative ? "" : image.alt;
  return (
    <figure className={cn("grid min-w-0 content-start gap-2", className)} style={style}>
      {/* No aria-label: the link's name is the picture's description followed by the hidden words. */}
      <a href={largePictureHref(image.src)} data-viewer={n} data-total={total} className="block rounded-creator-card focus-visible:focus-ring">
        <span data-picture-box data-w={image.w} data-h={image.h} className="relative block w-full overflow-hidden rounded-creator-card bg-creator-surface-2" style={aspect(image)}>
          <MediaImage src={image.src} focal={image.focal} alt={alt} sizes={sizes} />
        </span>
        <span className="sr-only">{enlarge(n)}</span>
      </a>
      <figcaption className="flex min-w-0 items-baseline gap-3 text-caption text-creator-fg-muted">
        <span aria-hidden className="font-semibold text-creator-accent-text tabular-nums">
          {projectNumber(n)}
        </span>
        {picture.caption?.trim() ? (
          <span dir="auto" data-caption className="min-w-0 break-words">
            {picture.caption}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

// ─── Next project ─────────────────────────────────────────────────────────────────────────────

type NextTarget = { project: Project; href: string } | { project: Project; open: () => void };

/** The next project in page order that has a page of its own, wrapping to the first; none when no other has one. */
function nextProject(projects: readonly Project[], current: Project, quotes: readonly Quotes[], places: Places): NextTarget | null {
  const at = projects.findIndex((candidate) => candidate.id === current.id);
  const order = [...projects.slice(at + 1), ...projects.slice(0, Math.max(0, at))];
  const found = order.find((candidate) => candidate.id !== current.id && hasDetail(candidate, quotes));
  if (!found) return null;
  if (places.base !== undefined) return { project: found, href: `${places.base}/${found.slug}${places.suffix}` };
  const open = places.onOpenProject;
  return open ? { project: found, open: () => open(found.id) } : null;
}

/** One list-style row on to the next project: its label, its title set large, its sentence and its cover. */
function NextProject({ next }: { next: NextTarget }) {
  const t = useTranslations("creator");
  const { project } = next;
  const thumb = coverMode(project) === "picture" || (coverMode(project) === "figure" && figureSize(project.results?.[0]?.value ?? "") === "lg");
  const body = (
    <>
      <span className="grid min-w-0 flex-1 gap-1 text-start">
        <span className="text-small font-semibold text-creator-accent-text">{t("portfolio.nextProject")}</span>
        <span dir="auto" className={cn(pageSide, TITLE, "font-creator-display text-h2 leading-tight @work:text-display-sm")} style={displayStyle}>
          {project.title}
        </span>
        <span dir="auto" className={cn(pageSide, "line-clamp-2 text-small break-words text-creator-fg-muted @work:text-body")}>
          {project.summary}
        </span>
      </span>
      {thumb ? (
        <span className="w-20 shrink-0 @work:w-1/5">
          <ProjectCover project={project} sizes={mediaSizes.workRowEnd} ratio="aspect-square @work:aspect-photo" size="thumb" />
        </span>
      ) : null}
      <Icon icon={ChevronRight} size="md" className="shrink-0 text-creator-fg-muted" />
    </>
  );
  const row = "flex min-h-20 w-full min-w-0 items-center gap-4 rounded-creator-card py-6 @work:gap-6";
  return (
    <nav aria-label={t("portfolio.nextProject")} className="min-w-0 border-y border-creator-line">
      {"href" in next ? (
        <a href={next.href} className={cn(row, pressable)}>
          {body}
        </a>
      ) : (
        <button type="button" onClick={next.open} className={cn(row, pressable)}>
          {body}
        </button>
      )}
    </nav>
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────────────────────

export type ProjectLookup = { kind: "found"; project: Project } | { kind: "moved"; slug: string } | null;

/**
 * Which project an address part names on a page: an active project with that slug (the first in
 * page order when a slug is stored twice), else the active project that used it before (`was`, the
 * route redirects there), else none. Hidden and scheduled-out projects answer none: their address
 * says "not found" like any unknown one.
 */
export function findProject(page: Page, slug: string, now: Date = new Date()): ProjectLookup {
  const projects = page.blocks.filter((block): block is Project => block.type === "project" && isBlockActive(block, now));
  const found = projects.find((project) => project.slug === slug);
  if (found) return { kind: "found", project: found };
  const moved = projects.find((project) => project.was?.includes(slug));
  return moved ? { kind: "moved", slug: moved.slug } : null;
}

/** Whether metadata marks the project as AI-written (AI Act Art. 50(2)). */
export const isAiProject = (project: Project): boolean => isAi(project);

// ─── Structured data ──────────────────────────────────────────────────────────────────────────

/**
 * schema.org data in the HTML (no request): the code for a project read from a repository, else the
 * work. Never the client (a confidential one has no name anyway, and the others stay off it too).
 */
export function structuredData(page: Page, project: Project): Record<string, unknown> {
  const author = { "@type": "Person", name: page.profile.displayName };
  if (project.source) {
    return {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: project.title,
      description: project.summary,
      codeRepository: repositoryUrl(project.source),
      ...(project.source.language ? { programmingLanguage: project.source.language } : {}),
      author,
    };
  }
  const image = hasImage(project.cover) && project.cover.src.startsWith("https://") ? project.cover.src : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    ...(project.year ? { dateCreated: String(project.year.from) } : {}),
    ...(project.tags?.length ? { keywords: project.tags.join(", ") } : {}),
    creator: author,
    ...(image ? { image } : {}),
  };
}
