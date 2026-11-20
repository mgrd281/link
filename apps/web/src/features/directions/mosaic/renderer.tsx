import { isBlockActive, type Block, type Page } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, BadgeCheck, CalendarDays, Radio } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { themeStyle } from "@/features/creator/theme";

import { CreatorFooter, MediaImage, mediaSizes, PlatformGlyph, platformName, useCreatorFormat } from "../shared/creator-kit";
import { ClickToLoad, NewsletterForm } from "../shared/islands";

export type TileSize = "s" | "w" | "l";

/** Default tile size per block type (creators can change it in the Mosaic editor). */
export const defaultTileSize = (block: Block): TileSize => {
  switch (block.type) {
    case "music":
      return "l";
    case "product":
    case "image":
    case "link":
    case "live":
    case "app":
    case "repo":
      return "s";
    default:
      return "w";
  }
};

const span: Record<TileSize, string> = {
  s: "col-span-1",
  w: "col-span-2",
  l: "col-span-2 row-span-2",
};

const displayStyle = {
  fontWeight: "var(--creator-display-weight)",
  letterSpacing: "var(--creator-display-tracking)",
  textTransform: "var(--creator-display-transform)" as "none",
};

/**
 * Direction C — "Mosaic": modular, personal, playful.
 * A bento grid of tiles inside the 560 px column. Sizes create hierarchy; every block is a tile.
 */
export function MosaicRenderer({
  page,
  theme,
  sizes = {},
  preview = false,
}: {
  page: Page;
  theme: ResolvedCreatorTheme;
  sizes?: Record<string, TileSize> | undefined;
  preview?: boolean;
}) {
  const t = useTranslations("creator");
  const { profile } = page;
  const blocks = page.blocks.filter((block) => isBlockActive(block));
  const isRtl = profile.locale === "ar";
  const socials = blocks.find((block): block is Extract<Block, { type: "socials" }> => block.type === "socials");

  return (
    <div
      lang={profile.locale}
      dir={isRtl ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      className={cn(
        "@container isolate font-creator-body text-creator-fg",
        theme.background === "gradient" ? "bg-(image:--creator-gradient)" : "bg-creator-bg",
        preview ? "min-h-full" : "min-h-dvh",
      )}
    >
      <div className="mx-auto grid max-w-creator gap-3 px-3 pt-3 @preview:px-creator-gutter @preview:pt-creator-gutter @prose:pt-12">
        <header className="grid grid-cols-5 items-end gap-4 rounded-xl border border-creator-line bg-creator-surface p-5">
          <div className="relative col-span-2 aspect-square overflow-hidden rounded-lg">
            <MediaImage src={profile.avatar.src} alt={profile.avatar.alt} sizes={mediaSizes.third} priority={!preview} />
          </div>
          <div className="col-span-3 grid gap-2">
            <h1 className="font-creator-display text-h1 leading-none break-words" style={displayStyle}>
              {profile.displayName}
            </h1>
            <p className="inline-flex items-center gap-1 text-small font-medium text-creator-fg-muted">
              {profile.verified ? <Icon icon={BadgeCheck} size="sm" label={t("verified")} className="text-creator-accent-text" /> : null}
              {profile.location}
            </p>
          </div>
          <p className="col-span-5 text-body text-creator-fg-muted">{profile.bio}</p>
        </header>

        <main className="grid grid-flow-row-dense grid-cols-2 gap-3">
          {socials
            ? socials.items.slice(0, 4).map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  className="group flex h-control-xl items-center gap-3 rounded-xl border border-creator-line bg-creator-surface px-4 transition-[border-color,scale] duration-standard ease-standard active:scale-pressed focus-visible:focus-ring"
                >
                  <PlatformGlyph platform={item.platform} />
                  <span className="truncate text-small font-semibold">{platformName(item.platform)}</span>
                </a>
              ))
            : null}
          {blocks
            .filter((block) => block.type !== "socials")
            .map((block) => (
              <MosaicTile key={block.id} block={block} size={sizes[block.id] ?? defaultTileSize(block)} theme={theme} />
            ))}
        </main>
        <CreatorFooter />
      </div>
    </div>
  );
}

function Tile({
  size,
  className,
  children,
  href,
  tone = "surface",
}: {
  size: TileSize;
  className?: string;
  children: ReactNode;
  href?: string | undefined;
  tone?: "surface" | "accent" | "plain";
}) {
  const classes = cn(
    "group relative isolate overflow-hidden rounded-xl",
    span[size],
    tone === "surface" && "border border-creator-line bg-creator-surface",
    tone === "accent" && "bg-creator-accent text-creator-accent-fg",
    href && "transition-[scale] duration-standard ease-standard active:scale-pressed focus-visible:focus-ring",
    className,
  );
  return href ? (
    <a href={href} className={classes}>
      {children}
    </a>
  ) : (
    <div className={classes}>{children}</div>
  );
}

function MosaicTile({ block, size, theme }: { block: Block; size: TileSize; theme: ResolvedCreatorTheme }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  const filled = theme.buttonStyle === "filled";

  switch (block.type) {
    case "music":
      return (
        <Tile size={size} className={cn("grid", size === "s" ? "aspect-square" : "")}>
          <div className={cn("relative", size === "l" ? "aspect-square" : size === "w" ? "aspect-video" : "absolute inset-0")}>
            <MediaImage src={block.cover.src} alt={block.cover.alt} sizes={size === "s" ? mediaSizes.half : mediaSizes.column} priority={size === "l"} />
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="grid min-w-0 flex-1">
              <span className="text-caption font-semibold tracking-wide text-creator-accent-text uppercase">{t(`kind.${block.kind}`)}</span>
              <span className="truncate font-creator-display text-h3 leading-tight" style={displayStyle}>
                {block.title}
              </span>
            </div>
            <ul className="flex shrink-0 gap-1">
              {block.links.slice(0, 3).map((link) => (
                <li key={link.platform}>
                  <a
                    href={link.url}
                    aria-label={t("listenOn", { platform: platformName(link.platform) })}
                    className="grid size-control-md place-items-center rounded-full bg-creator-surface-2 transition-colors duration-micro hover:text-creator-accent-text focus-visible:focus-ring"
                  >
                    <PlatformGlyph platform={link.platform} size="sm" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Tile>
      );

    case "live":
      return block.isLive ? (
        <Tile
          size={size}
          href={block.url}
          tone="accent"
          className={cn("flex gap-3 p-4", size === "s" ? "aspect-square flex-col justify-between" : "items-center")}
        >
          <span className="flex items-start justify-between gap-2">
            <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-creator-accent-fg text-creator-accent">
              <Icon icon={Radio} size="sm" />
            </span>
            {size === "s" ? <Icon icon={ArrowUpRight} size="md" className="shrink-0 rtl:-scale-x-100" /> : null}
          </span>
          <span className="grid min-w-0 flex-1 content-end">
            <span className="text-caption font-bold tracking-wide uppercase">{t("liveNow")}</span>
            <span className="text-small">{t("watching", { count: f.compact(block.viewers ?? 0) })}</span>
          </span>
          {size === "s" ? null : <Icon icon={ArrowUpRight} size="md" className="shrink-0 rtl:-scale-x-100" />}
        </Tile>
      ) : null;

    // Apps and skills get their full cards in Poster; here they are link tiles to the store or repository.
    case "app":
    case "repo": {
      const href = block.type === "app" ? block.stores[0]?.url : block.url;
      return href ? (
        <Tile size={size} href={href} tone="surface" className={cn("flex flex-col justify-between gap-6 p-4", size === "s" && "aspect-square")}>
          <Icon icon={ArrowUpRight} size="md" className="self-end transition-transform duration-micro group-hover:-translate-y-0.5 rtl:-scale-x-100" />
          <span className="font-creator-display text-h3 leading-tight" style={displayStyle}>
            {block.title}
          </span>
        </Tile>
      ) : null;
    }

    case "link":
      return (
        <Tile
          size={size}
          href={block.url}
          tone={filled && !block.badge ? "accent" : "surface"}
          className={cn("flex flex-col justify-between gap-6 p-4", size === "s" && "aspect-square")}
        >
          <span className="flex items-start justify-between gap-2">
            {block.badge ? (
              <span className="rounded-full bg-creator-accent px-2 py-0.5 text-caption font-semibold text-creator-accent-fg">{block.badge}</span>
            ) : (
              <span />
            )}
            <Icon icon={ArrowUpRight} size="md" className="transition-transform duration-micro group-hover:-translate-y-0.5 rtl:-scale-x-100" />
          </span>
          <span className="font-creator-display text-h3 leading-tight" style={displayStyle}>
            {block.title}
          </span>
        </Tile>
      );

    case "events": {
      const next = block.items.filter((event) => event.status !== "soldout").slice(0, 3);
      return (
        <Tile size={size} className="grid gap-3 p-4">
          <span className="flex items-center gap-2 text-caption font-semibold tracking-wide text-creator-fg-muted uppercase">
            <Icon icon={CalendarDays} size="sm" />
            {block.title ?? t("upcoming")}
          </span>
          <ol className="grid gap-2">
            {next.map((event) => (
              <li key={event.date + event.city}>
                <a
                  href={event.url}
                  className="flex items-center gap-3 rounded-lg bg-creator-surface-2 p-2 pe-3 transition-colors duration-micro hover:text-creator-accent-text focus-visible:focus-ring"
                >
                  <span className="grid size-control-lg shrink-0 place-items-center rounded-md bg-creator-surface text-center leading-none">
                    <span className="font-creator-display text-h3" style={displayStyle}>
                      {f.date(event.date, { day: "numeric" })}
                    </span>
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-small font-semibold">{event.city}</span>
                    <span className="truncate text-caption text-creator-fg-muted">
                      {f.date(event.date, { month: "long" })} · {event.venue}
                    </span>
                  </span>
                  <span className="shrink-0 text-caption font-semibold">{event.status === "few" ? t("fewLeft") : t("tickets")}</span>
                </a>
              </li>
            ))}
          </ol>
        </Tile>
      );
    }

    case "video":
      return (
        <Tile size={size}>
          <ClickToLoad
            provider="YouTube"
            title={block.title}
            className="aspect-video"
            poster={<MediaImage src={block.poster.src} alt="" sizes={mediaSizes.column} />}
          />
          <p className="truncate px-4 py-3 text-small font-semibold">{block.title}</p>
        </Tile>
      );

    case "shorts":
      return (
        <Tile size={size} className="grid gap-3 p-3">
          <ul className="grid grid-cols-3 gap-2">
            {block.items.map((item) => (
              <li key={item.url}>
                <ClickToLoad
                  compact
                  provider="YouTube"
                  title={item.title}
                  className="aspect-short rounded-lg"
                  poster={<MediaImage src={item.poster.src} alt="" sizes={mediaSizes.third} />}
                />
              </li>
            ))}
          </ul>
          {block.title ? <p className="px-1 text-small font-semibold">{block.title}</p> : null}
        </Tile>
      );

    case "product":
      return (
        <Tile size={size} href={block.url} className="grid">
          <span className="relative aspect-square">
            <MediaImage src={block.image.src} alt={block.image.alt} sizes={mediaSizes.half} />
            <span className="absolute end-2 top-2 rounded-full bg-creator-accent px-2 py-0.5 text-caption font-semibold text-creator-accent-fg">
              {f.price(block.price, block.currency)}
            </span>
          </span>
          <span className="truncate px-3 py-3 text-small font-semibold">{block.title}</span>
        </Tile>
      );

    case "card":
      return (
        <Tile size={size} href={block.url} className={cn("grid", size === "s" && "aspect-square")}>
          <span className={cn(size === "s" ? "absolute inset-0" : "relative aspect-video")}>
            <MediaImage src={block.image.src} alt={block.image.alt} sizes={size === "s" ? mediaSizes.half : mediaSizes.column} />
          </span>
          <span className={cn("relative grid gap-1 p-4", size === "s" && "self-end bg-linear-to-t from-creator-surface to-transparent pt-12")}>
            <span className="font-creator-display text-h3 leading-tight" style={displayStyle}>
              {block.title}
            </span>
            {block.description && size !== "s" ? <span className="text-small text-creator-fg-muted">{block.description}</span> : null}
          </span>
        </Tile>
      );

    case "newsletter":
      return (
        <Tile size={size} className="grid gap-4 p-5">
          <div className="grid gap-1">
            <h2 className="font-creator-display text-h2 leading-tight" style={displayStyle}>
              {block.title}
            </h2>
            {block.description ? <p className="text-small text-creator-fg-muted">{block.description}</p> : null}
          </div>
          <NewsletterForm />
        </Tile>
      );

    case "image":
      return (
        <Tile size={size} className="aspect-square">
          <MediaImage src={block.image.src} alt={block.image.alt} sizes={mediaSizes.half} />
        </Tile>
      );
    case "gallery":
      return (
        <Tile size={size} className="grid grid-cols-2 gap-1 p-1">
          {block.images.slice(0, 4).map((image) => (
            <span key={image.src} className="relative aspect-square overflow-hidden rounded-lg">
              <MediaImage src={image.src} alt={image.alt} sizes={mediaSizes.third} />
            </span>
          ))}
        </Tile>
      );
    case "header":
      return <h2 className="col-span-2 px-2 pt-4 font-creator-display text-h3" style={displayStyle}>{block.title}</h2>;
    case "text":
      return (
        <Tile size={size} className="p-4 text-body text-creator-fg-muted">
          {block.text}
        </Tile>
      );
    case "divider":
      return <hr className="col-span-2 my-2 border-creator-line" />;
    case "socials":
      return null;
  }
}
