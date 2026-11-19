import type { BlockOf } from "@linkyo/blocks";
import type { CreatorButtonStyle } from "@linkyo/tokens";
import { cn, Icon, PlatformIcon } from "@linkyo/ui";
import { ArrowUpRight, ChevronDown, Eye, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { siYoutubeshorts } from "simple-icons";

import { linkStyleClasses } from "@/features/creator/link-button";

import { MediaImage, mediaSizes, PlatformGlyph, platformName, useCreatorFormat } from "../shared/creator-kit";
import { ClickToLoad, NewsletterForm } from "../shared/islands";
import { linkGlyph, LinkIconGlyph } from "../shared/link-icons";
import { providerOf } from "../shared/providers";
import { LiveNextRow } from "./live";
import { linkDestination, RAIL_THRESHOLD, type RowBlock } from "./sections";
import { displayStyle, pressable, railFrame, railTrack, type HeadingTag } from "./styles";

/** Paid or commission links are labelled as advertising (DE: "Anzeige"). */
export function AdLabel({ className }: { className?: string }) {
  const t = useTranslations("creator");
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border border-current px-2 text-caption font-semibold tracking-wide uppercase", className)}>
      {t("ad")}
    </span>
  );
}

/** Artwork on the start side, title + subtitle beside it. The core Poster card. */
export function MediaRow({
  href,
  image,
  title,
  subtitle,
  trailing,
  surface,
  ad = false,
  className,
}: {
  href: string;
  image: { src: string; alt: string };
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  surface: string;
  ad?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <a href={href} className={cn("group flex items-center overflow-hidden rounded-creator-card", surface, pressable, className)}>
      <span className="relative aspect-square w-24 shrink-0 self-stretch @prose:w-32">
        <MediaImage src={image.src} alt={image.alt} sizes={mediaSizes.cover} />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5 px-4 py-3">
        <span className="line-clamp-2 text-body-lg leading-snug font-semibold">{title}</span>
        {subtitle || ad ? (
          <span className="flex min-w-0 items-center gap-2 text-body text-creator-fg-muted">
            {subtitle ? <span className="line-clamp-2">{subtitle}</span> : null}
            {ad ? <AdLabel /> : null}
          </span>
        ) : null}
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
export function FeaturedRelease({ block, surface, heading: Heading }: { block: BlockOf<"music">; surface: string; heading: HeadingTag }) {
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
 * A release in a short list: opens in place to show where to listen.
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

/** One media row for any row block. In a rail, releases link straight to their first service. */
function RowCard({ block, surface, inRail }: { block: RowBlock; surface: string; inRail: boolean }) {
  const t = useTranslations("creator");
  const className = inRail ? "h-full" : undefined;
  if (block.type === "music") {
    const first = block.links[0];
    if (!inRail || !first) return <ReleaseRow block={block} surface={surface} />;
    return <MediaRow href={first.url} image={block.cover} title={block.title} subtitle={`${block.artist} · ${t(`kind.${block.kind}`)}`} surface={surface} className={className} />;
  }
  if (block.type === "card") {
    return <MediaRow href={block.url} image={block.image} title={block.title} subtitle={block.description} surface={surface} ad={block.affiliate} className={className} />;
  }
  if (!block.thumbnail) return null;
  return <MediaRow href={block.url} image={block.thumbnail} title={block.title} subtitle={<bdi dir="ltr">{linkDestination(block.url)}</bdi>} surface={surface} ad={block.affiliate} className={className} />;
}

/**
 * A run of media rows. A few stack; from RAIL_THRESHOLD on they become a two-row rail that swipes
 * sideways (the next column peeks in), so long lists of episodes or mixes don't push everything down.
 */
export function RowGroup({ blocks, surface, label }: { blocks: RowBlock[]; surface: string; label: string }) {
  const t = useTranslations("creator");
  if (blocks.length < RAIL_THRESHOLD) {
    return (
      <div className="grid gap-2">
        {blocks.map((block) => (
          <RowCard key={block.id} block={block} surface={surface} inRail={false} />
        ))}
      </div>
    );
  }
  return (
    <div role="region" aria-label={t("scroller", { title: label })} tabIndex={0} className={railFrame}>
      <ul className={cn("grid auto-cols-[86%] grid-flow-col grid-rows-2 gap-2 @prose:auto-cols-[72%]", railTrack)}>
        {blocks.map((block) => (
          <li key={block.id} className="min-w-0 snap-start">
            <RowCard block={block} surface={surface} inRail />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Duration({ seconds, className }: { seconds: number; className?: string }) {
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  return (
    <span className={cn("rounded-full bg-creator-glass px-2 py-0.5 font-mono text-caption text-creator-fg backdrop-blur-glass", className)}>{f.duration(seconds)}</span>
  );
}

const PROVIDER_NAMES = { youtube: "YouTube", vimeo: "Vimeo", tiktok: "TikTok", instagram: "Instagram", upload: "Linkyo" } as const;
const providerName = (video: BlockOf<"video">) => PROVIDER_NAMES[video.provider];

export function VideoFeature({ video }: { video: BlockOf<"video"> | undefined }) {
  if (!video) return null;
  return (
    <figure className="grid min-w-0 grid-cols-1 gap-3">
      <ClickToLoad
        provider={providerName(video)}
        url={video.url}
        playback={video.playback}
        title={video.title}
        className="aspect-video rounded-creator-card"
        poster={<MediaImage src={video.poster.src} alt="" sizes={mediaSizes.column} />}
      >
        {video.duration ? <Duration seconds={video.duration} /> : null}
      </ClickToLoad>
      <figcaption className="text-body-lg leading-snug font-semibold">{video.title}</figcaption>
    </figure>
  );
}

/**
 * Two or more videos: a swipeable shelf. Titles sit under the frames (thumbnails often carry their
 * own lettering), with the duration on the frame — like a streaming app's row.
 */
export function VideoRail({ videos }: { videos: BlockOf<"video">[] }) {
  const t = useTranslations("creator");
  return (
    <div role="region" aria-label={t("scroller", { title: t("videos") })} tabIndex={0} className={railFrame}>
      <ul className={cn("flex gap-3", railTrack)}>
        {videos.map((video) => (
          <li key={video.id} className="grid w-4/5 shrink-0 snap-start content-start gap-3 @prose:w-3/4">
            <ClickToLoad
              compact
              provider={providerName(video)}
              url={video.url}
              playback={video.playback}
              title={video.title}
              className="aspect-video rounded-creator-card"
              poster={<MediaImage src={video.poster.src} alt="" sizes={mediaSizes.column} />}
            >
              {video.duration ? (
                <span aria-hidden className="absolute end-2 bottom-2">
                  <Duration seconds={video.duration} />
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

/** Vertical clips: poster, platform mark, view count, title underneath. */
export function ShortsRail({ block }: { block: BlockOf<"shorts"> }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  return (
    <div role="region" aria-label={t("scroller", { title: block.title ?? t("videos") })} tabIndex={0} className={railFrame}>
      <ul className={cn("flex gap-2", railTrack)}>
        {block.items.map((item) => (
          <li key={item.url} className="grid w-2/5 shrink-0 snap-start content-start gap-2 @preview:w-1/3">
            <ClickToLoad
              compact
              provider={providerOf(item.url) ?? "YouTube"}
              url={item.url}
              title={item.title}
              className="aspect-short rounded-creator-card"
              poster={<MediaImage src={item.poster.src} alt="" sizes={mediaSizes.third} />}
            >
              <span aria-hidden className="absolute end-2 top-2 grid size-control-sm place-items-center rounded-full bg-creator-glass text-creator-fg backdrop-blur-glass">
                <PlatformIcon icon={siYoutubeshorts} size="sm" />
              </span>
              {item.views ? (
                <span className="absolute start-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-creator-glass px-2 py-0.5 text-caption font-medium whitespace-nowrap text-creator-fg backdrop-blur-glass">
                  <Icon icon={Eye} size="sm" />
                  {f.compact(item.views)}
                  <span className="sr-only">{t("views", { count: f.compact(item.views) })}</span>
                </span>
              ) : null}
            </ClickToLoad>
            <p className="line-clamp-2 text-small leading-snug font-medium">{item.title}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductGrid({ products, surface }: { products: BlockOf<"product">[]; surface: string }) {
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
              <span className="flex flex-wrap items-center gap-2 text-small text-creator-fg-muted">
                {/* Prices read left to right in every language ("39 US$", not "$US 39" on Arabic pages). */}
                <bdi dir="ltr">{f.price(product.price, product.currency)}</bdi>
                {product.affiliate ? <AdLabel /> : null}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ProductRow({ product, surface }: { product: BlockOf<"product"> | undefined; surface: string }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  if (!product) return null;
  return (
    <MediaRow
      href={product.url}
      image={product.image}
      title={product.title}
      subtitle={<bdi dir="ltr">{f.price(product.price, product.currency)}</bdi>}
      surface={surface}
      ad={product.affiliate}
      trailing={
        <span className="inline-flex h-control-sm items-center rounded-creator-button bg-creator-accent px-4 text-small font-semibold text-creator-accent-fg">{t("buy")}</span>
      }
    />
  );
}

/** Partners, sponsors, teams: logo tiles. Two columns carry the role, three show the name only. */
export function BrandGrid({ block }: { block: BlockOf<"brands"> }) {
  const wide = block.columns === 2;
  return (
    <ul className={cn("grid gap-3", wide ? "grid-cols-2" : "grid-cols-3")}>
      {block.items.map((item) => {
        const body = (
          <>
            <span className="relative block aspect-square overflow-hidden rounded-creator-card">
              <MediaImage src={item.logo.src} alt="" sizes={wide ? mediaSizes.half : mediaSizes.third} />
            </span>
            <span className={cn("grid gap-0.5", wide ? "px-1 pt-2" : "px-0.5 pt-2")}>
              <span className={cn("line-clamp-2 leading-snug font-semibold", wide ? "text-body" : "text-small")}>{item.name}</span>
              {wide && item.role ? <span className="truncate text-small text-creator-fg-muted">{item.role}</span> : null}
            </span>
          </>
        );
        return (
          <li key={item.name} className="min-w-0">
            {item.url ? (
              <a href={item.url} className="block rounded-creator-card transition-[scale] duration-standard ease-standard focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none">
                {body}
              </a>
            ) : (
              <div>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A plain link: the label leads, its destination sits underneath so visitors know where they go. */
/**
 * A link button: an icon that says where it goes (chosen, or read from the address), the title, and a
 * second line (the creator's subtitle, else the address so visitors know before they tap). The
 * highlighted link is the page's primary action, filled with the accent (on filled pages the other
 * links turn soft, see PosterRenderer), so one button always leads.
 */
export function TextLink({ block, style }: { block: BlockOf<"link">; style: CreatorButtonStyle }) {
  const primary = block.highlight;
  const onColor = primary || style === "filled";
  const glyph = linkGlyph(block.url, block.icon);
  const tone = primary ? "bg-creator-accent text-creator-accent-fg" : linkStyleClasses[style];
  return (
    <a
      href={block.url}
      className={cn(
        "flex min-h-creator-button items-center gap-3 rounded-creator-button py-3 ps-3 pe-4",
        tone,
        !primary && style === "minimal" && "ps-0 pe-1",
        pressable,
        !primary && style === "minimal" && "after:hidden",
      )}
    >
      {/* Icon tile, tinted from the button's own color so it works on every theme. */}
      <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-creator-button", !onColor && "text-creator-accent-text")}>
        <span aria-hidden className="absolute inset-0 rounded-[inherit] bg-current opacity-pressed" />
        {glyph.kind === "platform" ? <PlatformGlyph platform={glyph.platform} size="md" /> : <LinkIconGlyph icon={glyph.icon} size="md" />}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5 text-start">
        {/* Two lines before an ellipsis: headlines and long titles stay readable. */}
        <span className="line-clamp-2 text-body-lg leading-snug font-semibold">{block.title}</span>
        <span className={cn("flex min-w-0 items-center gap-2 text-small", !onColor && "text-creator-fg-muted")}>
          <span className="truncate">
            {/* Hosts, emails and phone numbers read left to right, also on Arabic pages (+49 …). */}
            {block.subtitle ?? <bdi dir="ltr">{linkDestination(block.url)}</bdi>}
          </span>
          {block.affiliate ? <AdLabel /> : null}
        </span>
      </span>
      {block.badge ? (
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold", onColor ? "bg-creator-bg text-creator-fg" : "bg-creator-accent text-creator-accent-fg")}>
          {block.badge}
        </span>
      ) : null}
      <Icon icon={ArrowUpRight} size="sm" className="shrink-0 rtl:-scale-x-100" />
    </a>
  );
}

/**
 * Live now: one compact, inverted row — who, where and a pulsing LIVE badge. The whole row opens the
 * live; a planned or past live is a calm row instead (see LiveNextRow).
 */
export function LiveRow({ block, surface }: { block: BlockOf<"live">; surface: string }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  if (!block.isLive) return <LiveNextRow block={block} surface={surface} />;
  const platform = platformName(block.platform);
  return (
    <a
      id={block.id}
      href={block.url}
      className={cn("relative flex scroll-mt-20 items-center gap-4 overflow-hidden rounded-creator-card bg-creator-accent p-3 pe-4 text-creator-accent-fg", pressable)}
    >
      <span className="grid size-16 shrink-0 place-items-center rounded-md bg-creator-accent-fg text-creator-accent">
        <PlatformGlyph platform={block.platform} size="lg" />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="truncate text-body font-semibold">
          <bdi dir="ltr">@{block.channel}</bdi>
        </span>
        <span className="truncate text-small">{block.viewers ? `${platform} · ${t("watching", { count: f.compact(block.viewers) })}` : platform}</span>
      </span>
      <span className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full bg-danger-fill px-3 text-caption font-bold tracking-wide text-danger-fill-fg uppercase">
        <span aria-hidden className="size-dot rounded-full bg-current motion-safe:animate-pulse" />
        {t("liveNow")}
      </span>
    </a>
  );
}

export function FeaturedCard({ block, surface }: { block: BlockOf<"card">; surface: string }) {
  return (
    <a href={block.url} className={cn("grid overflow-hidden rounded-creator-card", surface, pressable)}>
      <span className="relative aspect-video">
        <MediaImage src={block.image.src} alt={block.image.alt} sizes={mediaSizes.column} />
      </span>
      <span className="grid gap-1 p-4 @prose:p-5">
        <span className="font-creator-display text-h3 leading-tight" style={displayStyle}>
          {block.title}
        </span>
        {block.description ? <span className="text-body text-creator-fg-muted">{block.description}</span> : null}
        {block.affiliate ? <AdLabel className="justify-self-start text-creator-fg-muted" /> : null}
      </span>
    </a>
  );
}

export function NewsletterCard({ block, surface, heading: Heading }: { block: BlockOf<"newsletter">; surface: string; heading: HeadingTag }) {
  return (
    <section aria-label={block.title} className={cn("grid gap-5 rounded-creator-card p-5 @prose:p-6", surface)}>
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid size-control-lg shrink-0 place-items-center rounded-full bg-creator-accent text-creator-accent-fg">
          <Icon icon={Mail} size="md" />
        </span>
        <div className="grid min-w-0 gap-1">
          <Heading className="font-creator-display text-h3 leading-tight" style={displayStyle}>
            {block.title}
          </Heading>
          {block.description ? <p className="text-small text-creator-fg-muted">{block.description}</p> : null}
        </div>
      </div>
      <NewsletterForm />
    </section>
  );
}
