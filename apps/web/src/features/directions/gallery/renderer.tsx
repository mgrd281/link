import { isBlockActive, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, BadgeCheck, MapPin, Radio } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CreatorLink } from "@/features/creator/link-button";
import { themeStyle } from "@/features/creator/theme";

import { CreatorFooter, MediaImage, mediaSizes, PlatformGlyph, platformName, useCreatorFormat } from "../shared/creator-kit";
import { ClickToLoad, NewsletterForm } from "../shared/islands";

/**
 * Direction A — "Gallery": quiet, editorial, typographic.
 * A magazine page for one person: big display name, calm cards, generous whitespace.
 */
export function GalleryRenderer({ page, theme, preview = false }: { page: Page; theme: ResolvedCreatorTheme; preview?: boolean }) {
  const { profile } = page;
  const blocks = page.blocks.filter((block) => isBlockActive(block));
  const socials = blocks.find((block): block is BlockOf<"socials"> => block.type === "socials");
  const isRtl = profile.locale === "ar";

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
      <div className="mx-auto max-w-creator px-creator-gutter">
        <header className="grid justify-items-center gap-5 pt-16 pb-10 text-center @prose:pt-24">
          <div className="relative size-avatar-xl overflow-hidden rounded-full border border-creator-line bg-creator-surface-2 @prose:size-avatar-2xl">
            <MediaImage src={profile.avatar.src} focal={profile.avatar.focal} alt={profile.avatar.alt} sizes={mediaSizes.avatar} priority={!preview} />
          </div>
          <div className="grid gap-3">
            <h1
              className="font-creator-display text-h1 leading-tight @prose:text-display"
              style={{
                fontWeight: "var(--creator-display-weight)",
                letterSpacing: "var(--creator-display-tracking)",
                textTransform: "var(--creator-display-transform)" as "none",
              }}
            >
              {profile.displayName}
              {profile.verified ? (
                <BadgeCheckMark />
              ) : null}
            </h1>
            {profile.location ? (
              <p className="inline-flex items-center justify-center gap-1 text-small text-creator-fg-muted">
                <Icon icon={MapPin} size="sm" />
                {profile.location}
              </p>
            ) : null}
          </div>
          <p className="max-w-prose text-body-lg text-creator-fg-muted">{profile.bio}</p>
          {socials ? <SocialRow block={socials} /> : null}
        </header>

        <main className="grid grid-cols-1 gap-4 pb-6">
          {blocks
            .filter((block) => block.type !== "socials")
            .map((block) => (
              <GalleryBlock key={block.id} block={block} theme={theme} />
            ))}
        </main>
        <CreatorFooter />
      </div>
    </div>
  );
}

function BadgeCheckMark() {
  const t = useTranslations("creator");
  return (
    <span className="ms-2 inline-block align-middle text-creator-accent-text">
      <Icon icon={BadgeCheck} size="lg" label={t("verified")} />
    </span>
  );
}

function SocialRow({ block }: { block: BlockOf<"socials"> }) {
  return (
    <ul className="flex flex-wrap justify-center gap-1">
      {block.items.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            aria-label={platformName(item.platform)}
            className="group grid size-touch-target place-items-center rounded-full text-creator-fg transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring"
          >
            <PlatformGlyph platform={item.platform} />
          </a>
        </li>
      ))}
    </ul>
  );
}

const card = "overflow-hidden rounded-lg border border-creator-line bg-creator-surface";

function SectionTitle({ children }: { children: string }) {
  return <h2 className="px-1 pt-8 pb-1 text-small font-semibold tracking-wide text-creator-fg-muted uppercase">{children}</h2>;
}

function GalleryBlock({ block, theme }: { block: Block; theme: ResolvedCreatorTheme }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);

  switch (block.type) {
    case "music":
      return (
        <article className={cn(card, "grid gap-5 p-4")}>
          <div className="flex items-center gap-4">
            <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-md @preview:w-32">
              <MediaImage src={block.cover.src} focal={block.cover.focal} alt={block.cover.alt} sizes={mediaSizes.cover} />
            </div>
            <div className="grid min-w-0 gap-1">
              <p className="text-caption font-medium tracking-wide text-creator-accent-text uppercase">
                {t(`kind.${block.kind}`)} · {t("outNow")}
              </p>
              <h2 className="font-creator-display text-h2 leading-tight" style={{ fontWeight: "var(--creator-display-weight)" }}>
                {block.title}
              </h2>
              <p className="text-small text-creator-fg-muted">{block.artist}</p>
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-2 @preview:grid-cols-6">
            {block.links.map((link) => (
              <li key={link.platform}>
                <a
                  href={link.url}
                  aria-label={t("listenOn", { platform: platformName(link.platform) })}
                  className="group grid h-control-lg place-items-center rounded-md bg-creator-surface-2 text-creator-fg transition-colors duration-micro hover:text-creator-accent-text focus-visible:focus-ring"
                >
                  <PlatformGlyph platform={link.platform} />
                </a>
              </li>
            ))}
          </ul>
        </article>
      );

    case "live":
      return block.isLive ? (
        <a
          href={block.url}
          className={cn(card, "flex items-center gap-3 p-4 transition-colors duration-standard hover:border-creator-line-strong focus-visible:focus-ring")}
        >
          <span className="relative grid size-control-md shrink-0 place-items-center rounded-full bg-creator-accent text-creator-accent-fg">
            <Icon icon={Radio} size="sm" />
          </span>
          <span className="grid min-w-0 flex-1">
            <span className="text-small font-semibold">
              {t("liveNow")} · {platformName(block.platform)}
            </span>
            <span className="truncate text-small text-creator-fg-muted">
              {block.title} · {t("watching", { count: f.compact(block.viewers ?? 0) })}
            </span>
          </span>
          <Icon icon={ArrowUpRight} size="sm" className="shrink-0 rtl:-scale-x-100" />
        </a>
      ) : null;

    case "link":
      return <CreatorLink label={block.title} href={block.url} variant={theme.buttonStyle} badge={block.badge} />;

    // Apps and skills get their full cards in Poster; here they are plain buttons to the store or repository.
    case "app": {
      const store = block.stores[0];
      return store ? <CreatorLink label={block.title} href={store.url} variant={theme.buttonStyle} /> : null;
    }
    case "repo":
      return <CreatorLink label={block.title} href={block.url} variant={theme.buttonStyle} />;

    case "events":
      return (
        <section aria-label={block.title} className="grid gap-2">
          {block.title ? <SectionTitle>{block.title}</SectionTitle> : null}
          <ol className={cn(card, "divide-y divide-creator-line")}>
            {block.items.map((event) => (
              <li key={event.date + event.city} className="flex items-center gap-4 px-4 py-3">
                <div className="grid w-12 shrink-0 justify-items-center leading-none">
                  <span className="text-caption font-medium text-creator-fg-muted uppercase">{f.date(event.date, { month: "short" })}</span>
                  <span className="font-creator-display text-h2" style={{ fontWeight: "var(--creator-display-weight)" }}>
                    {f.date(event.date, { day: "numeric" })}
                  </span>
                </div>
                <div className="grid min-w-0 flex-1">
                  <span className={cn("truncate text-body font-medium", event.status === "soldout" && "text-creator-fg-muted line-through")}>
                    {event.city}
                  </span>
                  <span className="truncate text-small text-creator-fg-muted">{event.venue}</span>
                </div>
                {event.status === "soldout" ? (
                  <span className="shrink-0 text-small text-creator-fg-muted">{t("soldOut")}</span>
                ) : (
                  <a
                    href={event.url}
                    className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-creator-button border border-creator-line-strong px-3 text-small font-medium transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring"
                  >
                    {event.status === "few" ? <span aria-hidden className="size-dot rounded-full bg-creator-accent" /> : null}
                    {event.status === "few" ? t("fewLeft") : t("tickets")}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </section>
      );

    case "video":
      return (
        <figure className={cn(card)}>
          <ClickToLoad
            provider="YouTube"
            title={block.title}
            className="aspect-video"
            poster={<MediaImage src={block.poster.src} focal={block.poster.focal} alt="" sizes={mediaSizes.column} />}
          >
            {block.duration ? (
              <span className="rounded-full bg-creator-glass px-2 py-1 font-mono text-creator-fg backdrop-blur-glass">
                {f.duration(block.duration)}
              </span>
            ) : null}
          </ClickToLoad>
          <figcaption className="px-4 py-3 text-body font-medium">{block.title}</figcaption>
        </figure>
      );

    case "shorts":
      return (
        <section aria-label={block.title} className="grid gap-2">
          {block.title ? <SectionTitle>{block.title}</SectionTitle> : null}
          <ul className="grid grid-cols-3 gap-2">
            {block.items.map((item) => (
              <li key={item.url} className="grid gap-2">
                <ClickToLoad
                  compact
                  provider="YouTube"
                  title={item.title}
                  className="aspect-short rounded-md"
                  poster={<MediaImage src={item.poster.src} focal={item.poster.focal} alt="" sizes={mediaSizes.third} />}
                />
                <span className="line-clamp-2 text-caption text-creator-fg-muted">
                  {item.title}
                  {item.views ? ` · ${t("views", { count: f.compact(item.views) })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      );

    case "product":
      return (
        <a href={block.url} className={cn(card, "flex items-center gap-4 p-3 transition-colors duration-standard hover:border-creator-line-strong focus-visible:focus-ring")}>
          <span className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-md">
            <MediaImage src={block.image.src} focal={block.image.focal} alt={block.image.alt} sizes={mediaSizes.thumb} />
          </span>
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="line-clamp-2 text-body font-medium">{block.title}</span>
            <span className="text-small text-creator-fg-muted">{f.price(block.price, block.currency)}</span>
          </span>
          <span className="inline-flex h-control-sm shrink-0 items-center rounded-creator-button bg-creator-accent px-4 text-small font-medium text-creator-accent-fg">
            {t("buy")}
          </span>
        </a>
      );

    case "card":
      return (
        <a href={block.url} className={cn(card, "group grid transition-colors duration-standard hover:border-creator-line-strong focus-visible:focus-ring")}>
          <span className="relative aspect-video">
            <MediaImage src={block.image.src} focal={block.image.focal} alt={block.image.alt} sizes={mediaSizes.column} />
          </span>
          <span className="grid gap-1 p-4">
            <span className="font-creator-display text-h3" style={{ fontWeight: "var(--creator-display-weight)" }}>
              {block.title}
            </span>
            {block.description ? <span className="text-small text-creator-fg-muted">{block.description}</span> : null}
          </span>
        </a>
      );

    case "newsletter":
      return (
        <section className={cn(card, "grid gap-4 p-5")} aria-label={block.title}>
          <div className="grid gap-1">
            <h2 className="font-creator-display text-h3" style={{ fontWeight: "var(--creator-display-weight)" }}>
              {block.title}
            </h2>
            {block.description ? <p className="text-small text-creator-fg-muted">{block.description}</p> : null}
          </div>
          <NewsletterForm />
        </section>
      );

    case "header":
      return <SectionTitle>{block.title}</SectionTitle>;
    case "text":
      return <p className="px-1 text-body text-creator-fg-muted">{block.text}</p>;
    case "divider":
      return <hr className="my-4 border-creator-line" />;
    case "image":
      return (
        <div className={cn(card, "relative aspect-portrait")}>
          <MediaImage src={block.image.src} focal={block.image.focal} alt={block.image.alt} sizes={mediaSizes.column} />
        </div>
      );
    case "gallery":
      return (
        <ul className="grid grid-cols-2 gap-2">
          {block.images.map((image) => (
            <li key={image.src} className="relative aspect-square overflow-hidden rounded-md">
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
