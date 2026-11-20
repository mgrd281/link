import { hasImage, isBlockActive, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import type { CreatorButtonStyle } from "@linkyo/tokens";
import type { CreatorLayout, HeadingStyle, ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { themeStyle } from "@/features/creator/theme";

import { CreatorFooter, MediaImage, mediaSizes } from "../shared/creator-kit";
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
import { featuredApp, groupSections, type PosterItem } from "./sections";
import { cardSurface, pressable, railFrame, sectionTitle, type HeadingTag } from "./styles";

/**
 * Direction D — "Poster": the creator as a headliner.
 * A template chooses the look (colors, fonts, hero treatment, section titles, backdrop, motion); the
 * layout stays the same: a hero that fades away on scroll, then titled sections of flat cards — media
 * rows that turn into two-row rails when long, month tabs for dates, a two-up shop, partner tiles,
 * video rails, photos in a rail (or a two-column grid for portfolios).
 */
export function PosterRenderer({
  page,
  theme,
  preview = false,
  overlay,
  dock,
}: {
  page: Page;
  theme: ResolvedCreatorTheme;
  preview?: boolean;
  /** Shown over the top of the hero (e.g. a "preview" label); scrolls away with it. */
  overlay?: ReactNode;
  /** A bar pinned to the bottom that slides in once the hero has scrolled away. */
  dock?: ReactNode;
}) {
  const { profile } = page;
  const blocks = page.blocks.filter((block) => isBlockActive(block));
  const socials = blocks.find((block): block is BlockOf<"socials"> => block.type === "socials");
  // Live now beats a planned live; either one gets a pill in the hero.
  const lives = blocks.filter((block): block is BlockOf<"live"> => block.type === "live");
  const live = lives.find((block) => block.isLive) ?? lives.find((block) => block.startsAt !== undefined);
  // One app on the page shows the official store badges; the trademarks are credited in the footer.
  const featured = featuredApp(blocks);
  const sections = groupSections(blocks, featured);
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
  // The blurred portrait behind the column suits photo-led heroes; the others bring their own backdrop.
  const ambient = hasImage(photo) && layout.backdrop === "none" && layout.hero !== "halo" && layout.hero !== "inset" && layout.hero !== "frame";
  // Numbered titles count the titled sections: 01, 02 …
  const titled = sections.filter((section) => section.title !== null);

  return (
    <div
      lang={profile.locale}
      dir={isRtl ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      className={cn("poster-scope @container relative isolate overflow-clip bg-creator-bg font-creator-body text-creator-fg", preview ? "min-h-full" : "min-h-dvh")}
    >
      {/* Wide screens: the portrait becomes a soft ambient glow behind the column. Decorative. */}
      {ambient ? (
        <div aria-hidden className="absolute inset-x-0 top-0 hidden h-dvh overflow-hidden opacity-secondary @prose:block">
          <MediaImage src={photo.src} alt="" sizes={mediaSizes.wide} className={cn("scale-lift blur-ambient", layout.hero === "mono" && "grayscale")} />
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

      <div className="relative mx-auto max-w-creator @prose:pt-10">
        {overlay ? <div className="pointer-events-none absolute inset-x-0 top-3 layer-raised flex justify-center px-creator-gutter @prose:top-12 *:pointer-events-auto">{overlay}</div> : null}
        <PosterBar profile={profile} />
        <PosterHero profile={profile} socials={socials} live={live} theme={theme} preview={preview} />
        {/* Marks the end of the hero: the Linkyo bar slides in once this has scrolled up. */}
        <div data-poster-sentinel aria-hidden />

        {/* A preview sits inside the dashboard, which already has the page's one <main>. */}
        <Main className="grid grid-cols-1 gap-10 px-creator-gutter pt-10 @prose:px-0">
          {sections.map((section) => (
            <PosterSection
              key={section.id}
              title={section.title}
              headings={layout.headings}
              number={titled.indexOf(section) + 1}
              reveal={layout.motion === "reveal"}
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
                />
              ))}
            </PosterSection>
          ))}
        </Main>
        {/* With a Linkyo bar at the bottom, the footer drops its own Linkyo credit (one is enough). */}
        <CreatorFooter className={cn("px-creator-gutter", dock ? "pb-24" : undefined)} credit={!dock} privacy={providers.length > 0} trademarks={featured !== undefined} />
        {dock}
        {/* Over everything, including the claim bar, until the visitor has decided. */}
        {providers.length > 0 ? <PrivacyNotice providers={providers} /> : null}
      </div>
    </div>
  );
}

const itemKey = (item: PosterItem): string => (item.kind === "block" ? item.block.id : `${item.kind}-${item.blocks[0]?.id ?? ""}`);

/**
 * A titled section (or an untitled run of blocks). Titles follow the template: numbered ("01" in the
 * accent, then the title in caps), ruled (the title, then a hairline to the end of the line), or
 * monospace ("//" in the accent). With motion "reveal" the section rises in as it scrolls into view.
 */
function PosterSection({
  title,
  headings,
  number,
  reveal,
  children,
}: {
  title: string | null;
  headings: HeadingStyle;
  number: number;
  reveal: boolean;
  children: ReactNode;
}) {
  const id = useId();
  if (title === null) return <div className={cn("grid min-w-0 grid-cols-1 gap-3", reveal && "poster-reveal")}>{children}</div>;
  const heading = sectionTitle(headings);
  return (
    <section aria-labelledby={id} className={cn("grid min-w-0 grid-cols-1 gap-3", reveal && "poster-reveal")}>
      <h2 id={id} className={heading.className} style={heading.style}>
        {headings === "numbered" ? (
          <span aria-hidden className="text-creator-accent-text tabular-nums">
            {String(number).padStart(2, "0")}
          </span>
        ) : headings === "mono" ? (
          <span aria-hidden className="text-creator-accent-text">
            {"//"}
          </span>
        ) : null}
        <span className="min-w-0">{title}</span>
        {headings === "rule" ? <span aria-hidden className="h-px min-w-6 flex-1 bg-creator-line-strong" /> : null}
      </h2>
      {children}
    </section>
  );
}

function PosterItemView({
  item,
  linkStyle,
  surface,
  label,
  nested,
  gallery,
  featured,
}: {
  item: PosterItem;
  linkStyle: CreatorButtonStyle;
  surface: string;
  label: string;
  nested: boolean;
  gallery: CreatorLayout["gallery"];
  featured: string | undefined;
}) {
  switch (item.kind) {
    case "videos":
      return item.blocks.length > 1 ? <VideoRail videos={item.blocks} /> : <VideoFeature video={item.blocks[0]} />;
    case "products":
      return item.blocks.length > 1 ? <ProductGrid products={item.blocks} surface={surface} /> : <ProductRow product={item.blocks[0]} surface={surface} />;
    case "apps":
      return <AppList apps={item.blocks} surface={surface} heading={nested ? "h3" : "h2"} />;
    case "rows":
      return <RowGroup blocks={item.blocks} surface={surface} label={label} />;
    case "block":
      return <PosterBlock block={item.block} linkStyle={linkStyle} surface={surface} heading={nested ? "h3" : "h2"} gallery={gallery} featured={featured} />;
  }
}

function PosterBlock({
  block,
  linkStyle,
  surface,
  heading,
  gallery,
  featured,
}: {
  block: Block;
  linkStyle: CreatorButtonStyle;
  surface: string;
  heading: HeadingTag;
  gallery: CreatorLayout["gallery"];
  featured?: string | undefined;
}) {
  const t = useTranslations("creator");
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
      return <BrandGrid block={block} />;
    case "newsletter":
      return <NewsletterCard block={block} surface={surface} heading={heading} />;
    case "gallery":
      // Portfolios: the work in two columns, tall and square pictures alternating like a contact sheet.
      if (gallery === "grid") {
        return (
          <ul aria-label={block.title ?? t("gallery")} className="columns-2 gap-2">
            {block.images.map((image, index) => (
              <li key={image.src} className={cn("relative mb-2 break-inside-avoid overflow-hidden rounded-creator-card", index % 3 === 0 ? "aspect-portrait" : "aspect-square")}>
                <MediaImage src={image.src} alt={image.alt} sizes={mediaSizes.half} />
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
                <MediaImage src={image.src} alt={image.alt} sizes={mediaSizes.half} />
              </li>
            ))}
          </ul>
        </div>
      );
    case "image": {
      const picture = (
        <span className="relative block aspect-portrait overflow-hidden rounded-creator-card">
          <MediaImage src={block.image.src} alt={block.image.alt} sizes={mediaSizes.column} />
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
      return <p className="text-body text-creator-fg-muted">{block.text}</p>;
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
    case "header":
    case "socials":
      return null;
  }
}
