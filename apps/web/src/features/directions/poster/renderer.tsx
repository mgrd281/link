import { isBlockActive, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import type { CreatorButtonStyle } from "@linkyo/tokens";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, BadgeCheck, ChevronDown, Ticket } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

import { linkStyleClasses } from "@/features/creator/link-button";
import { themeStyle } from "@/features/creator/theme";

import { CreatorFooter, MediaImage, mediaSizes, PlatformGlyph, platformName, useCreatorFormat } from "../shared/creator-kit";
import { ClickToLoad, NewsletterForm } from "../shared/islands";
import { groupSections, linkDestination, type PosterItem } from "./sections";

const displayStyle = {
  fontWeight: "var(--creator-display-weight)",
  letterSpacing: "var(--creator-display-tracking)",
  textTransform: "var(--creator-display-transform)" as "none",
};

/** Media cards follow the creator's button style. "Filled" stays soft so the artwork remains the loudest thing. */
const cardSurface: Record<CreatorButtonStyle, string> = {
  filled: "bg-creator-surface-2",
  soft: "bg-creator-surface-2",
  outline: "border border-creator-line-strong",
  glass: "border border-creator-line bg-creator-glass backdrop-blur-glass",
  shadow: "bg-creator-surface shadow-e2",
  minimal: "border-b border-creator-line",
};

/** Hover/press feedback in currentColor: works on every surface, theme and photo. */
const pressable = cn(
  "relative isolate transition-[scale,box-shadow] duration-standard ease-standard active:scale-pressed motion-reduce:active:scale-none",
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-current after:opacity-0",
  "after:transition-opacity after:duration-micro hover:after:opacity-hover active:after:opacity-pressed",
  "focus-visible:focus-ring",
);

/**
 * Direction D — "Poster": the creator as a headliner.
 * A full-bleed portrait fades into the page, the name is set like a gig poster, and everything
 * else lives in titled sections of calm, flat cards (artwork beside the title, two-up shop,
 * swipeable videos). Light and dark use the same layout; the theme engine guarantees contrast.
 */
export function PosterRenderer({ page, theme, preview = false }: { page: Page; theme: ResolvedCreatorTheme; preview?: boolean }) {
  const t = useTranslations("creator");
  const { profile } = page;
  const blocks = page.blocks.filter((block) => isBlockActive(block));
  const socials = blocks.find((block): block is BlockOf<"socials"> => block.type === "socials");
  const sections = groupSections(blocks);
  const isRtl = profile.locale === "ar";
  const hero = profile.hero ?? profile.avatar;
  const surface = cardSurface[theme.buttonStyle];

  return (
    <div
      lang={profile.locale}
      dir={isRtl ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      className={cn("@container relative isolate overflow-hidden bg-creator-bg font-creator-body text-creator-fg", preview ? "min-h-full" : "min-h-dvh")}
    >
      {/* Wide screens: the portrait becomes a soft ambient glow behind the column. Decorative. */}
      <div aria-hidden className="absolute inset-x-0 top-0 hidden h-dvh overflow-hidden opacity-secondary @prose:block">
        <MediaImage src={hero.src} alt="" sizes={mediaSizes.wide} className="scale-lift blur-ambient" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-creator-bg" />
      </div>

      <div className="relative mx-auto max-w-creator @prose:pt-10">
        <header className="grid justify-items-center text-center">
          <div className="relative aspect-portrait w-full overflow-hidden mask-b-from-45% mask-b-to-90% @prose:rounded-t-xl">
            <MediaImage src={hero.src} alt={hero.alt} sizes={mediaSizes.column} priority={!preview} />
          </div>
          <div className="relative -mt-16 grid justify-items-center gap-4 px-creator-gutter">
            <h1
              className={cn("font-creator-display text-display text-balance break-words @prose:text-display-xl", isRtl ? "leading-tight" : "leading-none")}
              style={displayStyle}
            >
              {profile.displayName}
              {profile.verified ? (
                <span className="ms-2 inline-block align-middle text-creator-accent-text">
                  <Icon icon={BadgeCheck} size="lg" label={t("verified")} />
                </span>
              ) : null}
            </h1>
            <p className="max-w-prose text-body-lg font-medium text-balance">{profile.bio}</p>
            {socials ? (
              <ul className="flex flex-wrap justify-center gap-2">
                {socials.items.map((item) => (
                  <li key={item.url}>
                    <a
                      href={item.url}
                      aria-label={platformName(item.platform)}
                      className="grid size-touch-target place-items-center rounded-full text-creator-fg transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring"
                    >
                      <PlatformGlyph platform={item.platform} size="lg" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </header>

        <main className="grid grid-cols-1 gap-10 px-creator-gutter pt-10 @prose:px-0">
          {sections.map((section) => (
            <PosterSection key={section.id} title={section.title}>
              {section.items.map((item) => (
                <PosterItemView key={itemKey(item)} item={item} theme={theme} surface={surface} nested={section.title !== null} />
              ))}
            </PosterSection>
          ))}
        </main>
        <CreatorFooter className="px-creator-gutter" />
      </div>
    </div>
  );
}

const itemKey = (item: PosterItem): string => (item.kind === "block" ? item.block.id : `${item.kind}-${item.blocks[0]?.id ?? ""}`);

function PosterSection({ title, children }: { title: string | null; children: ReactNode }) {
  const id = useId();
  if (title === null) return <div className="grid min-w-0 grid-cols-1 gap-3">{children}</div>;
  return (
    <section aria-labelledby={id} className="grid min-w-0 grid-cols-1 gap-3">
      <h2 id={id} className="font-creator-display text-h2 leading-tight" style={displayStyle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PosterItemView({ item, theme, surface, nested }: { item: PosterItem; theme: ResolvedCreatorTheme; surface: string; nested: boolean }) {
  if (item.kind === "videos") return item.blocks.length > 1 ? <VideoRow videos={item.blocks} /> : <VideoFeature video={item.blocks[0]} />;
  if (item.kind === "products") return item.blocks.length > 1 ? <ProductGrid products={item.blocks} surface={surface} /> : <ProductRow product={item.blocks[0]} surface={surface} />;
  return <PosterBlock block={item.block} theme={theme} surface={surface} heading={nested ? "h3" : "h2"} />;
}

/** Block titles sit one level below their section title (h2 at the top of the page, h3 inside a section). */
type HeadingTag = "h2" | "h3";

/** Artwork on the start side, title + subtitle beside it. The core Poster card. */
function MediaRow({
  href,
  image,
  title,
  subtitle,
  trailing,
  surface,
}: {
  href: string;
  image: { src: string; alt: string };
  title: string;
  subtitle?: string | undefined;
  trailing?: ReactNode;
  surface: string;
}) {
  return (
    <a href={href} className={cn("group flex items-center overflow-hidden rounded-creator-card", surface, pressable)}>
      <span className="relative aspect-square w-24 shrink-0 self-stretch @prose:w-32">
        <MediaImage src={image.src} alt={image.alt} sizes={mediaSizes.cover} />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5 px-4 py-3">
        <span className="line-clamp-2 text-body-lg leading-snug font-semibold">{title}</span>
        {subtitle ? <span className="truncate text-body text-creator-fg-muted">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0 pe-4">{trailing}</span> : null}
    </a>
  );
}

function PlatformLinks({ block }: { block: BlockOf<"music"> }) {
  const t = useTranslations("creator");
  return (
    <ul className="grid grid-cols-2 gap-2 @prose:grid-cols-3">
      {block.links.map((link) => (
        <li key={link.platform} className="min-w-0">
          <a
            href={link.url}
            aria-label={t("listenOn", { platform: platformName(link.platform) })}
            className={cn("flex h-control-lg min-w-0 items-center gap-2 rounded-creator-button border border-creator-line bg-creator-surface px-2 text-small font-medium @preview:px-3", pressable)}
          >
            <PlatformGlyph platform={link.platform} size="sm" />
            <span className="truncate">{platformName(link.platform)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The highlighted release: big artwork, the title set like the name, every platform one tap away. */
function FeaturedRelease({ block, surface, heading: Heading }: { block: BlockOf<"music">; surface: string; heading: HeadingTag }) {
  const t = useTranslations("creator");
  return (
    <article className={cn("overflow-hidden rounded-creator-card", surface)}>
      <div className="relative aspect-square">
        <MediaImage src={block.cover.src} alt={block.cover.alt} sizes={mediaSizes.column} />
      </div>
      <div className="grid gap-4 p-4 @prose:p-5">
        <div className="grid gap-1">
          <p className="text-caption font-semibold tracking-wide text-creator-accent-text uppercase">
            {t(`kind.${block.kind}`)} · {t("outNow")}
          </p>
          <Heading className="font-creator-display text-h1 leading-none" style={displayStyle}>
            {block.title}
          </Heading>
          <p className="text-body text-creator-fg-muted">{block.artist}</p>
        </div>
        <PlatformLinks block={block} />
      </div>
    </article>
  );
}

/**
 * Every other release: a compact card that opens in place to show where to listen.
 * Native <details>: works without JavaScript, keyboard and screen readers included.
 */
function ReleaseRow({ block, surface }: { block: BlockOf<"music">; surface: string }) {
  const t = useTranslations("creator");
  return (
    <details className={cn("group/release overflow-hidden rounded-creator-card has-[summary:focus-visible]:focus-ring", surface)}>
      <summary className="flex cursor-pointer list-none items-center outline-none [&::-webkit-details-marker]:hidden">
        <span className="relative aspect-square w-24 shrink-0 self-stretch @prose:w-32">
          <MediaImage src={block.cover.src} alt={block.cover.alt} sizes={mediaSizes.cover} />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5 px-4 py-3">
          <span className="line-clamp-2 text-body-lg leading-snug font-semibold">{block.title}</span>
          <span className="truncate text-body text-creator-fg-muted">
            {block.artist} · {t(`kind.${block.kind}`)}
          </span>
        </span>
        <span className="grid size-touch-target shrink-0 place-items-center pe-2">
          <Icon icon={ChevronDown} size="md" className="transition-transform duration-standard ease-standard group-open/release:rotate-180 motion-reduce:transition-none" />
        </span>
      </summary>
      <div className="grid gap-3 p-3 pt-0 @prose:p-4 @prose:pt-0">
        <p className="pt-3 text-small text-creator-fg-muted">{t("chooseService")}</p>
        <PlatformLinks block={block} />
      </div>
    </details>
  );
}

function VideoFeature({ video }: { video: BlockOf<"video"> | undefined }) {
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  if (!video) return null;
  return (
    <figure className="grid min-w-0 grid-cols-1 gap-3">
      <ClickToLoad
        provider="YouTube"
        title={video.title}
        className="aspect-video rounded-creator-card"
        poster={<MediaImage src={video.poster.src} alt="" sizes={mediaSizes.column} />}
      >
        {video.duration ? (
          <span className="rounded-full bg-creator-glass px-2 py-1 font-mono text-creator-fg backdrop-blur-glass">{f.duration(video.duration)}</span>
        ) : null}
      </ClickToLoad>
      <figcaption className="text-body-lg leading-snug font-semibold">{video.title}</figcaption>
    </figure>
  );
}

/** Two or more videos in a row: a swipeable strip, the next card peeking in. */
function VideoRow({ videos }: { videos: BlockOf<"video">[] }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  return (
    <div role="region" aria-label={t("scroller", { title: t("videos") })} tabIndex={0} className="-mx-creator-gutter min-w-0 rounded-creator-card focus-visible:focus-ring @prose:mx-0">
      <ul className="flex snap-x snap-mandatory scroll-px-creator-gutter gap-3 overflow-x-auto px-creator-gutter pb-1 @prose:scroll-px-0 @prose:px-0">
        {videos.map((video) => (
          <li key={video.id} className="grid w-4/5 shrink-0 snap-start content-start gap-2 @prose:w-3/4">
            <ClickToLoad
              compact
              provider="YouTube"
              title={video.title}
              className="aspect-video rounded-creator-card"
              poster={<MediaImage src={video.poster.src} alt="" sizes={mediaSizes.column} />}
            >
              {video.duration ? (
                <span className="absolute end-2 bottom-2 rounded-full bg-creator-glass px-2 py-0.5 font-mono text-caption text-creator-fg backdrop-blur-glass">
                  {f.duration(video.duration)}
                </span>
              ) : null}
            </ClickToLoad>
            <p className="line-clamp-2 text-body leading-snug font-semibold">{video.title}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductGrid({ products, surface }: { products: BlockOf<"product">[]; surface: string }) {
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  return (
    <ul className="grid grid-cols-2 gap-3">
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <a href={product.url} className={cn("grid h-full content-start overflow-hidden rounded-creator-card", surface, pressable)}>
            <span className="relative aspect-square">
              <MediaImage src={product.image.src} alt={product.image.alt} sizes={mediaSizes.half} />
            </span>
            <span className="grid gap-1 p-3 @preview:p-4">
              <span className="line-clamp-2 text-body leading-snug font-semibold">{product.title}</span>
              <span className="text-small text-creator-fg-muted">{f.price(product.price, product.currency)}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function ProductRow({ product, surface }: { product: BlockOf<"product"> | undefined; surface: string }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  if (!product) return null;
  return (
    <MediaRow
      href={product.url}
      image={product.image}
      title={product.title}
      subtitle={f.price(product.price, product.currency)}
      surface={surface}
      trailing={
        <span className="inline-flex h-control-sm items-center rounded-creator-button bg-creator-accent px-4 text-small font-semibold text-creator-accent-fg">
          {t("buy")}
        </span>
      }
    />
  );
}

/** Sold-out dates are not links (nothing to do); everything else leads to tickets. */
function EventLink({ href, className, children }: { href: string | null; className: string; children: ReactNode }) {
  return href ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

function PosterBlock({ block, theme, surface, heading: Heading }: { block: Block; theme: ResolvedCreatorTheme; surface: string; heading: HeadingTag }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);

  switch (block.type) {
    case "music":
      return block.highlight ? <FeaturedRelease block={block} surface={surface} heading={Heading} /> : <ReleaseRow block={block} surface={surface} />;

    case "live":
      return (
        <a href={block.url} className={cn("flex items-start gap-3 rounded-creator-card p-4", surface, pressable)}>
          <span className="grid h-control-sm shrink-0 place-items-center">
            <PlatformGlyph platform={block.platform} size="lg" />
          </span>
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="flex min-h-control-sm items-center justify-between gap-3">
              <span className="truncate text-body-lg font-semibold">{platformName(block.platform)}</span>
              {block.isLive ? (
                <span className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full bg-creator-accent px-3 text-caption font-bold tracking-wide text-creator-accent-fg uppercase">
                  <span aria-hidden className="size-dot rounded-full bg-current motion-safe:animate-pulse" />
                  {t("liveNow")}
                  {block.viewers ? <span className="font-medium">· {f.compact(block.viewers)}</span> : null}
                </span>
              ) : (
                <span className="shrink-0 text-small text-creator-fg-muted">{t("offline")}</span>
              )}
            </span>
            {block.title ? <span className="line-clamp-2 text-small text-creator-fg-muted">{block.title}</span> : null}
          </span>
        </a>
      );

    case "card":
      return block.highlight ? (
        <a href={block.url} className={cn("grid overflow-hidden rounded-creator-card", surface, pressable)}>
          <span className="relative aspect-video">
            <MediaImage src={block.image.src} alt={block.image.alt} sizes={mediaSizes.column} />
          </span>
          <span className="grid gap-1 p-4 @prose:p-5">
            <span className="font-creator-display text-h3 leading-tight" style={displayStyle}>
              {block.title}
            </span>
            {block.description ? <span className="text-body text-creator-fg-muted">{block.description}</span> : null}
          </span>
        </a>
      ) : (
        <MediaRow href={block.url} image={block.image} title={block.title} subtitle={block.description} surface={surface} />
      );

    case "link":
      return block.thumbnail ? (
        <MediaRow href={block.url} image={block.thumbnail} title={block.title} subtitle={linkDestination(block.url)} surface={surface} />
      ) : (
        <TextLink block={block} style={theme.buttonStyle} />
      );

    case "events":
      return (
        <ol className="grid gap-2">
          {block.items.map((event) => {
            const soldOut = event.status === "soldout";
            return (
              <li key={event.date + event.city}>
                <EventLink href={soldOut ? null : event.url} className={cn("flex items-center gap-4 rounded-creator-card p-3 pe-4", surface, !soldOut && pressable)}>
                  <span className="grid size-16 shrink-0 content-center justify-items-center gap-1 rounded-md bg-creator-bg leading-none">
                    <span className="font-creator-display text-h2 leading-none" style={displayStyle}>
                      {f.date(event.date, { day: "2-digit" })}
                    </span>
                    <span className="text-caption font-semibold text-creator-fg-muted uppercase">{f.date(event.date, { month: "short" })}</span>
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className={cn("truncate text-body-lg font-semibold", soldOut && "text-creator-fg-muted line-through")}>{event.city}</span>
                    <span className="truncate text-small text-creator-fg-muted">{event.venue}</span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-control-sm shrink-0 items-center gap-2 rounded-creator-button px-3 text-small font-semibold",
                      soldOut ? "text-creator-fg-muted" : "bg-creator-accent text-creator-accent-fg",
                    )}
                  >
                    {soldOut ? null : <Icon icon={Ticket} size="sm" />}
                    {soldOut ? t("soldOut") : event.status === "few" ? t("fewLeft") : t("tickets")}
                  </span>
                </EventLink>
              </li>
            );
          })}
        </ol>
      );

    case "shorts":
      return (
        <div role="region" aria-label={t("scroller", { title: block.title ?? t("videos") })} tabIndex={0} className="-mx-creator-gutter min-w-0 rounded-creator-card focus-visible:focus-ring @prose:mx-0">
          <ul className="flex snap-x snap-mandatory scroll-px-creator-gutter gap-2 overflow-x-auto px-creator-gutter pb-1 @prose:scroll-px-0 @prose:px-0">
            {block.items.map((item) => (
              <li key={item.url} className="w-2/5 shrink-0 snap-start @preview:w-1/3">
                <ClickToLoad
                  compact
                  provider="YouTube"
                  title={item.title}
                  className="aspect-short rounded-creator-card"
                  poster={<MediaImage src={item.poster.src} alt="" sizes={mediaSizes.third} />}
                >
                  {item.views ? (
                    <span className="absolute start-2 bottom-2 rounded-full bg-creator-glass px-2 py-0.5 text-caption font-medium text-creator-fg backdrop-blur-glass">
                      {f.compact(item.views)}
                    </span>
                  ) : null}
                </ClickToLoad>
              </li>
            ))}
          </ul>
        </div>
      );

    case "gallery":
      return (
        <div role="region" aria-label={t("scroller", { title: block.title ?? t("gallery") })} tabIndex={0} className="-mx-creator-gutter min-w-0 focus-visible:focus-ring @prose:mx-0">
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

    case "newsletter":
      return (
        <section aria-label={block.title} className={cn("grid gap-4 rounded-creator-card p-5", surface)}>
          <div className="grid gap-1">
            <Heading className="font-creator-display text-h3 leading-tight" style={displayStyle}>
              {block.title}
            </Heading>
            {block.description ? <p className="text-small text-creator-fg-muted">{block.description}</p> : null}
          </div>
          <NewsletterForm />
        </section>
      );

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

/** A plain link: the label leads, its destination sits underneath so visitors know where they go. */
function TextLink({ block, style }: { block: BlockOf<"link">; style: CreatorButtonStyle }) {
  const filled = style === "filled";
  return (
    <a
      href={block.url}
      className={cn(
        "flex min-h-creator-button items-center gap-3 rounded-creator-button px-5 py-3",
        linkStyleClasses[style],
        style === "minimal" && "px-1",
        pressable,
        style === "minimal" && "after:hidden",
      )}
    >
      <span className="grid min-w-0 flex-1 text-start">
        <span className="truncate text-body-lg font-semibold">{block.title}</span>
        <span className={cn("truncate text-small", !filled && "text-creator-fg-muted")}>{linkDestination(block.url)}</span>
      </span>
      {block.badge ? (
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold", filled ? "bg-creator-bg text-creator-fg" : "bg-creator-accent text-creator-accent-fg")}>
          {block.badge}
        </span>
      ) : null}
      <Icon icon={ArrowUpRight} size="sm" className="shrink-0 rtl:-scale-x-100" />
    </a>
  );
}
