import { hasImage, isBlockActive, type Block, type BlockOf, type Page, type Profile } from "@linkyo/blocks";
import { coverMode, primaryAction } from "@linkyo/blocks/project";
import type { CreatorButtonStyle } from "@linkyo/tokens";
import type { CreatorLayout, HeadingStyle, ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { themeStyle } from "@/features/creator/theme";

import { CreatorFooter, MediaImage, mediaSizes, type CreatorFooterLinks } from "../shared/creator-kit";
import { PrivacyNotice } from "../shared/privacy";
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
import { LaufbahnAbout, LaufbahnSkills, LaufbahnText, LaufbahnTimeline, SignpostIndex, SignpostSection, signposts as signpostsOf } from "./laufbahn";
import { isLetter } from "./laufbahn-content";
import { BleedHero, type Lead } from "./laufbahn-hero";
import { AboutSection, BrandNames, ContactBand, QuotesSection, TimelineSection, ToolsSection } from "./portfolio-sections";
import { ProjectPage } from "./project-page";
import { ProjectPlate, ProjectsGroup } from "./projects";
import { featuredApp, groupSections, type PosterItem, type PosterSection as Section } from "./sections";
import { cardSurface, pageSide, pressable, railFrame, sectionTitle, type HeadingTag } from "./styles";

/** The start of a signposted page's content: "read on" leads here when the first section has no title. */
const CONTENT_ID = "page-content";

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
    layout.hero !== "bleed";
  const wide = layout.canvas === "wide";
  // The page's one primary action comes from its contact block and from nowhere else.
  const primary = primaryAction(blocks, now);
  const contact = primary ? blocks.find((block): block is BlockOf<"contact"> => block.type === "contact") : undefined;
  // What the portfolio's blocks need to know about their page.
  const runs = grouped.flatMap((section) => section.items).filter((item) => item.kind === "projects");
  // The plate hero opens with the first project of the first run when that has a picture (and the
  // owner set no hero picture of their own): the run below then starts at its second project.
  const firstRun = runs[0];
  const first = firstRun?.blocks[0];
  const lead = layout.hero === "plate" && !hasImage(profile.hero) && first && coverMode(first) === "picture" ? first : undefined;
  // A run that only held the plate's project has nothing left to show; neither has a section that only held that run.
  const sections =
    lead && firstRun?.blocks.length === 1
      ? grouped.flatMap((section): Section[] => {
          if (!section.items.includes(firstRun)) return [section];
          const items = section.items.filter((item) => item !== firstRun);
          return items.length > 0 ? [{ ...section, items }] : [];
        })
      : grouped;
  // Numbered titles count the titled sections: 01, 02 …
  const titled = sections.filter((section) => section.title !== null);
  // Signposted templates (Laufbahn) list the titled sections as the page's contents.
  const signposted = layout.headings === "signpost";
  const signposts = signposted ? signpostsOf(sections) : [];
  const firstSign = signposts[0];
  // Without a contact block the bleed hero's first action leads to the cover letter when the page has
  // one, else to the first section when that is titled, else to the start of the content (an untitled
  // run, a live card or a release first, is never skipped).
  const letter = signposted ? letterOf(sections, profile.locale) : undefined;
  const letterSign = letter ? signposts.find((sign) => sign.id === letter.section) : undefined;
  const heroLead: Lead | undefined = letterSign
    ? { href: `#${letterSign.anchor}`, kind: "letter" }
    : !firstSign
      ? undefined
      : sections[0]?.id === firstSign.id
        ? { href: `#${firstSign.anchor}`, kind: "section", title: firstSign.title }
        : { href: `#${CONTENT_ID}`, kind: "content" };
  const portfolio: PortfolioContext = {
    theme,
    locale: profile.locale,
    ownerName: profile.displayName,
    projects: blocks.filter((block): block is BlockOf<"project"> => block.type === "project"),
    quotes: blocks.filter((block): block is BlockOf<"quotes"> => block.type === "quotes"),
    runs,
    lead,
    base: projectBase,
    suffix: projectSuffix,
    onOpen: onOpenProject,
    now,
    wide,
  };

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

      {/* The wide canvas: from desktop widths the column grows to layout.work, keeping a gutter beside it.
          Signposted pages run edge to edge below it (their hero's picture does; the words keep a column). */}
      <div
        className={
          signposted
            ? "relative mx-auto @work:box-content @work:max-w-work @work:px-creator-gutter"
            : cn("relative mx-auto max-w-creator @prose:pt-10", wide && "@work:box-content @work:max-w-work @work:px-creator-gutter")
        }
      >
        {overlay ? <div className="pointer-events-none absolute inset-x-0 top-3 layer-raised flex justify-center px-creator-gutter @prose:top-12 *:pointer-events-auto">{overlay}</div> : null}
        <PosterBar profile={profile} primary={primary} solid={signposted} sections={signposts.length > 1 ? signposts.map(({ anchor, title }) => ({ anchor, title })) : undefined} />
        {layout.hero === "bleed" ? (
          <BleedHero
            profile={profile}
            socials={socials}
            live={live}
            theme={theme}
            preview={preview}
            contact={contact}
            primary={primary}
            now={now}
            lead={heroLead}
            banner={overlay !== undefined && overlay !== null}
          />
        ) : (
          <PosterHero
            profile={profile}
            socials={socials}
            live={live}
            theme={theme}
            preview={preview}
            contact={contact}
            primary={primary}
            now={now}
            plate={
              lead && firstRun ? (
                <ProjectPlate
                  project={lead}
                  total={firstRun.blocks.length}
                  theme={theme}
                  locale={profile.locale}
                  quotes={portfolio.quotes}
                  base={projectBase}
                  suffix={projectSuffix}
                  onOpen={onOpenProject}
                  priority={!preview}
                />
              ) : undefined
            }
          />
        )}
        {/* Marks the end of the hero: the Linkyo bar slides in once this has scrolled up. */}
        <div data-poster-sentinel aria-hidden />

        {/* A preview sits inside the dashboard, which already has the page's one <main>. */}
        {signposted ? (
          // Phones: the sections under the hero (their contents open from the app bar). Tablets: the index's
          // chips, then the sections, in the reading column. The wide canvas: the index sticky in the first
          // three columns, the sections in the last eight.
          <Main
            id={CONTENT_ID}
            className="grid grid-cols-1 gap-10 px-creator-gutter pt-10 @prose:mx-auto @prose:max-w-prose @prose:px-0 @work:max-w-none @work:grid-cols-12 @work:gap-x-6 @work:pt-24"
          >
            {signposts.length > 1 ? <SignpostIndex entries={signposts} /> : null}
            {/* Beside the index in the last eight columns; without an index in the first eight, under the hero's words. */}
            <div className={cn("relative grid min-w-0 grid-cols-1 gap-12 @work:col-span-8 @work:gap-16", signposts.length > 1 ? "@work:col-start-5" : "@work:col-start-1")}>
              {sections.map((section) => {
                // Skills and experience rise in tile by tile and step by step; the rest section by section
                // (then the tiles and steps inside do not rise a second time).
                const reveal = layout.motion !== "reveal" ? "none" : section.items.every((item) => item.kind === "block" && (item.block.type === "tools" || item.block.type === "timeline")) ? "self" : "section";
                return (
                  <SignpostSection
                    key={section.id}
                    entry={signposts.find((sign) => sign.id === section.id)}
                    blockIds={preview && section.title !== null ? section.id : undefined}
                    ai={isAiBlock(blocks.find((block) => block.id === section.id))}
                    reveal={reveal}
                  >
                    {section.items.map((item) => (
                      <PosterItemView
                        key={itemKey(item)}
                        item={item}
                        linkStyle={linkStyle}
                        surface={surface}
                        label={section.title ?? profile.displayName}
                        nested={section.title !== null}
                        gallery={layout.gallery}
                        featured={featured}
                        portfolio={{ ...portfolio, section: { title: section.title, letter: letter?.block }, ...(reveal === "self" ? {} : { revealItems: false }) }}
                        preview={preview}
                      />
                    ))}
                  </SignpostSection>
                );
              })}
              {/* The end of the content: once it is on screen, the index marks the last section. Out of the
                  grid's flow (absolute), so it adds no gap under the last section. */}
              <div data-lb-end aria-hidden className="absolute inset-x-0 bottom-0 h-px" />
            </div>
          </Main>
        ) : (
          <Main className={wide ? "grid grid-cols-1 gap-16 px-creator-gutter pt-12 @prose:gap-20 @prose:px-0 @work:gap-24 @work:pt-20" : "grid grid-cols-1 gap-10 px-creator-gutter pt-10 @prose:px-0"}>
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
                wide={wide}
                span={section.span}
                // A section of work says how many projects it holds, the hero plate's project included.
                projects={section.items.reduce((count, item) => (item.kind === "projects" ? count + item.blocks.length : count), 0)}
              >
                {section.items.map((item) => (
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
                ))}
              </PosterSection>
            ))}
          </Main>
        )}
        {/* With a Linkyo bar at the bottom, the footer drops its own Linkyo credit (one is enough). */}
        <CreatorFooter
          className={cn("px-creator-gutter", dock ? "pb-24" : undefined)}
          credit={!dock}
          privacy={providers.length > 0}
          trademarks={featured !== undefined}
          links={footerLinks}
        />
        {dock}
        {/* Over everything, including the claim bar, until the visitor has decided. */}
        {providers.length > 0 ? <PrivacyNotice providers={providers} /> : null}
      </div>
    </div>
  );
}

const itemKey = (item: PosterItem): string => (item.kind === "block" ? item.block.id : `${item.kind}-${item.blocks[0]?.id ?? ""}`);

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
  /** The template uses the wide canvas. */
  wide: boolean;
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
          "grid min-w-0 grid-cols-1 gap-4 @prose:gap-6",
          beside && "@work:grid-cols-12 @work:gap-x-6",
          title !== null && marker && "border-t border-creator-line pt-3",
          reveal && "poster-reveal",
        )}
      >
        {title === null ? null : marker ? (
          <div className={cn("flex min-w-0 items-baseline justify-between gap-4", beside && "@work:col-span-4")}>
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
          <h2 id={id} className={cn(heading.className, beside && "@work:col-span-4")} style={heading.style} {...aiMark(ai)}>
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
  /** The project the hero plate shows; its run starts at the second project. */
  lead: BlockOf<"project"> | undefined;
  base: string | undefined;
  suffix: string;
  onOpen: ((id: string) => void) | undefined;
  now: Date;
  wide: boolean;
  /** Signposted templates: false when the whole section rises in, so its tiles and steps do not rise again. */
  revealItems?: boolean;
  /** Signposted templates: the section's title (a note's icon comes from it) and the page's cover letter block. */
  section?: { title: string | null; letter: string | undefined };
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
 * the item as it is. AI-written content is marked `data-ai-generated` (on a box that takes no room).
 */
function PosterItemView({ preview, ...props }: ItemProps & { preview: boolean }) {
  const { item } = props;
  const blocks: readonly Block[] = item.kind === "block" ? [item.block] : item.blocks;
  // A grouped item (a run of rows, videos, products or apps) is marked when any of its blocks is.
  const ai = blocks.some(isAiBlock);
  if (!preview) {
    return ai ? (
      <div className="contents" {...aiMark(ai)}>
        <PosterItemBody {...props} />
      </div>
    ) : (
      <PosterItemBody {...props} />
    );
  }
  return (
    <div data-block-ids={blocks.map((block) => block.id).join(" ")} className="min-w-0" {...aiMark(ai)}>
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
            leadTaken={portfolio.lead !== undefined && item.blocks[0] === portfolio.lead}
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
  const reveal = portfolio.theme.layout.motion === "reveal" && portfolio.revealItems !== false;
  if (signposted) {
    if (block.type === "about") return <LaufbahnAbout block={block} />;
    if (block.type === "tools") return <LaufbahnSkills block={block} locale={portfolio.locale} reveal={reveal} />;
    if (block.type === "timeline") return <LaufbahnTimeline block={block} locale={portfolio.locale} reveal={reveal} />;
    if (block.type === "text") {
      return <LaufbahnText text={block.text} title={portfolio.section?.title ?? null} letter={portfolio.section?.letter === block.id} locale={portfolio.locale} />;
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
        <div role="region" aria-label={t("scroller", { title: block.title ?? t("gallery") })} tabIndex={0} className={cn(railFrame, "snap-x overflow-x-auto")}>
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
