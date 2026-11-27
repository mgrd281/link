import { hasImage, isBlockActive, type Block, type BlockOf, type Page, type Profile } from "@linkyo/blocks";
import { coverImage, coverMode, primaryAction } from "@linkyo/blocks/project";
import { FEATURED_PROJECTS } from "@linkyo/blocks/rules";
import type { CreatorButtonStyle } from "@linkyo/tokens";
import type { CreatorLayout, HeadingStyle, ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useId, type CSSProperties, type ReactNode } from "react";

import { themeStyle } from "@/features/creator/theme";
import { targetFacts, type DocumentsView } from "@/features/documents/offer";

import { CreatorFooter, MediaImage, mediaSizes, type CreatorFooterLinks } from "../shared/creator-kit";
import { PrivacyNotice } from "../shared/privacy-notice";
import { Unblur } from "../shared/unblur";
import { externalProviders } from "../shared/providers";
import {
  BrandGrid,
  FeaturedCard,
  FeaturedRelease,
  LiveRow,
  NewsletterCard,
  ProductGrid,
  ProductRow,
  RowGroup,
  ShortsRail,
  TextLink,
  VideoFeature,
  VideoRail,
} from "./cards";
import { AppFeature, AppList, RepoCard } from "./apps";
import { EventTabs } from "./events";
import { PosterBar, PosterHero } from "./hero";
import { JustifiedRows, ratioOf, WIDE_ROW } from "./justified";
// Laufbahn's index, its contents and the blocks it reads in its own way load with its pages only: these
// client modules split them off (ADR 0008's page budget). Its bleed hero and its words are plain server code.
import { LaufbahnAbout, LaufbahnSkills, LaufbahnText, LaufbahnTimeline } from "./signposted-blocks";
import { isLetter } from "./laufbahn-content";
import { DossierHero, type HeadFacts } from "./laufbahn-hero";
import { SignpostedBody } from "./signposted-lazy";
import { ReadmeHero, StripHero, TitleBlockHero } from "./portfolio-heroes";
import { AboutSection, BrandNames, ContactBand, QuotesSection, TimelineSection, ToolsSection } from "./portfolio-sections";
import { ProjectPage } from "./project-page";
import { ProjectPlate, ProjectsGroup, ProjectStrip } from "./projects";
import { featuredApp, groupSections, type PosterItem, type PosterSection as Section } from "./sections";
import { cardSurface, pageSide, pressable, railFrame, sectionTitle, type HeadingTag } from "./styles";

/** Leuchttisch's strip holds the first covers of the work: at most five, at least three when there are three. */
const STRIP_MAX = 5;
const STRIP_MIN = 3;

/**
 * The projects Leuchttisch's strip shows: the run's first projects with a picture, in a row (it stops at
 * the first without one), five at most. Of three or more, the count whose ratios come closest to a row
 * of the canvas (`WIDE_ROW`), so the strip stands as tall as the rows of work below it.
 */
export function stripProjects(run: readonly BlockOf<"project">[]): BlockOf<"project">[] {
  const leading: BlockOf<"project">[] = [];
  for (const project of run.slice(0, Math.min(STRIP_MAX, FEATURED_PROJECTS))) {
    if (coverMode(project) !== "picture") break;
    leading.push(project);
  }
  if (leading.length <= STRIP_MIN) return leading;
  const ratios = leading.map((project) => ratioOf(coverImage(project)));
  let best = STRIP_MIN;
  for (let count = STRIP_MIN; count <= leading.length; count += 1) {
    const sum = (n: number) => ratios.slice(0, n).reduce((total, ratio) => total + ratio, 0);
    if (Math.abs(sum(count) - WIDE_ROW) < Math.abs(sum(best) - WIDE_ROW)) best = count;
  }
  return leading.slice(0, best);
}

/**
 * Direction D — "Poster": the creator as a headliner.
 * A template chooses the look (colors, fonts, hero treatment, section titles, backdrop, motion); the
 * layout stays the same: a hero that fades away on scroll, then titled sections of flat cards — media
 * rows that turn into two-row rails when long, month tabs for dates, a two-up shop, partner tiles,
 * video rails, photos in a rail (or a two-column grid for portfolios). A portfolio adds runs of
 * projects and its own sections; with `openProject` the renderer shows that project's page instead.
 *
 * Templates with the wide canvas (`layout.canvas`) leave the narrow column from desktop widths on:
 * work, pictures, about, quotes, clients and the contact band take the whole canvas; everything
 * else is read in a column beside its section title. Phones and every other template are unchanged.
 *
 * Signposted templates (Laufbahn, `layout.headings` "signpost") frame every titled section under a
 * hairline and add the page's contents (`./laufbahn`: the app bar's sheet on phones, an index beside
 * the sections on wider screens); their page runs edge to edge below the wide canvas, so the bleed
 * hero's picture can.
 *
 * Block marks (the contract per-block counts rely on): everything a block shows sits inside an element
 * with `data-block="<the block's id>"`, so `closest("[data-block]")` names the block of a click. A block
 * of its own (or a run of one) gets a wrapper here (`display: contents` on the page, so nothing moves);
 * in a longer run of rows, videos, products, apps or projects each block's own element carries it; in
 * the hero the socials, the contact action (hero and bar), the live pill and the plate's project carry
 * theirs. Ids never change with the template, the language or the layout. Section titles (header
 * blocks) are not marked. block-marks.test.ts holds every sample and example page to this.
 */
export function PosterRenderer({
  page,
  theme,
  preview = false,
  overlay,
  dock,
  footerLinks,
  projectBase,
  projectSuffix = "",
  openProject,
  onOpenProject,
  documents = null,
}: {
  page: Page;
  theme: ResolvedCreatorTheme;
  preview?: boolean;
  /** Shown over the top of the hero (e.g. a "preview" label); scrolls away with it. */
  overlay?: ReactNode;
  /** A bar pinned to the bottom that slides in once the hero has scrolled away. */
  dock?: ReactNode;
  /** Public pages: where the footer's imprint, privacy and report links lead. */
  footerLinks?: CreatorFooterLinks | undefined;
  /** Where project pages live: "/<username>" on public pages, "/<locale>/p/<slug>" on examples. Absent in previews. */
  projectBase?: string | undefined;
  /** Appended to every project address (the sample route's "?chrome=0&template=…"). Default "". */
  projectSuffix?: string | undefined;
  /** Show this project's page instead of the portfolio (dashboard preview, AI draft phone). */
  openProject?: { id: string; onBack: () => void } | undefined;
  /** Previews without a router: a tap on a card that has a project page. */
  onOpenProject?: ((id: string) => void) | undefined;
  /** Signposted templates (Laufbahn): the CV and cover letter the page offers as PDFs (features/documents/view.ts). */
  documents?: DocumentsView | null | undefined;
}) {
  const { profile } = page;
  const now = new Date();
  const blocks = page.blocks.filter((block) => isBlockActive(block, now));
  // A project opened in place: its page stands where the portfolio stood, with the way back as a button.
  const opened = openProject ? blocks.find((block): block is BlockOf<"project"> => block.type === "project" && block.id === openProject.id) : undefined;
  if (openProject && opened) {
    return (
      <ProjectPage
        page={page}
        theme={theme}
        project={opened}
        base={projectBase}
        suffix={projectSuffix}
        onBack={openProject.onBack}
        onOpenProject={onOpenProject}
        footerLinks={footerLinks}
        preview={preview}
        overlay={overlay}
        dock={dock}
      />
    );
  }
  const socials = blocks.find((block): block is BlockOf<"socials"> => block.type === "socials");
  // Live now beats a planned live; either one gets a pill in the hero.
  const lives = blocks.filter((block): block is BlockOf<"live"> => block.type === "live");
  const live = lives.find((block) => block.isLive) ?? lives.find((block) => block.startsAt !== undefined);
  // One app on the page shows the official store badges; the trademarks are credited in the footer.
  const featured = featuredApp(blocks);
  const grouped = groupSections(blocks, featured);
  const isRtl = profile.locale === "ar";
  const photo = profile.hero ?? profile.avatar;
  const surface = cardSurface[theme.buttonStyle];
  // One button leads: on pages whose buttons are filled with the accent, the other links turn soft
  // as soon as one is highlighted, so the primary action keeps the color to itself.
  const linkStyle: CreatorButtonStyle = theme.buttonStyle === "filled" && blocks.some((block) => block.type === "link" && block.highlight) ? "soft" : theme.buttonStyle;
  const Main = preview ? "div" : "main";
  // Pages with embedded players get a privacy notice in the creator's colors (not inside the dashboard preview).
  const providers = preview ? [] : externalProviders(blocks);
  const { layout } = theme;
  // The blurred portrait behind the column suits photo-led heroes; the others bring their own backdrop,
  // and the portfolio heroes and the bleed hero stand on the plain page.
  const ambient =
    hasImage(photo) &&
    layout.backdrop === "none" &&
    layout.hero !== "halo" &&
    layout.hero !== "inset" &&
    layout.hero !== "frame" &&
    layout.hero !== "plate" &&
    layout.hero !== "statement" &&
    layout.hero !== "bleed" &&
    layout.hero !== "strip" &&
    layout.hero !== "titleblock" &&
    layout.hero !== "readme";
  // The wide canvas (layout.work), or the full one (Leuchttisch): pictures run to layout.wall, text
  // keeps the creator column. Both leave the narrow column from layout.work on.
  const wide = layout.canvas === "wide";
  const full = layout.canvas === "full";
  const canvas = wide || full;
  // Below layout.work the portfolio templates breathe more between sections than the column does.
  // Folio keeps the column's rhythm there: it came onto the wide canvas later (C-06), and its phone
  // layout stays as it was.
  const airy = canvas && theme.template !== "folio";
  // The page's one primary action comes from its contact block and from nowhere else.
  const primary = primaryAction(blocks, now);
  const contact = primary ? blocks.find((block): block is BlockOf<"contact"> => block.type === "contact") : undefined;
  // What the portfolio's blocks need to know about their page.
  const runs = grouped.flatMap((section) => section.items).filter((item) => item.kind === "projects");
  // The plate hero (Werkbogen) and the title block (Grundriss) open with the first project of the first
  // run (when the owner set no hero picture of their own): its picture, else its figure or title set
  // large (P-08). Leuchttisch's strip opens with the run's first covers. The run below then starts after them.
  const firstRun = runs[0];
  const first = firstRun?.blocks[0];
  const ownHero = hasImage(profile.hero);
  const lead = (layout.hero === "plate" || layout.hero === "titleblock") && !ownHero && first ? first : undefined;
  const strip = layout.hero === "strip" && firstRun ? stripProjects(firstRun.blocks) : [];
  const taken = lead ? 1 : strip.length;
  // A run the hero showed whole has nothing left to show; neither has a section that only held that run.
  const sections =
    firstRun && taken > 0 && firstRun.blocks.length <= taken
      ? grouped.flatMap((section): Section[] => {
          if (!section.items.includes(firstRun)) return [section];
          const items = section.items.filter((item) => item !== firstRun);
          return items.length > 0 ? [{ ...section, items }] : [];
        })
      : grouped;
  // The full canvas gives its width to pictures only: a section of work or pictures runs across it, every
  // other section keeps its words in the creator column beside its title. Inside a section of work,
  // everything but the work and the pictures keeps the creator column too (an intro, links, a quote).
  const spanOf = (section: Section): Section["span"] => (full ? (section.items.some(isPictureItem) ? "wide" : "text") : section.span);
  const inColumn = (section: Section, item: PosterItem) => full && spanOf(section) === "wide" && !isPictureItem(item);
  // Numbered titles count the titled sections: 01, 02 …
  const titled = sections.filter((section) => section.title !== null);
  // Signposted templates (Laufbahn) list the titled sections as the page's contents (`./signposted.tsx`).
  const signposted = layout.headings === "signpost";
  // Their cover letter: the bleed hero's first action may lead to it, and its text reads as a letter.
  const letter = signposted ? letterOf(sections, profile.locale) : undefined;
  // The position applied for (and the employer): the head shows them, About no longer repeats them.
  const head: HeadFacts = signposted ? targetFacts({ ...page, blocks }) : { target: null, employer: null };
  const projects = blocks.filter((block): block is BlockOf<"project"> => block.type === "project");
  const portfolio: PortfolioContext = {
    theme,
    locale: profile.locale,
    ownerName: profile.displayName,
    projects,
    quotes: blocks.filter((block): block is BlockOf<"quotes"> => block.type === "quotes"),
    runs,
    firstRun,
    taken,
    base: projectBase,
    suffix: projectSuffix,
    onOpen: onOpenProject,
    now,
    wide,
    ...(signposted ? { documents, head, paper: theme.palette.mode === "light" ? ("light" as const) : ("dark" as const) } : {}),
  };
  // The hero's own props, the same for every treatment.
  const heroProps = { profile, socials, live, theme, preview, contact, primary, now };
  const quotes = portfolio.quotes;
  const banner = overlay !== undefined && overlay !== null;
  // The bleed hero comes with Laufbahn's body (its first action needs the page's contents); every other
  // treatment is drawn here.
  const hero =
    layout.hero === "bleed" ? (
      signposted ? null : (
        <DossierHero
          profile={profile}
          socials={socials}
          live={live}
          theme={theme}
          preview={preview}
          contact={contact}
          primary={primary}
          now={now}
          lead={undefined}
          banner={banner}
        />
      )
    ) : layout.hero === "strip" ? (
      <StripHero
        {...heroProps}
        strip={
          strip.length > 0 && firstRun ? (
            <ProjectStrip projects={strip} total={firstRun.blocks.length} quotes={quotes} base={projectBase} suffix={projectSuffix} onOpen={onOpenProject} priority={!preview} />
          ) : undefined
        }
      />
    ) : layout.hero === "titleblock" ? (
      <TitleBlockHero
        {...heroProps}
        plate={
          lead && firstRun ? (
            <ProjectPlate
              project={lead}
              total={firstRun.blocks.length}
              theme={theme}
              locale={profile.locale}
              quotes={quotes}
              base={projectBase}
              suffix={projectSuffix}
              onOpen={onOpenProject}
              priority={!preview}
              drawing
            />
          ) : undefined
        }
      />
    ) : layout.hero === "readme" ? (
      <ReadmeHero
        {...heroProps}
        tools={blocks.find((block): block is BlockOf<"tools"> => block.type === "tools")}
        repos={projects.flatMap((project) => (project.source ? [`${project.source.owner}/${project.source.repo}`] : []))}
      />
    ) : (
      <PosterHero
        {...heroProps}
        plate={
          lead && firstRun ? (
            <ProjectPlate
              project={lead}
              total={firstRun.blocks.length}
              theme={theme}
              locale={profile.locale}
              quotes={quotes}
              base={projectBase}
              suffix={projectSuffix}
              onOpen={onOpenProject}
              priority={!preview}
            />
          ) : undefined
        }
      />
    );
  const itemProps = { linkStyle, surface, gallery: layout.gallery, featured, preview };
  // With a Linkyo bar at the bottom, the footer drops its own Linkyo credit (one is enough). On a
  // signposted page with a contact block it closes the ink Kontakt band, in the band's tone.
  const footer = (
    <CreatorFooter
      className={cn("px-creator-gutter", dock ? "pb-24" : undefined)}
      credit={!dock}
      privacy={providers.length > 0}
      trademarks={featured !== undefined}
      links={footerLinks}
      {...(signposted && contact ? { tone: "inverse" as const } : {})}
    />
  );

  return (
    <div
      lang={profile.locale}
      dir={isRtl ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      // The focus ring takes the page's accent text colour (AA on the page's own background, also on
      // dark templates); Linkyo's own chrome inside (`data-theme`) keeps its ring.
      className={cn("poster-scope @container relative isolate overflow-clip bg-creator-bg font-creator-body text-creator-fg [--color-focus:var(--creator-accent-text)]", preview ? "min-h-full" : "min-h-dvh")}
    >
      {/* Wide screens: the portrait becomes a soft ambient glow behind the column. Decorative. */}
      {ambient ? (
        <div aria-hidden className="absolute inset-x-0 top-0 hidden h-dvh overflow-hidden opacity-secondary @prose:block">
          <MediaImage src={photo.src} focal={photo.focal} alt="" sizes={mediaSizes.wide} className={cn("scale-lift blur-ambient", layout.hero === "mono" && "grayscale")} />
          <div className="absolute inset-0 bg-linear-to-b from-transparent to-creator-bg" />
        </div>
      ) : null}
      {/* Aura: the page's colors drift slowly along the page, behind frosted cards. Decorative. */}
      {layout.backdrop === "aurora" ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="poster-glow poster-glow-1" />
          <span className="poster-glow poster-glow-2" />
          <span className="poster-glow poster-glow-3" />
        </div>
      ) : null}
      {/* Signal: a fine grid that fades out down the first screen. Decorative. */}
      {layout.backdrop === "grid" ? <div aria-hidden className="poster-grid pointer-events-none absolute inset-x-0 top-0 h-dvh mask-b-from-20% mask-b-to-100%" /> : null}
      {/* Grundriss: hairline column guides behind the canvas's twelve columns, like a drawing's grid.
          Only on the canvas (never on phones) and never when the visitor asks for more contrast. Decorative. */}
      {layout.backdrop === "columns" ? (
        <div aria-hidden data-column-guides className="pointer-events-none absolute inset-0 hidden @work:block">
          {/* A hairline where each column starts, and one where the last ends, faint enough to read through. */}
          <div className="mx-auto grid h-full max-w-work box-content grid-cols-12 gap-x-6 px-creator-gutter opacity-secondary contrast-more:hidden">
            {Array.from({ length: 12 }, (_, index) => (
              <span key={index} className="border-s border-creator-line last:border-e" />
            ))}
          </div>
        </div>
      ) : null}

      {/* The wide canvas: from desktop widths the column grows to layout.work, keeping a gutter beside it;
          the full canvas grows to layout.wall. Signposted pages run edge to edge below it (their hero's
          picture does; the words keep a column). */}
      <div
        className={
          signposted
            ? "relative"
            : cn("relative mx-auto max-w-creator @prose:pt-10", wide && "@work:box-content @work:max-w-work @work:px-creator-gutter", full && "@work:box-content @work:max-w-wall @work:px-creator-gutter")
        }
      >
        {overlay ? <div className="pointer-events-none absolute inset-x-0 top-3 layer-raised flex justify-center px-creator-gutter @prose:top-12 *:pointer-events-auto">{overlay}</div> : null}
        {signposted ? (
          <SignpostedBody
            profile={profile}
            primary={primary}
            contact={contact}
            sections={sections}
            items={Object.fromEntries(
              sections.map((section) => [
                section.id,
                section.items.map((item) => (
                  <PosterItemView
                    key={itemKey(item)}
                    item={item}
                    {...itemProps}
                    label={section.title ?? profile.displayName}
                    nested={section.title !== null}
                    portfolio={{ ...portfolio, section: { title: section.title, letter: letter?.block } }}
                  />
                )),
              ]),
            )}
            marks={Object.fromEntries(
              sections.map((section) => [section.id, { blockIds: preview && section.title !== null ? section.id : undefined, ai: isAiBlock(blocks.find((block) => block.id === section.id)) }]),
            )}
            letter={letter}
            documents={documents}
            head={head}
            footer={footer}
            heroProps={heroProps}
            hero={hero}
            banner={banner}
            preview={preview}
          />
        ) : (
          <>
            <PosterBar profile={profile} primary={primary} primaryBlock={contact?.id} />
            {hero}
            {/* Marks the end of the hero: the Linkyo bar slides in once this has scrolled up. */}
            <div data-poster-sentinel aria-hidden />
          </>
        )}

        {/* A preview sits inside the dashboard, which already has the page's one <main>. */}
        {signposted ? null : (
          <Main
            className={
              airy
                ? "grid grid-cols-1 gap-16 px-creator-gutter pt-12 @prose:gap-20 @prose:px-0 @work:gap-24 @work:pt-20"
                : cn("grid grid-cols-1 gap-10 px-creator-gutter pt-10 @prose:px-0", canvas && "@work:gap-24 @work:pt-20")
            }
          >
            {sections.map((section) => (
              <PosterSection
                key={section.id}
                title={section.title}
                headings={layout.headings}
                number={titled.indexOf(section) + 1}
                reveal={layout.motion === "reveal"}
                // The dashboard's preview finds the block being edited by these ids (a section by its title block).
                blockIds={preview && section.title !== null ? section.id : undefined}
                ai={isAiBlock(blocks.find((block) => block.id === section.id))}
                wide={canvas}
                airy={airy}
                span={spanOf(section)}
                // A section of work says how many projects it holds, the hero plate's project included.
                projects={section.items.reduce((count, item) => (item.kind === "projects" ? count + item.blocks.length : count), 0)}
              >
                {section.items.map((item) => {
                  const view = (
                    <PosterItemView
                      key={itemKey(item)}
                      item={item}
                      linkStyle={linkStyle}
                      surface={surface}
                      label={section.title ?? profile.displayName}
                      nested={section.title !== null}
                      gallery={layout.gallery}
                      featured={featured}
                      portfolio={portfolio}
                      preview={preview}
                    />
                  );
                  return inColumn(section, item) ? (
                    <div key={itemKey(item)} data-column-item className="min-w-0 @work:max-w-creator">
                      {view}
                    </div>
                  ) : (
                    view
                  );
                })}
              </PosterSection>
            ))}
          </Main>
        )}
        {/* Laufbahn draws its footer itself (inside its closing Kontakt band, on ink). */}
        {signposted ? null : footer}
        {dock}
        {/* Over everything, including the claim bar, until the visitor has decided. */}
        {providers.length > 0 ? <PrivacyNotice providers={providers} /> : null}
        <Unblur />
      </div>
    </div>
  );
}

const itemKey = (item: PosterItem): string => (item.kind === "block" ? item.block.id : `${item.kind}-${item.blocks[0]?.id ?? ""}`);

/** Work or pictures: what the full canvas (Leuchttisch) lets run across layout.wall. */
const isPictureItem = (item: PosterItem): boolean => item.kind === "projects" || (item.kind === "block" && item.block.type === "gallery");

/** Written by an AI draft, edited afterwards or not (machine-readable marking, AI Act Art. 50(2)). */
const isAiBlock = (block: Block | undefined): boolean => block?.origin === "ai" || block?.origin === "ai-edited";

/** `data-ai-generated` on an element that shows AI-written content; nothing otherwise. */
const aiMark = (ai: boolean) => (ai ? { "data-ai-generated": "true" } : {});

/**
 * A titled section (or an untitled run of blocks). Titles follow the template: numbered ("01" in the
 * accent, then the title in caps), ruled (the title, then a hairline to the end of the line), or
 * monospace ("//" in the accent). With motion "reveal" the section rises in as it scrolls into view.
 *
 * Portfolio titles: a small numbered caption under a hairline that crosses the section, with the
 * number of projects at the inline end (marker), or the display face set large after a small number
 * (headline). On the wide canvas a section is a grid: "wide" sections put their content under the
 * title on all twelve columns, "text" sections put the title in the first four and the content in
 * the reading column beside it. The split is a grid, so reading, tab and source order never change.
 */
function PosterSection({
  title,
  headings,
  number,
  reveal,
  blockIds,
  ai,
  wide,
  airy = wide,
  span,
  projects,
  children,
}: {
  title: string | null;
  headings: HeadingStyle;
  number: number;
  reveal: boolean;
  blockIds?: string | undefined;
  /** The title comes from an AI-written block. */
  ai: boolean;
  /** The template uses the wide (or the full) canvas. */
  wide: boolean;
  /** Below the canvas, more room between a title and its content (the portfolio templates; not Folio). */
  airy?: boolean | undefined;
  span: Section["span"];
  /** How many projects the section holds (0 for a section without work). */
  projects: number;
  children: ReactNode;
}) {
  const id = useId();
  const t = useTranslations("creator");
  if (wide) {
    const beside = span === "text";
    const heading = sectionTitle(headings);
    const marker = headings === "marker";
    const count = String(number).padStart(2, "0");
    const Box = title === null ? "div" : "section";
    return (
      <Box
        aria-labelledby={title === null ? undefined : id}
        data-block-ids={blockIds}
        className={cn(
          "grid min-w-0 grid-cols-1",
          airy ? "gap-4 @prose:gap-6" : "gap-3 @work:gap-6",
          beside && "@work:grid-cols-12 @work:gap-x-6",
          title !== null && marker && "border-t border-creator-line pt-3",
          reveal && "poster-reveal",
        )}
      >
        {title === null ? null : marker ? (
          <div className={cn("flex min-w-0 items-baseline justify-between gap-4", beside && "@work:col-span-4 @work:self-start")}>
            <h2 id={id} className={heading.className} style={heading.style} {...aiMark(ai)}>
              <span aria-hidden className="text-creator-accent-text tabular-nums">
                {count}
              </span>
              <span dir="auto" className={cn(pageSide, "min-w-0 text-balance break-words")}>
                {title}
              </span>
            </h2>
            {projects > 0 ? <p className="shrink-0 text-small text-creator-fg-muted tabular-nums">{t("portfolio.projectCount", { count: projects })}</p> : null}
          </div>
        ) : (
          // Beside its content a title stands at the top of the section, not in the middle of a long list
          // (the numbered, rule and mono titles centre their own parts with items-center).
          <h2 id={id} className={cn(heading.className, beside && "@work:col-span-4 @work:self-start")} style={heading.style} {...aiMark(ai)}>
            {headings === "headline" || headings === "numbered" ? (
              // The number is a small figure in the body face, whatever the title's own face.
              <span aria-hidden className={cn("text-creator-accent-text tabular-nums", headings === "headline" && "font-creator-body text-small font-semibold tracking-normal")}>
                {count}
              </span>
            ) : headings === "mono" ? (
              <span aria-hidden className="text-creator-accent-text">
                {"//"}
              </span>
            ) : null}
            <span dir="auto" className={cn(pageSide, "min-w-0")}>
              {title}
            </span>
            {headings === "rule" ? <span aria-hidden className="h-px min-w-6 flex-1 bg-creator-line-strong" /> : null}
          </h2>
        )}
        <div className={cn("grid min-w-0 grid-cols-1 gap-3", beside && "@work:col-span-8 @work:col-start-5 @work:max-w-creator")}>{children}</div>
      </Box>
    );
  }
  if (title === null)
    return (
      <div data-block-ids={blockIds} className={cn("grid min-w-0 grid-cols-1 gap-3", reveal && "poster-reveal")}>
        {children}
      </div>
    );
  const heading = sectionTitle(headings);
  return (
    <section aria-labelledby={id} data-block-ids={blockIds} className={cn("grid min-w-0 grid-cols-1 gap-3", reveal && "poster-reveal")}>
      <h2 id={id} className={heading.className} style={heading.style} {...aiMark(ai)}>
        {headings === "numbered" ? (
          <span aria-hidden className="text-creator-accent-text tabular-nums">
            {String(number).padStart(2, "0")}
          </span>
        ) : headings === "mono" ? (
          <span aria-hidden className="text-creator-accent-text">
            {"//"}
          </span>
        ) : null}
        <span dir="auto" className={cn(pageSide, "min-w-0")}>{title}</span>
        {headings === "rule" ? <span aria-hidden className="h-px min-w-6 flex-1 bg-creator-line-strong" /> : null}
      </h2>
      {children}
    </section>
  );
}

/** What a portfolio's blocks need from their page: its projects and quotes, where project pages live, the canvas. */
interface PortfolioContext {
  theme: ResolvedCreatorTheme;
  locale: Profile["locale"];
  ownerName: string;
  projects: BlockOf<"project">[];
  quotes: BlockOf<"quotes">[];
  /** The page's runs of projects, in page order. */
  runs: PosterItem[];
  /** The first run, and how many of its first projects the hero shows (the plate's one, the strip's few). */
  firstRun: PosterItem | undefined;
  taken: number;
  base: string | undefined;
  suffix: string;
  onOpen: ((id: string) => void) | undefined;
  now: Date;
  /** The wide canvas: the portfolio's sections spread over it (the full canvas keeps them in the column). */
  wide: boolean;
  /** Signposted templates: the section's title (a note's icon comes from it) and the page's cover letter block. */
  section?: { title: string | null; letter: string | undefined };
  /** Signposted templates: the documents the page offers, the head's facts (About leaves them out) and the letter's paper. */
  documents?: DocumentsView | null;
  head?: HeadFacts;
  paper?: "light" | "dark";
}

/** The page's cover letter (signposted templates): the first titled section whose text is a letter, and that text block. */
function letterOf(sections: readonly Section[], locale: Profile["locale"]): { section: string; block: string } | undefined {
  for (const section of sections) {
    for (const item of section.items) {
      if (section.title !== null && item.kind === "block" && item.block.type === "text" && isLetter(section.title, item.block.text, locale)) {
        return { section: section.id, block: item.block.id };
      }
    }
  }
  return undefined;
}

interface ItemProps {
  item: PosterItem;
  linkStyle: CreatorButtonStyle;
  surface: string;
  label: string;
  nested: boolean;
  gallery: CreatorLayout["gallery"];
  featured: string | undefined;
  portfolio: PortfolioContext;
}

/**
 * One item of a section. In the dashboard's preview it is wrapped in a box that names the blocks it
 * shows, so the preview can scroll to (and outline) the block being edited; the page itself renders
 * the item in a box that takes no room. An item of one block is named on that box (`data-block`, see
 * the block marks above; a longer run's blocks carry their own). AI-written content is marked
 * `data-ai-generated` there too.
 */
function PosterItemView({ preview, ...props }: ItemProps & { preview: boolean }) {
  const { item } = props;
  const blocks: readonly Block[] = item.kind === "block" ? [item.block] : item.blocks;
  // A grouped item (a run of rows, videos, products or apps) is marked when any of its blocks is.
  const ai = blocks.some(isAiBlock);
  // A block of its own, or a run of one (a single video or product is drawn without its run's list).
  const only = blocks.length === 1 ? blocks[0] : undefined;
  const mark = only ? { "data-block": only.id } : {};
  if (!preview) {
    return ai || only ? (
      <div className="contents" {...mark} {...aiMark(ai)}>
        <PosterItemBody {...props} />
      </div>
    ) : (
      <PosterItemBody {...props} />
    );
  }
  return (
    <div data-block-ids={blocks.map((block) => block.id).join(" ")} className="min-w-0" {...mark} {...aiMark(ai)}>
      <PosterItemBody {...props} />
    </div>
  );
}

function PosterItemBody({ item, linkStyle, surface, label, nested, gallery, featured, portfolio }: ItemProps) {
  const t = useTranslations("creator");
  switch (item.kind) {
    case "projects":
      return (
        <>
          {/* A run of work under no title still has its place in the page's outline. */}
          {nested ? null : <h2 className="sr-only">{t("portfolio.work")}</h2>}
          <ProjectsGroup
            blocks={item.blocks}
            groupIndex={Math.max(0, portfolio.runs.indexOf(item))}
            leadTaken={item === portfolio.firstRun && portfolio.taken > 0}
            taken={item === portfolio.firstRun ? portfolio.taken : 0}
            theme={portfolio.theme}
            locale={portfolio.locale}
            quotes={portfolio.quotes}
            base={portfolio.base}
            suffix={portfolio.suffix}
            onOpen={portfolio.onOpen}
            numbered={portfolio.theme.layout.headings === "marker" || portfolio.theme.layout.headings === "headline"}
          />
        </>
      );
    case "videos":
      return item.blocks.length > 1 ? <VideoRail videos={item.blocks} /> : <VideoFeature video={item.blocks[0]} />;
    case "products":
      return item.blocks.length > 1 ? <ProductGrid products={item.blocks} surface={surface} /> : <ProductRow product={item.blocks[0]} surface={surface} />;
    case "apps":
      return <AppList apps={item.blocks} surface={surface} heading={nested ? "h3" : "h2"} />;
    case "rows":
      return <RowGroup blocks={item.blocks} surface={surface} label={label} />;
    case "block":
      return <PosterBlock block={item.block} linkStyle={linkStyle} surface={surface} heading={nested ? "h3" : "h2"} gallery={gallery} featured={featured} portfolio={portfolio} />;
  }
}

function PosterBlock({
  block,
  linkStyle,
  surface,
  heading,
  gallery,
  featured,
  portfolio,
}: {
  block: Block;
  linkStyle: CreatorButtonStyle;
  surface: string;
  heading: HeadingTag;
  gallery: CreatorLayout["gallery"];
  featured?: string | undefined;
  portfolio: PortfolioContext;
}) {
  const t = useTranslations("creator");
  // Signposted templates (Laufbahn) read about, skills, experience and text in their own calm way.
  const signposted = portfolio.theme.layout.headings === "signpost";
  if (signposted) {
    if (block.type === "about") return <LaufbahnAbout block={block} omit={[portfolio.head?.target, portfolio.head?.employer].filter((fact) => fact !== null && fact !== undefined)} />;
    if (block.type === "tools") return <LaufbahnSkills block={block} locale={portfolio.locale} />;
    if (block.type === "timeline") return <LaufbahnTimeline block={block} locale={portfolio.locale} />;
    if (block.type === "text") {
      const letter = portfolio.section?.letter === block.id;
      const pdf = letter ? portfolio.documents?.letter : null;
      return (
        <LaufbahnText
          text={block.text}
          title={portfolio.section?.title ?? null}
          letter={letter}
          locale={portfolio.locale}
          pdf={pdf ? { href: pdf.href, filename: pdf.filename, pages: pdf.pages } : null}
          subject={letter ? (portfolio.documents?.subject ?? null) : null}
          paper={portfolio.paper ?? "light"}
        />
      );
    }
  }
  switch (block.type) {
    case "music":
      return <FeaturedRelease block={block} surface={surface} heading={heading} />;
    case "card":
      return <FeaturedCard block={block} surface={surface} />;
    case "link":
      return <TextLink block={block} style={linkStyle} />;
    case "live":
      return <LiveRow block={block} surface={surface} />;
    case "events":
      return <EventTabs items={block.items} surface={surface} />;
    case "shorts":
      return <ShortsRail block={block} />;
    case "brands":
      // Partners with logos are tiles; clients without any logo are a list of names.
      return block.items.some((item) => hasImage(item.logo)) ? <BrandGrid block={block} /> : <BrandNames block={block} />;
    case "about":
      // Werkbogen (marker titles) sets the lead in its display face; Tiefdruck and the others in the body face.
      return <AboutSection block={block} wide={portfolio.wide} lead={portfolio.theme.layout.headings === "marker" ? "display" : "body"} />;
    case "tools":
      return <ToolsSection block={block} />;
    case "timeline":
      return <TimelineSection block={block} locale={portfolio.locale} />;
    case "quotes":
      return <QuotesSection block={block} ownerName={portfolio.ownerName} projects={portfolio.projects} base={portfolio.base} suffix={portfolio.suffix} wide={portfolio.wide} />;
    case "contact":
      return <ContactBand block={block} now={portfolio.now} wide={portfolio.wide} />;
    case "newsletter":
      return <NewsletterCard block={block} surface={surface} heading={heading} />;
    case "gallery":
      // Leuchttisch: every picture uncropped, in rows of equal height across the canvas.
      if (gallery === "justified") {
        return (
          <JustifiedRows
            items={block.images.map((image) => ({ key: image.src, ratio: ratioOf(image), image }))}
            label={block.title ?? t("gallery")}
            canvas={portfolio.theme.layout.canvas === "full" ? "wall" : "work"}
            render={({ image }, _index, sizes) => (
              <div style={{ "--ratio": ratioOf(image) } as CSSProperties} className="relative aspect-(--ratio) w-full overflow-hidden bg-creator-surface-2">
                <MediaImage src={image.src} focal={image.focal} alt={image.alt} sizes={sizes} />
              </div>
            )}
          />
        );
      }
      // Portfolios: the work in two columns, tall and square pictures alternating like a contact sheet.
      if (gallery === "grid") {
        return (
          // On the wide canvas the sheet has four columns.
          <ul aria-label={block.title ?? t("gallery")} className={cn("columns-2 gap-2", portfolio.wide && "@work:columns-4 @work:gap-4")}>
            {block.images.map((image, index) => (
              <li
                key={image.src}
                className={cn("relative mb-2 break-inside-avoid overflow-hidden rounded-creator-card", portfolio.wide && "@work:mb-4", index % 3 === 0 ? "aspect-portrait" : "aspect-square")}
              >
                <MediaImage src={image.src} focal={image.focal} alt={image.alt} sizes={portfolio.wide ? mediaSizes.workQuarter : mediaSizes.half} />
              </li>
            ))}
          </ul>
        );
      }
      return (
        // Photos hold nothing to tab to, so the region itself scrolls and takes focus (arrow keys scroll it).
        // Scroll padding as wide as the gutter puts the first snap point where the first photo starts.
        <div
          role="region"
          aria-label={t("scroller", { title: block.title ?? t("gallery") })}
          tabIndex={0}
          className={cn(railFrame, "snap-x scroll-px-creator-gutter overflow-x-auto @prose:scroll-px-0")}
        >
          <ul className="flex gap-2 px-creator-gutter @prose:px-0">
            {block.images.map((image) => (
              <li key={image.src} className="relative aspect-portrait w-3/5 shrink-0 snap-start overflow-hidden rounded-creator-card">
                <MediaImage src={image.src} focal={image.focal} alt={image.alt} sizes={mediaSizes.half} />
              </li>
            ))}
          </ul>
        </div>
      );
    case "image": {
      const picture = (
        <span className="relative block aspect-portrait overflow-hidden rounded-creator-card">
          <MediaImage src={block.image.src} focal={block.image.focal} alt={block.image.alt} sizes={mediaSizes.column} />
        </span>
      );
      return block.url ? (
        <a href={block.url} className={cn("block rounded-creator-card", pressable)}>
          {picture}
        </a>
      ) : (
        picture
      );
    }
    case "text":
      // Paragraphs typed in the editor's text area stay paragraphs on the page.
      return <p dir="auto" className="text-body text-creator-fg-muted whitespace-pre-line">{block.text}</p>;
    case "divider":
      return <hr className="border-creator-line" />;
    case "video":
      return <VideoFeature video={block} />;
    case "product":
      return <ProductRow product={block} surface={surface} />;
    case "app":
      return block.id === featured ? <AppFeature block={block} surface={surface} heading={heading} /> : <AppList apps={[block]} surface={surface} heading={heading} />;
    case "repo":
      return <RepoCard block={block} surface={surface} heading={heading} />;
    // Projects never arrive one by one: `groupSections` gathers every run (see PosterItemBody).
    case "project":
    case "header":
    case "socials":
      return null;
  }
}
