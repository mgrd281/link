import { hasImage, type BlockOf } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight, Scale, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CopyButton } from "../shared/copy-button";
import { MediaImage, mediaSizes, Monogram, PlatformGlyph, useCreatorFormat } from "../shared/creator-kit";
import { GetButton, OtherStores } from "./app-store";
import { StoreBadges } from "./store-badges";
import { AdLabel } from "./cards";
import { pressable, type HeadingTag } from "./styles";

/** An app icon: the store's picture with the rounded corners phones give icons, or its initials. */
function AppIcon({ block, size = "lg" }: { block: BlockOf<"app">; size?: "lg" | "xl" }) {
  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden border border-creator-line bg-creator-surface-2",
        size === "xl" ? "size-avatar-xl rounded-lg" : "size-avatar-lg rounded-md",
      )}
    >
      {hasImage(block.icon) ? <MediaImage src={block.icon.src} alt="" sizes={mediaSizes.thumb} /> : <Monogram name={block.title} className={size === "xl" ? "text-h2" : "text-h3"} />}
    </span>
  );
}

/** Rating, category and price in one quiet line ("★ 4,8 · Produktivität · Kostenlos"). */
function AppFacts({ block, pricing = true, wrap = false }: { block: BlockOf<"app">; pricing?: boolean; wrap?: boolean }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const rating = block.rating === undefined ? null : new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(block.rating);
  const facts = [block.category, pricing && block.pricing ? t(`pricing.${block.pricing}`) : undefined].filter(Boolean);
  if (!rating && facts.length === 0) return null;
  return (
    <p className={cn("flex min-w-0 items-center gap-1 text-caption text-creator-fg-muted", wrap && "flex-wrap")}>
      {rating ? (
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-creator-fg">
          <Icon icon={Star} size="sm" className="fill-current text-creator-accent-text" />
          <span aria-hidden>{rating}</span>
          <span className="sr-only">{t("rating", { rating: rating })}</span>
        </span>
      ) : null}
      {rating && facts.length > 0 ? <span aria-hidden>·</span> : null}
      {facts.length > 0 ? <span className={wrap ? undefined : "truncate"}>{facts.join(" · ")}</span> : null}
    </p>
  );
}

/** A promo code visitors copy in one tap ("CODE  NORA20  ⧉"). */
function CodeChip({ code, app }: { code: string; app: string }) {
  const t = useTranslations("creator");
  return (
    <CopyButton
      value={code}
      label={t("copyCode", { code, app })}
      className="inline-flex h-control-sm items-center gap-2 rounded-full border border-dashed border-creator-line-strong bg-creator-surface ps-3 pe-2 text-small hover:bg-creator-surface-2"
    >
      <span className="text-caption font-semibold tracking-wide text-creator-fg uppercase">{t("code")}</span>{" "}
      {/* The space keeps "Code NORA20" one phrase for screen readers and voice control (label in name). */}
      <bdi dir="ltr" className="font-mono font-semibold tracking-wide">
        {code}
      </bdi>
    </CopyButton>
  );
}

/**
 * One app, the way app stores list them: icon, name, maker and category, rating and price, and one
 * button that opens the visitor's own store. Under it, in the creator's words, why it is worth it,
 * a code to copy and the other stores.
 */
function AppItem({ block, heading: Heading }: { block: BlockOf<"app">; heading: HeadingTag }) {
  const t = useTranslations("creator");
  const more = Boolean(block.description) || Boolean(block.code) || block.stores.length > 1;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 p-3 @prose:p-4">
      <AppIcon block={block} />
      <div className="grid min-w-0 gap-0.5">
        <Heading className="truncate text-body-lg leading-snug font-semibold">{block.title}</Heading>
        {/* The ad label sits right under the name, where nobody can miss it (UWG § 5a); the maker gives way, never the name. */}
        {block.developer || block.affiliate ? (
          <p className="flex min-w-0 items-center gap-2 text-small text-creator-fg-muted">
            {block.affiliate ? <AdLabel /> : null}
            {block.developer ? <span className="truncate">{block.developer}</span> : null}
          </p>
        ) : null}
        <AppFacts block={block} pricing={false} />
      </div>
      {/* As in the stores: the price under the button. */}
      <div className="grid justify-items-center gap-1">
        <GetButton title={block.title} stores={block.stores} />
        {block.pricing ? <span className="text-center text-caption leading-tight text-creator-fg-muted">{t(`pricing.${block.pricing}`)}</span> : null}
      </div>
      {more ? (
        <div className="col-span-2 col-start-2 grid gap-2">
          {block.description ? <p className="text-small text-pretty">{block.description}</p> : null}
          {block.code || block.stores.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              {block.code ? <CodeChip code={block.code} app={block.title} /> : null}
              <OtherStores title={block.title} stores={block.stores} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Apps from the creator's videos: one card, one app per row, hairlines between them (consecutive
 * apps on a page become one list, like a store's chart). A highlighted app leads with the accent.
 */
export function AppList({ apps, surface, heading }: { apps: BlockOf<"app">[]; surface: string; heading: HeadingTag }) {
  return (
    <ul className={cn("grid divide-y divide-creator-line overflow-hidden rounded-creator-card", surface)}>
      {apps.map((app) => (
        <li key={app.id} className={cn("relative", app.highlight && "border-s-emphasis border-creator-accent")}>
          <AppItem block={app} heading={heading} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The page's featured app (its first highlighted one, or its only one): a card like the top of a store
 * page, with a large icon, the name, maker, rating, category and price, the creator's line and code,
 * and the official App Store and Google Play badges under it, in a subordinate place as Apple asks.
 */
export function AppFeature({ block, surface, heading: Heading }: { block: BlockOf<"app">; surface: string; heading: HeadingTag }) {
  return (
    <article className={cn("grid gap-4 rounded-creator-card p-4 @prose:p-5", surface)}>
      <div className="flex items-center gap-4">
        <AppIcon block={block} size="xl" />
        <div className="grid min-w-0 gap-1">
          <Heading className="text-h3 leading-tight font-semibold text-balance break-words">{block.title}</Heading>
          {block.developer || block.affiliate ? (
            <p className="flex min-w-0 items-center gap-2 text-small text-creator-fg-muted">
              {block.affiliate ? <AdLabel /> : null}
              {block.developer ? <span className="truncate">{block.developer}</span> : null}
            </p>
          ) : null}
          <AppFacts block={block} wrap />
        </div>
      </div>
      {block.description ? <p className="text-body text-pretty">{block.description}</p> : null}
      {block.code ? (
        <div className="flex">
          <CodeChip code={block.code} app={block.title} />
        </div>
      ) : null}
      <StoreBadges title={block.title} stores={block.stores} />
    </article>
  );
}

/**
 * A skill or repository from GitHub: where it lives (owner/repo), what it does, its stars, language
 * and license, and the install command to copy in one tap. "View on GitHub" opens it.
 */
export function RepoCard({ block, surface, heading: Heading }: { block: BlockOf<"repo">; surface: string; heading: HeadingTag }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  const where = `${block.owner}/${block.repo}${block.path ? `/${block.path}` : ""}`;
  return (
    <article className={cn("grid gap-3 rounded-creator-card p-4", surface, block.highlight && "border border-creator-accent")}>
      <div className="flex items-start gap-3">
        <span className="grid size-control-lg shrink-0 place-items-center rounded-md bg-creator-surface-2">
          <PlatformGlyph platform="github" size="md" />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p dir="ltr" className="truncate text-start font-mono text-caption text-creator-fg-muted">
            {where}
          </p>
          <Heading className="text-body-lg leading-snug font-semibold text-balance break-words">{block.title}</Heading>
        </div>
        {block.kind === "skill" ? <span className="shrink-0 rounded-full bg-creator-accent px-2 py-0.5 text-caption font-semibold text-creator-accent-fg">{t("skill")}</span> : null}
      </div>
      {block.description ? <p className="line-clamp-3 text-small text-pretty text-creator-fg-muted">{block.description}</p> : null}
      {block.stars !== undefined || block.language || block.license ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-creator-fg-muted">
          {block.stars !== undefined ? (
            <li className="inline-flex items-center gap-1">
              <Icon icon={Star} size="sm" />
              <span aria-hidden className="font-semibold text-creator-fg">
                {f.compact(block.stars)}
              </span>
              <span className="sr-only">{t("stars", { count: block.stars })}</span>
            </li>
          ) : null}
          {block.language ? (
            <li className="inline-flex items-center gap-1">
              <span aria-hidden className="size-dot rounded-full bg-creator-accent" />
              {block.language}
            </li>
          ) : null}
          {block.license ? (
            <li className="inline-flex items-center gap-1">
              <Icon icon={Scale} size="sm" />
              {block.license}
            </li>
          ) : null}
        </ul>
      ) : null}
      {block.install ? (
        <div dir="ltr" className="flex min-w-0 items-center gap-2 rounded-md bg-creator-surface-2 py-1 ps-3 pe-1">
          {/* Wraps instead of cutting off, so the skill's name stays readable on a phone. */}
          <code className="line-clamp-3 min-w-0 flex-1 py-1 font-mono text-small wrap-anywhere">
            <span aria-hidden className="text-creator-accent-text select-none">
              ${" "}
            </span>
            {block.install}
          </code>
          <CopyButton
            value={block.install}
            label={t("copyInstall", { name: block.title })}
            className="grid size-touch-target shrink-0 place-items-center rounded-md text-creator-fg hover:bg-creator-line"
          />
        </div>
      ) : null}
      <a
        href={block.url}
        className={cn(
          "group inline-flex h-control-md items-center justify-center gap-2 rounded-creator-button border border-creator-line-strong px-4 text-small font-semibold",
          pressable,
        )}
      >
        <PlatformGlyph platform="github" size="sm" />
        {t("viewOnGithub")}
        <Icon icon={ArrowUpRight} size="sm" className="transition-transform duration-micro group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
      </a>
    </article>
  );
}
