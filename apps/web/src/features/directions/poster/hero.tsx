import { hasImage, type AiProfileField, type BlockOf, type Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { MediaImage, mediaSizes, Monogram, PlatformGlyph, platformName } from "../shared/creator-kit";
import { HeroMotion } from "../shared/motion";
import { HeroLive } from "./live";
import { ShareButton } from "./share";
import { displayStyle, pageSide } from "./styles";

type Profile = Page["profile"];

/** `data-ai-generated` on a profile text an AI draft wrote (AI Act Art. 50(2)); nothing otherwise. */
const aiText = (profile: Profile, field: AiProfileField) => (profile.aiFields?.includes(field) ? { "data-ai-generated": "true" } : {});

/**
 * Average advance per character of each display face, measured on real names (em per character).
 * Used to size the name so that it stays on one line whenever that still reads large.
 */
const GLYPH_WIDTH: Record<string, number> = { classic: 0.53, stage: 0.47, editorial: 0.46, modern: 0.49, bold: 0.48, elegant: 0.5, tech: 0.52, arabic: 0.47 };

function Name({ profile, isRtl, theme, compact = false }: { profile: Profile; isRtl: boolean; theme: ResolvedCreatorTheme; compact?: boolean }) {
  const t = useTranslations("creator");
  const pairing = PAIRING_IDS.find((id) => creatorTokens.pairings[id] === theme.pairing) ?? "classic";
  const ems = Array.from(profile.displayName).length * (GLYPH_WIDTH[pairing] ?? 0.53);
  // Room for the name: the column minus the gutters (and the verified badge), shared by its characters.
  const room = profile.verified
    ? "min(100cqi, var(--container-creator)) - 2 * var(--spacing-creator-gutter) - var(--spacing-icon-lg) - var(--spacing-2)"
    : "min(100cqi, var(--container-creator)) - 2 * var(--spacing-creator-gutter)";
  return (
    <h1
      className={cn(
        "font-creator-display text-balance break-words",
        // Never larger than the display size, never smaller than a headline; long names still wrap.
        // Compact (portfolios): a headline, so the work stays the loudest thing.
        compact
          ? "text-[length:clamp(var(--text-h2),var(--name-fit),var(--text-h1))] @prose:text-[length:clamp(var(--text-h2),var(--name-fit),var(--text-display-sm))]"
          : "text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display))] @prose:text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display-xl))]",
        isRtl ? "leading-tight" : "leading-none",
      )}
      style={{ ...displayStyle, "--name-fit": `calc((${room}) / ${ems.toFixed(2)})` } as CSSProperties}
      {...aiText(profile, "displayName")}
    >
      {/* The name runs in its own direction (a Latin name on an Arabic page, and the reverse), so its
          punctuation stays in place; the heading itself keeps the hero's alignment. */}
      <bdi dir="auto">{profile.displayName}</bdi>
      {profile.verified ? (
        <span className="ms-2 inline-block align-middle text-creator-accent-text">
          <Icon icon={BadgeCheck} size="lg" label={t("verified")} />
        </span>
      ) : null}
    </h1>
  );
}

/** Social profiles under the name: round tiles, or (plain) bare glyphs at a larger size for quiet looks. */
function Socials({ block, plain, start = false }: { block: BlockOf<"socials">; plain: boolean; start?: boolean }) {
  return (
    <ul className={cn("flex flex-wrap", start ? "-ms-3 justify-start" : "justify-center", plain ? "gap-2" : "gap-3")}>
      {block.items.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            aria-label={platformName(item.platform)}
            className={cn(
              "grid place-items-center rounded-full text-creator-fg duration-micro focus-visible:focus-ring active:scale-pressed",
              plain
                ? "size-touch-target transition-[opacity,scale] hover:opacity-secondary"
                : "size-control-xl bg-creator-surface-2 transition-[background-color,scale] hover:bg-creator-line-strong",
            )}
          >
            <PlatformGlyph platform={item.platform} size={plain ? "lg" : "md"} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Headline numbers: social proof right under the name, read as "value · label". */
function Stats({ stats }: { stats: NonNullable<Profile["stats"]> }) {
  return (
    <dl className="mt-1 grid w-full max-w-prose auto-cols-fr grid-flow-col divide-x divide-creator-line">
      {stats.map((stat) => (
        <div key={stat.label} className="flex min-w-0 flex-col-reverse items-center gap-1 px-2">
          <dt className="text-caption text-balance text-creator-fg-muted">{stat.label}</dt>
          <dd className="text-h3 leading-none font-bold whitespace-nowrap">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The creator's photo (or moving picture) filling its frame. */
function Photo({ profile, preview, className, imageClass }: { profile: Profile; preview: boolean; className?: string; imageClass?: string }) {
  const photo = profile.hero ?? profile.avatar;
  return (
    <div className={cn("relative overflow-hidden bg-creator-surface-2", className)}>
      <MediaImage src={photo.src} focal={photo.focal} alt={photo.alt} sizes={mediaSizes.column} priority={!preview} className={imageClass} />
      {profile.motion ? <HeroMotion src={profile.motion.src} /> : null}
    </div>
  );
}

/**
 * The hero. Nine treatments chosen by the template:
 * - portrait: the photo fades into the page, the name overlaps the fade;
 * - mono: the same in black and white (photo and moving picture), for editorial looks;
 * - duotone: the photo is toned into the page color (screen for dark photos, multiply for light);
 * - logo: the creator's logo over a softly blurred photo (falls back to portrait without a logo);
 * - cinema (Studio): a full-height still that settles like a slow camera move, the name set low and
 *   large at the reading start, over the photo;
 * - halo (Aura): a round portrait inside a slowly turning ring of the page's colors;
 * - inset (Folio): a framed picture that uncovers itself, the name smaller, at the reading start;
 * - frame (Signal): a square picture whose corner marks lock on as the page opens, a blinking cursor;
 * - arch (Bloom): the portrait in an arch that rises in, an outline arch offset behind it.
 * On scroll the hero softens and fades away (CSS scroll-driven animation, no JavaScript). A moving
 * picture (profile.motion) loops silently over the photo, always in its own colors (portrait). The
 * newer templates (motion "reveal") bring their lines in one after the other; never with reduced motion.
 */
export function PosterHero({
  profile,
  socials,
  live,
  theme,
  preview,
}: {
  profile: Profile;
  socials: BlockOf<"socials"> | undefined;
  live?: BlockOf<"live"> | undefined;
  theme: ResolvedCreatorTheme;
  preview: boolean;
}) {
  const isRtl = profile.locale === "ar";
  const photo = profile.hero ?? profile.avatar;
  const layout = theme.layout.hero;
  // A moving picture always shows in its own colors: toning a face on video into the page color
  // reads as a filter, not as a portrait.
  const treatment = !hasImage(photo) && !profile.logo ? "monogram" : layout === "logo" && !profile.logo ? "portrait" : layout === "duotone" && profile.motion ? "portrait" : layout;
  const plain = theme.layout.socials === "plain";
  const enter = theme.layout.motion === "reveal";
  // Each line of the hero rises in after the one before (newer templates only).
  const rise = (index: number) => (enter ? { className: "poster-rise", style: { "--poster-i": index } as CSSProperties } : { className: undefined, style: undefined });
  const start = treatment === "cinema" || treatment === "inset";

  const lines = (
    <>
      {live ? <HeroLive block={live} /> : null}
      {treatment === "logo" && profile.logo ? null : (
        <div className={rise(0).className} style={rise(0).style}>
          <Name profile={profile} isRtl={isRtl} theme={theme} compact={treatment === "inset"} />
        </div>
      )}
      {profile.tagline ? (
        <p dir="auto" className={cn(pageSide, "text-small font-semibold tracking-wide text-balance uppercase", rise(1).className)} style={rise(1).style} {...aiText(profile, "tagline")}>
          {profile.tagline}
          {treatment === "frame" ? (
            <span aria-hidden className="poster-caret ms-1 text-creator-accent-text">
              ▍
            </span>
          ) : null}
        </p>
      ) : null}
      {profile.stats?.length ? <Stats stats={profile.stats} /> : null}
      {profile.bio ? (
        <p dir="auto" className={cn(pageSide, "max-w-prose text-body-lg text-balance text-creator-fg-muted", rise(2).className)} style={rise(2).style} {...aiText(profile, "bio")}>
          {profile.bio}
        </p>
      ) : null}
      {socials ? (
        <div className={cn("pt-2", rise(3).className)} style={rise(3).style}>
          <Socials block={socials} plain={plain} start={start} />
        </div>
      ) : null}
    </>
  );

  // Studio: the name and lines sit low over the still, at the reading start.
  if (treatment === "cinema") {
    return (
      <header className="poster-hero-timeline grid">
        <div className="poster-hero-fade relative grid aspect-short max-h-dvh w-full content-end overflow-hidden @prose:rounded-t-xl">
          <Photo profile={profile} preview={preview} className="absolute! inset-0" imageClass="poster-settle" />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-creator-bg from-10% to-transparent to-65%" />
          <div className="relative grid justify-items-start gap-3 px-creator-gutter pb-8 text-start">{lines}</div>
        </div>
      </header>
    );
  }

  const media =
    treatment === "monogram" ? (
      // No photo yet: a large monogram on the accent color, so a new page still feels finished.
      <div className="poster-hero-fade grid w-full justify-items-center pt-20 pb-24">
        <span className="relative size-avatar-2xl overflow-hidden rounded-full text-display">
          <Monogram name={profile.displayName} />
        </span>
      </div>
    ) : treatment === "logo" && profile.logo ? (
      <div className="poster-hero-fade relative grid aspect-square w-full place-items-center overflow-hidden mask-b-from-55% mask-b-to-100% @prose:rounded-t-xl">
        <MediaImage src={photo.src} focal={photo.focal} alt="" sizes={mediaSizes.column} priority={!preview} className="scale-lift blur-glass" />
        <div aria-hidden className="absolute inset-0 bg-creator-bg opacity-secondary" />
        <h1 className="relative w-3/5">
          <span className="relative block aspect-square">
            <MediaImage src={profile.logo.src} alt={profile.displayName} sizes={mediaSizes.half} className="object-contain" />
          </span>
        </h1>
      </div>
    ) : treatment === "halo" ? (
      // Aura: the portrait inside a ring of the page's colors, turning slowly.
      <div className="poster-hero-fade grid w-full justify-items-center pt-16 pb-2">
        <span className="poster-arch-in relative grid size-avatar-2xl place-items-center @prose:size-avatar-2xl">
          <span aria-hidden className="poster-halo absolute -inset-2" />
          <span className="relative size-full rounded-full bg-creator-bg p-1">
            <Photo profile={profile} preview={preview} className="size-full rounded-full" />
          </span>
        </span>
      </div>
    ) : treatment === "inset" ? (
      // Folio: a framed picture with a margin, uncovering itself.
      <div className="poster-hero-fade w-full px-creator-gutter pt-creator-gutter @prose:px-0 @prose:pt-0">
        <Photo profile={profile} preview={preview} className="poster-uncover aspect-portrait rounded-creator-card" />
      </div>
    ) : treatment === "frame" ? (
      // Signal: a square picture in four corner marks.
      <div className="poster-hero-fade grid w-full justify-items-center pt-16 pb-2">
        <div className="relative aspect-square w-3/5">
          <span aria-hidden className="poster-corner poster-corner-ts" />
          <span aria-hidden className="poster-corner poster-corner-te" />
          <span aria-hidden className="poster-corner poster-corner-bs" />
          <span aria-hidden className="poster-corner poster-corner-be" />
          <Photo profile={profile} preview={preview} className="size-full rounded-creator-card" />
        </div>
      </div>
    ) : treatment === "arch" ? (
      // Bloom: the portrait in an arch, an outline arch offset behind it.
      <div className="poster-hero-fade grid w-full justify-items-center pt-12 pb-2">
        <div className="poster-arch-in relative w-3/4">
          <span aria-hidden className="poster-arch-line rounded-t-full rounded-b-creator-card" />
          <Photo profile={profile} preview={preview} className="aspect-portrait rounded-t-full rounded-b-creator-card" />
        </div>
      </div>
    ) : (
      <div
        className={cn(
          "poster-hero-fade relative aspect-portrait w-full overflow-hidden mask-b-from-45% mask-b-to-90% @prose:rounded-t-xl",
          treatment === "duotone" && "isolate bg-creator-bg",
        )}
      >
        <MediaImage
          src={photo.src} focal={photo.focal}
          alt={photo.alt}
          sizes={mediaSizes.column}
          priority={!preview}
          className={
            treatment === "duotone"
              ? cn("grayscale contrast-125", photo.tone === "light" ? "mix-blend-multiply" : "mix-blend-screen")
              : treatment === "mono"
                ? "grayscale"
                : undefined
          }
        />
        {/* A moving picture plays over the photo (the photo is its poster and its still version). */}
        {profile.motion ? <HeroMotion src={profile.motion.src} className={treatment === "mono" ? "grayscale" : undefined} /> : null}
      </div>
    );

  const below = treatment === "halo" || treatment === "inset" || treatment === "frame" || treatment === "arch";
  return (
    <header className={cn("poster-hero-timeline grid", start ? "justify-items-stretch" : "justify-items-center text-center")}>
      {media}
      <div
        className={cn(
          "relative grid gap-3 px-creator-gutter",
          start ? "justify-items-start text-start @prose:px-0" : "justify-items-center",
          below ? "pt-6" : treatment === "logo" && profile.logo ? "-mt-6" : treatment === "monogram" ? "-mt-12" : "-mt-16",
        )}
      >
        {lines}
      </div>
    </header>
  );
}

/**
 * Compact bar that slides in once the hero has scrolled away: avatar, name, share.
 * Driven by the hero's view timeline; browsers without scroll-driven animations never show it.
 */
export function PosterBar({ profile }: { profile: Profile }) {
  return (
    <div className="pointer-events-none sticky top-0 layer-sticky h-0">
      <div className="poster-bar pointer-events-auto flex h-control-xl items-center gap-3 border-b border-creator-line bg-creator-glass ps-creator-gutter pe-2 backdrop-blur-glass">
        <span className="relative size-control-sm shrink-0 overflow-hidden rounded-full bg-creator-surface-2 text-small">
          {hasImage(profile.avatar) ? <MediaImage src={profile.avatar.src} focal={profile.avatar.focal} alt="" sizes={mediaSizes.thumb} /> : <Monogram name={profile.displayName} />}
        </span>
        <p dir="auto" className={cn(pageSide, "min-w-0 flex-1 truncate text-body font-semibold")} {...aiText(profile, "displayName")}>
          {profile.displayName}
        </p>
        <ShareButton title={profile.displayName} />
      </div>
    </div>
  );
}
