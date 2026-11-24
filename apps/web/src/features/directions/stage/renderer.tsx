import { isBlockActive, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, BadgeCheck, Ticket } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { CreatorLink } from "@/features/creator/link-button";
import { themeStyle } from "@/features/creator/theme";

import { CreatorFooter, MediaImage, mediaSizes, PlatformGlyph, platformName, useCreatorFormat } from "../shared/creator-kit";
import { ClickToLoad, NewsletterForm } from "../shared/islands";

const displayStyle = {
  fontWeight: "var(--creator-display-weight)",
  letterSpacing: "var(--creator-display-tracking)",
  textTransform: "var(--creator-display-transform)" as "none",
};

/**
 * Direction B — "Stage": immersive, media-first, night.
 * The creator's photo fills the screen, the name is set like a poster, the newest release and the
 * live status come first. On desktop the photo becomes an ambient, blurred backdrop.
 */
export function StageRenderer({ page, theme, preview = false }: { page: Page; theme: ResolvedCreatorTheme; preview?: boolean }) {
  const t = useTranslations("creator");
  const { profile } = page;
  const blocks = page.blocks.filter((block) => isBlockActive(block));
  const socials = blocks.find((block): block is BlockOf<"socials"> => block.type === "socials");
  const isRtl = profile.locale === "ar";
  const hero = profile.hero ?? profile.avatar;

  return (
    <div
      lang={profile.locale}
      dir={isRtl ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      className={cn("@container relative isolate overflow-hidden bg-creator-bg font-creator-body text-creator-fg", preview ? "min-h-full" : "min-h-dvh")}
    >
      {/* Ambient backdrop (desktop): the hero photo, heavily blurred. Decorative. */}
      <div aria-hidden className="absolute inset-0 hidden opacity-secondary @prose:block">
        <MediaImage src={hero.src} focal={hero.focal} alt="" sizes={mediaSizes.wide} className="scale-lift blur-ambient" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-creator-bg to-creator-bg" />
      </div>

      <div className="relative mx-auto max-w-creator @prose:px-creator-gutter @prose:pt-12">
        <header className="relative aspect-portrait overflow-hidden @prose:rounded-xl">
          <MediaImage src={hero.src} focal={hero.focal} alt={hero.alt} sizes={mediaSizes.column} priority={!preview} />
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-creator-bg" />
          <div className="absolute inset-x-0 bottom-0 grid gap-3 px-creator-gutter pb-6">
            <p className="inline-flex items-center gap-2 text-small font-medium text-creator-fg">
              {profile.location}
              {profile.verified ? <Icon icon={BadgeCheck} size="sm" label={t("verified")} className="text-creator-accent-text" /> : null}
            </p>
            <h1 className="font-creator-display text-display leading-none break-words @preview:text-display-xl" style={displayStyle}>
              {profile.displayName}
            </h1>
            <p className="max-w-prose text-body text-creator-fg-muted">{profile.bio}</p>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-4 px-creator-gutter pb-6 @prose:px-0">
          {socials ? (
            <ul className="-mx-2 flex flex-wrap gap-1">
              {socials.items.map((item) => (
                <li key={item.url}>
                  <a
                    href={item.url}
                    aria-label={platformName(item.platform)}
                    className="group grid size-touch-target place-items-center rounded-full text-creator-fg transition-colors duration-micro hover:bg-creator-surface focus-visible:focus-ring"
                  >
                    <PlatformGlyph platform={item.platform} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {blocks
            .filter((block) => block.type !== "socials")
            .map((block) => (
              <StageBlock key={block.id} block={block} theme={theme} />
            ))}
        </main>
        <CreatorFooter />
      </div>
    </div>
  );
}

/** Sold-out dates are not links (nothing to do), everything else links to tickets. */
function EventRow({ href, className, children }: { href: string | null; className: string; children: ReactNode }) {
  return href ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <h2 className="pt-6 text-caption font-semibold tracking-wide text-creator-fg-muted uppercase">{children}</h2>;
}

function StageBlock({ block, theme }: { block: Block; theme: ResolvedCreatorTheme }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);

  switch (block.type) {
    case "live":
      return block.isLive ? (
        <a
          href={block.url}
          className="group flex items-center gap-3 rounded-creator-button border border-creator-line bg-creator-surface p-2 pe-4 transition-colors duration-micro hover:border-creator-line-strong focus-visible:focus-ring"
        >
          <span className="inline-flex h-control-sm items-center gap-2 rounded-creator-button bg-creator-accent px-3 text-caption font-bold tracking-wide text-creator-accent-fg uppercase">
            <span aria-hidden className="size-dot rounded-full bg-current motion-safe:animate-pulse" />
            {t("liveNow")}
          </span>
          <span className="min-w-0 flex-1 truncate text-small">
            {block.title} · <span className="text-creator-fg-muted">{t("watching", { count: f.compact(block.viewers ?? 0) })}</span>
          </span>
          <Icon icon={ArrowUpRight} size="sm" className="shrink-0" />
        </a>
      ) : null;

    case "music":
      return (
        <article className="grid grid-cols-1 gap-4 pt-4">
          <div className="relative aspect-square overflow-hidden rounded-xl">
            <MediaImage src={block.cover.src} focal={block.cover.focal} alt={block.cover.alt} sizes={mediaSizes.column} />
          </div>
          <div className="grid gap-1">
            <p className="text-caption font-semibold tracking-wide text-creator-accent-text uppercase">
              {t(`kind.${block.kind}`)} · {t("outNow")}
            </p>
            <h2 className="font-creator-display text-h1 leading-none" style={displayStyle}>
              {block.title}
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-2 @prose:grid-cols-3">
            {block.links.map((link) => (
              <li key={link.platform} className="min-w-0">
                <a
                  href={link.url}
                  className="group flex h-control-lg min-w-0 items-center gap-2 rounded-creator-button border border-creator-line bg-creator-glass px-3 text-small font-medium backdrop-blur-glass transition-colors duration-micro hover:border-creator-line-strong focus-visible:focus-ring"
                >
                  <PlatformGlyph platform={link.platform} size="sm" />
                  <span className="truncate">{platformName(link.platform)}</span>
                </a>
              </li>
            ))}
          </ul>
        </article>
      );

    case "shorts":
      return (
        <section aria-label={block.title} className="grid min-w-0 grid-cols-1 gap-3">
          {block.title ? <Eyebrow>{block.title}</Eyebrow> : null}
          <ul className="-mx-creator-gutter flex snap-x snap-mandatory gap-2 overflow-x-auto px-creator-gutter pb-1 @prose:mx-0 @prose:px-0">
            {block.items.map((item) => (
              <li key={item.url} className="w-2/5 shrink-0 snap-start @preview:w-1/3">
                <ClickToLoad
                  compact
                  provider="YouTube"
                  title={item.title}
                  className="aspect-short rounded-lg"
                  poster={<MediaImage src={item.poster.src} focal={item.poster.focal} alt="" sizes={mediaSizes.third} />}
                >
                  {item.views ? (
                    <span className="absolute start-2 bottom-2 rounded-full bg-creator-glass px-2 py-0.5 text-caption font-medium backdrop-blur-glass">
                      {f.compact(item.views)}
                    </span>
                  ) : null}
                </ClickToLoad>
              </li>
            ))}
          </ul>
        </section>
      );

    case "events":
      return (
        <section aria-label={block.title} className="grid min-w-0 grid-cols-1 gap-3">
          {block.title ? <Eyebrow>{block.title}</Eyebrow> : null}
          <ol className="grid gap-2">
            {block.items.map((event) => {
              const soldOut = event.status === "soldout";
              return (
                <li key={event.date + event.city}>
                  <EventRow
                    href={soldOut ? null : event.url}
                    className={cn(
                      "flex items-center gap-4 rounded-lg border border-creator-line bg-creator-surface p-3 pe-4",
                      !soldOut && "transition-colors duration-micro hover:border-creator-line-strong focus-visible:focus-ring",
                    )}
                  >
                    <span className="grid w-control-xl shrink-0 justify-items-center rounded-md bg-creator-surface-2 py-2 leading-none">
                      <span className="font-creator-display text-h2" style={displayStyle}>
                        {f.date(event.date, { day: "2-digit" })}
                      </span>
                      <span className="text-caption font-semibold text-creator-fg-muted uppercase">{f.date(event.date, { month: "short" })}</span>
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className={cn("truncate font-creator-display text-h3 leading-tight", soldOut && "text-creator-fg-muted line-through")} style={displayStyle}>
                        {event.city}
                      </span>
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
                  </EventRow>
                </li>
              );
            })}
          </ol>
        </section>
      );

    case "video":
      return (
        <figure className="grid min-w-0 grid-cols-1 gap-3 pt-2">
          <ClickToLoad
            provider="YouTube"
            title={block.title}
            className="aspect-video rounded-xl"
            poster={<MediaImage src={block.poster.src} focal={block.poster.focal} alt="" sizes={mediaSizes.column} />}
          >
            {block.duration ? (
              <span className="rounded-full bg-creator-glass px-2 py-1 font-mono text-creator-fg backdrop-blur-glass">
                {f.duration(block.duration)}
              </span>
            ) : null}
          </ClickToLoad>
          <figcaption className="font-creator-display text-h3 leading-tight" style={displayStyle}>
            {block.title}
          </figcaption>
        </figure>
      );

    case "link":
      return <CreatorLink label={block.title} href={block.url} variant={theme.buttonStyle} badge={block.badge} />;

    // Apps and skills get their full cards in Poster; here they are plain buttons to the store or repository.
    case "app": {
      const store = block.stores[0];
      return store ? <CreatorLink label={block.title} href={store.url} variant={theme.buttonStyle} /> : null;
    }
    case "repo":
      return <CreatorLink label={block.title} href={block.url} variant={theme.buttonStyle} />;

    case "product":
      return (
        <a
          href={block.url}
          className="group grid grid-cols-5 items-center gap-4 rounded-xl border border-creator-line bg-creator-surface p-3 transition-colors duration-micro hover:border-creator-line-strong focus-visible:focus-ring"
        >
          <span className="relative col-span-2 aspect-square overflow-hidden rounded-lg">
            <MediaImage src={block.image.src} focal={block.image.focal} alt={block.image.alt} sizes={mediaSizes.third} />
          </span>
          <span className="col-span-3 grid gap-2">
            <span className="font-creator-display text-h3 leading-tight" style={displayStyle}>
              {block.title}
            </span>
            <span className="text-body text-creator-fg-muted">{f.price(block.price, block.currency)}</span>
            <span className="inline-flex h-control-sm items-center justify-self-start rounded-creator-button bg-creator-accent px-4 text-small font-semibold text-creator-accent-fg">
              {t("buy")}
            </span>
          </span>
        </a>
      );

    case "card":
      return (
        <a href={block.url} className="group relative isolate block aspect-video overflow-hidden rounded-xl focus-visible:focus-ring">
          <MediaImage src={block.image.src} focal={block.image.focal} alt={block.image.alt} sizes={mediaSizes.column} />
          <span className="absolute inset-0 bg-linear-to-t from-creator-bg via-transparent to-transparent" />
          <span className="absolute inset-x-0 bottom-0 grid gap-1 p-5">
            <span className="font-creator-display text-h2 leading-none" style={displayStyle}>
              {block.title}
            </span>
            {block.description ? <span className="text-small text-creator-fg-muted">{block.description}</span> : null}
          </span>
        </a>
      );

    case "newsletter":
      return (
        <section className="grid gap-4 rounded-xl border border-creator-line bg-creator-surface p-5" aria-label={block.title}>
          <div className="grid gap-1">
            <h2 className="font-creator-display text-h2 leading-none" style={displayStyle}>
              {block.title}
            </h2>
            {block.description ? <p className="text-small text-creator-fg-muted">{block.description}</p> : null}
          </div>
          <NewsletterForm />
        </section>
      );

    case "header":
      return <Eyebrow>{block.title}</Eyebrow>;
    case "text":
      return <p className="text-body text-creator-fg-muted">{block.text}</p>;
    case "divider":
      return <hr className="my-4 border-creator-line" />;
    case "image":
      return (
        <div className="relative aspect-portrait overflow-hidden rounded-xl">
          <MediaImage src={block.image.src} focal={block.image.focal} alt={block.image.alt} sizes={mediaSizes.column} />
        </div>
      );
    case "gallery":
      return (
        <ul className="-mx-creator-gutter flex snap-x gap-2 overflow-x-auto px-creator-gutter">
          {block.images.map((image) => (
            <li key={image.src} className="relative aspect-portrait w-3/5 shrink-0 snap-start overflow-hidden rounded-lg">
              <MediaImage src={image.src} focal={image.focal} alt={image.alt} sizes={mediaSizes.half} />
            </li>
          ))}
        </ul>
      );
    // Portfolio blocks belong to the Poster direction; this one shows nothing for them.
    case "project":
    case "about":
    case "tools":
    case "timeline":
    case "quotes":
    case "contact":
    case "socials":
      return null;
  }
}
