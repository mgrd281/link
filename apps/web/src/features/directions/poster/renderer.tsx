import { hasImage, isBlockActive, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import type { HeadingStyle, ResolvedCreatorTheme } from "@linkyo/tokens/creator";
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
import { EventTabs } from "./events";
import { PosterBar, PosterHero } from "./hero";
import { groupSections, type PosterItem } from "./sections";
import { cardSurface, pressable, railFrame, sectionTitle, type HeadingTag } from "./styles";

/**
 * Direction D — "Poster": the creator as a headliner.
 * A template chooses the look (colors, fonts, hero treatment, section titles); the layout stays the
 * same: a hero that fades away on scroll, then titled sections of flat cards — media rows that turn
 * into two-row rails when long, month tabs for dates, a two-up shop, partner tiles, video rails.
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
  const sections = groupSections(blocks);
  const isRtl = profile.locale === "ar";
  const photo = profile.hero ?? profile.avatar;
  const surface = cardSurface[theme.buttonStyle];
  const Main = preview ? "div" : "main";
  // Pages with embedded players get a privacy notice in the creator's colors (not inside the dashboard preview).
  const providers = preview ? [] : externalProviders(blocks);

  return (
    <div
      lang={profile.locale}
      dir={isRtl ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      className={cn("poster-scope @container relative isolate overflow-clip bg-creator-bg font-creator-body text-creator-fg", preview ? "min-h-full" : "min-h-dvh")}
    >
      {/* Wide screens: the portrait becomes a soft ambient glow behind the column. Decorative. */}
      {hasImage(photo) ? (
        <div aria-hidden className="absolute inset-x-0 top-0 hidden h-dvh overflow-hidden opacity-secondary @prose:block">
          <MediaImage src={photo.src} alt="" sizes={mediaSizes.wide} className="scale-lift blur-ambient" />
          <div className="absolute inset-0 bg-linear-to-b from-transparent to-creator-bg" />
        </div>
      ) : null}

      <div className="relative mx-auto max-w-creator @prose:pt-10">
        {overlay ? <div className="absolute inset-x-0 top-3 layer-raised flex justify-center px-creator-gutter @prose:top-12">{overlay}</div> : null}
        <PosterBar profile={profile} />
        <PosterHero profile={profile} socials={socials} live={live} theme={theme} preview={preview} />

        {/* A preview sits inside the dashboard, which already has the page's one <main>. */}
        <Main className="grid grid-cols-1 gap-10 px-creator-gutter pt-10 @prose:px-0">
          {sections.map((section) => (
            <PosterSection key={section.id} title={section.title} headings={theme.layout.headings}>
              {section.items.map((item) => (
                <PosterItemView key={itemKey(item)} item={item} theme={theme} surface={surface} label={section.title ?? profile.displayName} nested={section.title !== null} />
              ))}
            </PosterSection>
          ))}
        </Main>
        {/* With a Linkyo bar at the bottom, the footer drops its own Linkyo credit (one is enough). */}
        <CreatorFooter className={cn("px-creator-gutter", dock ? "pb-24" : undefined)} credit={!dock} privacy={providers.length > 0} />
        {dock ? (
          <div className="pointer-events-none sticky bottom-0 layer-sticky h-0">
            <div className="poster-dock pointer-events-auto absolute inset-x-0 bottom-0 px-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))]">{dock}</div>
          </div>
        ) : null}
        {/* Over everything, including the claim bar, until the visitor has decided. */}
        {providers.length > 0 ? <PrivacyNotice providers={providers} /> : null}
      </div>
    </div>
  );
}

const itemKey = (item: PosterItem): string => (item.kind === "block" ? item.block.id : `${item.kind}-${item.blocks[0]?.id ?? ""}`);

function PosterSection({ title, headings, children }: { title: string | null; headings: HeadingStyle; children: ReactNode }) {
  const id = useId();
  if (title === null) return <div className="grid min-w-0 grid-cols-1 gap-3">{children}</div>;
  const heading = sectionTitle(headings);
  return (
    <section aria-labelledby={id} className="grid min-w-0 grid-cols-1 gap-3">
      <h2 id={id} className={heading.className} style={heading.style}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PosterItemView({
  item,
  theme,
  surface,
  label,
  nested,
}: {
  item: PosterItem;
  theme: ResolvedCreatorTheme;
  surface: string;
  label: string;
  nested: boolean;
}) {
  switch (item.kind) {
    case "videos":
      return item.blocks.length > 1 ? <VideoRail videos={item.blocks} /> : <VideoFeature video={item.blocks[0]} />;
    case "products":
      return item.blocks.length > 1 ? <ProductGrid products={item.blocks} surface={surface} /> : <ProductRow product={item.blocks[0]} surface={surface} />;
    case "rows":
      return <RowGroup blocks={item.blocks} surface={surface} label={label} />;
    case "block":
      return <PosterBlock block={item.block} theme={theme} surface={surface} heading={nested ? "h3" : "h2"} />;
  }
}

function PosterBlock({ block, theme, surface, heading }: { block: Block; theme: ResolvedCreatorTheme; surface: string; heading: HeadingTag }) {
  const t = useTranslations("creator");
  switch (block.type) {
    case "music":
      return <FeaturedRelease block={block} surface={surface} heading={heading} />;
    case "card":
      return <FeaturedCard block={block} surface={surface} />;
    case "link":
      return <TextLink block={block} style={theme.buttonStyle} />;
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
      return (
        <div role="region" aria-label={t("scroller", { title: block.title ?? t("gallery") })} tabIndex={0} className={railFrame}>
          <ul className="flex snap-x gap-2 overflow-x-auto px-creator-gutter @prose:px-0">
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
    case "header":
    case "socials":
      return null;
  }
}
