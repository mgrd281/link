import { hasImage, type AiProfileField, type BlockOf, type Page } from "@linkyo/blocks";
import { contactStatus } from "@linkyo/blocks/project";
import { creatorTokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { BadgeCheck, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { MediaImage, mediaSizes, Monogram, PlatformGlyph, platformName } from "../shared/creator-kit";
import { LinkIconGlyph } from "../shared/link-icons";
import { HeroMotion } from "../shared/motion";
import { HeroLive } from "./live";
import { plateFrame, plateRatio } from "./projects";
import { ShareButton } from "./share";
import { displayStyle, pageSide, pressable } from "./styles";

type Profile = Page["profile"];
type Contact = BlockOf<"contact">;
/** The page's one primary action (`primaryAction`). */
type Primary = Contact["primary"];

/** `data-ai-generated` on a profile text an AI draft wrote (AI Act Art. 50(2)); nothing otherwise. */
export const aiText = (profile: Profile, field: AiProfileField) => (profile.aiFields?.includes(field) ? { "data-ai-generated": "true" } : {});

/**
 * Average advance per character of each display face, measured on real names (em per character).
 * Used to size the name so that it stays on one line whenever that still reads large.
 */
export const GLYPH_WIDTH: Record<string, number> = { classic: 0.53, stage: 0.47, editorial: 0.46, modern: 0.49, bold: 0.48, elegant: 0.5, tech: 0.52, arabic: 0.47 };

/**
 * The name's sizes in the two portfolio heroes, fitted like every name. The plate keeps it quiet on
 * phones (the work is the loudest thing) and lets it grow beside the plate; the statement sets it as
 * large as the screen allows. Arabic: the plate's light weight reads one step larger on phones, and
 * no Arabic name takes the largest step.
 */
const NAME_SCALE = {
  plate: {
    ltr: "text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display-sm))] @work:text-[length:clamp(var(--text-h1),var(--name-fit-work),var(--text-display-xl))] leading-none",
    rtl: "text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display))] @work:text-[length:clamp(var(--text-h1),var(--name-fit-work),var(--text-display-xl))] leading-snug",
  },
  statement: {
    ltr: "text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display-xl))] @work:text-[length:clamp(var(--text-h1),var(--name-fit-work),var(--text-display-2xl))] leading-none",
    rtl: "text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display))] @work:text-[length:clamp(var(--text-h1),var(--name-fit-work),var(--text-display-xl))] leading-tight",
  },
} as const;

function Name({ profile, isRtl, theme, compact = false, scale }: { profile: Profile; isRtl: boolean; theme: ResolvedCreatorTheme; compact?: boolean; scale?: keyof typeof NAME_SCALE }) {
  const t = useTranslations("creator");
  const pairing = PAIRING_IDS.find((id) => creatorTokens.pairings[id] === theme.pairing) ?? "classic";
  const ems = Array.from(profile.displayName).length * (GLYPH_WIDTH[pairing] ?? 0.53);
  // Room for the name: the column minus the gutters (and the verified badge), shared by its characters.
  const room = profile.verified
    ? "min(100cqi, var(--container-creator)) - 2 * var(--spacing-creator-gutter) - var(--spacing-icon-lg) - var(--spacing-2)"
    : "min(100cqi, var(--container-creator)) - 2 * var(--spacing-creator-gutter)";
  // On the wide canvas: five of its twelve columns beside the plate, or the whole canvas.
  const canvas = "min(100cqi - 2 * var(--spacing-creator-gutter), var(--container-work))";
  const badge = profile.verified ? " - var(--spacing-icon-lg) - var(--spacing-2)" : "";
  const workRoom = scale === "plate" ? `(${canvas} - 11 * var(--spacing-6)) * 5 / 12 + 4 * var(--spacing-6)${badge}` : `${canvas}${badge}`;
  const fit = scale ? { "--name-fit": `calc((${room}) / ${ems.toFixed(2)})`, "--name-fit-work": `calc((${workRoom}) / ${ems.toFixed(2)})` } : { "--name-fit": `calc((${room}) / ${ems.toFixed(2)})` };
  return (
    <h1
      className={cn(
        "font-creator-display text-balance break-words",
        // Never larger than the display size, never smaller than a headline; long names still wrap.
        // Compact (portfolios): a headline, so the work stays the loudest thing.
        scale
          ? NAME_SCALE[scale][isRtl ? "rtl" : "ltr"]
          : compact
            ? "text-[length:clamp(var(--text-h2),var(--name-fit),var(--text-h1))] @prose:text-[length:clamp(var(--text-h2),var(--name-fit),var(--text-display-sm))]"
            : "text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display))] @prose:text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display-xl))]",
        !scale && (isRtl ? "leading-tight" : "leading-none"),
      )}
      style={{ ...displayStyle, ...fit }}
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
export function Socials({ block, plain, start = false }: { block: BlockOf<"socials">; plain: boolean; start?: boolean }) {
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
function Stats({ stats, start = false }: { stats: NonNullable<Profile["stats"]>; start?: boolean }) {
  return (
    <dl className={cn("mt-1 grid w-full max-w-prose auto-cols-fr grid-flow-col divide-x divide-creator-line", start && "@prose:w-auto @prose:auto-cols-max")}>
      {stats.map((stat) => (
        // In a hero that starts at the reading edge the first number stands on that edge too.
        <div key={stat.label} className={cn("flex min-w-0 flex-col-reverse gap-1", start ? "items-start px-4 first:ps-0 @prose:px-6" : "items-center px-2")}>
          <dt className="text-caption text-balance text-creator-fg-muted">{stat.label}</dt>
          <dd className="text-h3 leading-none font-bold whitespace-nowrap">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The owner's availability in their own words: a still dot in the accent and the text, which carries the meaning. */
function StatusLine({ text }: { text: string }) {
  return (
    <p className="inline-flex min-w-0 items-center gap-2 text-small font-medium">
      <span aria-hidden className="size-dot shrink-0 rounded-full bg-creator-accent" />
      <span dir="auto" className={cn(pageSide, "min-w-0 break-words")}>
        {text}
      </span>
    </p>
  );
}

/** A CV is called a PDF only when its address says so. */
function isPdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/**
 * The hero's row of a page with a contact block, in every template: the availability line, the
 * page's one primary action as a filled button (full width on phones) and the CV as a text link.
 * A page without a contact block has no such row: nothing is promoted in its place.
 */
export function HeroActions({
  contact,
  primary,
  now,
  align,
  status = true,
  className,
  style,
  extra,
}: {
  contact: Contact;
  /** `primaryAction()` of the page: the same action the bar and the closing band show. */
  primary: Primary;
  now: Date;
  align: "start" | "center";
  /** Off when the hero prints the availability line elsewhere (the statement hero, beside the avatar). */
  status?: boolean;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** A quiet action after the CV link, in the same row (Laufbahn's "read on"). */
  extra?: ReactNode;
}) {
  const t = useTranslations("creator");
  const line = status ? contactStatus(contact, now) : null;
  const cv = contact.links?.find((link) => link.kind === "cv");
  return (
    <div data-hero-actions className={cn("grid w-full grid-cols-1 gap-3", align === "start" ? "justify-items-start" : "justify-items-center", className)} style={style}>
      {line ? <StatusLine text={line} /> : null}
      <div className={cn("flex w-full flex-wrap items-center gap-x-5 gap-y-1", align === "start" ? "justify-start" : "justify-center")}>
        <a
          href={primary.url}
          className={cn(
            "inline-flex min-h-control-xl w-full items-center justify-center gap-2 rounded-creator-button bg-creator-accent px-6 py-2 text-center text-body leading-snug font-semibold text-creator-accent-fg @prose:w-auto",
            pressable,
          )}
        >
          {primary.icon ? <LinkIconGlyph icon={primary.icon} size="md" className="shrink-0" /> : null}
          <span dir="auto" className="min-w-0 break-words">
            {primary.label}
          </span>
        </a>
        {cv ? (
          <a
            href={cv.url}
            className="inline-flex min-h-touch-target items-center gap-2 rounded-xs text-small font-semibold text-creator-accent-text transition-colors duration-micro hover:text-creator-fg focus-visible:focus-ring"
          >
            <Icon icon={FileText} size="sm" className="shrink-0" />
            <span dir="auto">{cv.label?.trim() ? cv.label : t(isPdf(cv.url) ? "portfolio.cvPdf" : "portfolio.cv")}</span>
          </a>
        ) : null}
        {extra}
      </div>
    </div>
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
 * - arch (Bloom): the portrait in an arch that rises in, an outline arch offset behind it;
 * - plate (Werkbogen): the work opens the page. A quiet role line with a small portrait, the name,
 *   then the first project's cover as a large plate that leads to that project (`plate`); the
 *   sentence and the actions follow. On the wide canvas the words stand beside the plate;
 * - statement (Tiefdruck): no large picture. A small portrait with the availability line, then the
 *   name as large as the screen allows, the role line, the sentence, the numbers and the actions.
 * On scroll the hero softens and fades away (CSS scroll-driven animation, no JavaScript). A moving
 * picture (profile.motion) loops silently over the photo, always in its own colors (portrait). The
 * newer templates (motion "reveal") bring their lines in one after the other; never with reduced motion.
 *
 * A page with a contact block shows `HeroActions` in every hero; a page without one shows nothing
 * in its place.
 */
export function PosterHero({
  profile,
  socials,
  live,
  theme,
  preview,
  contact,
  primary,
  now,
  plate,
}: {
  profile: Profile;
  socials: BlockOf<"socials"> | undefined;
  live?: BlockOf<"live"> | undefined;
  theme: ResolvedCreatorTheme;
  preview: boolean;
  /** The page's contact block, and its primary action (`primaryAction`): both or neither. */
  contact?: Contact | undefined;
  primary?: Primary | null | undefined;
  now?: Date | undefined;
  /** Plate hero: the first project as the plate (`ProjectPlate`), when it has a picture. */
  plate?: ReactNode;
}) {
  const isRtl = profile.locale === "ar";
  const photo = profile.hero ?? profile.avatar;
  const layout = theme.layout.hero;
  const plain = theme.layout.socials === "plain";
  const enter = theme.layout.motion === "reveal";
  // Each line of the hero rises in after the one before (newer templates only).
  const rise = (index: number) => (enter ? { className: "poster-rise", style: { "--poster-i": index } as CSSProperties } : { className: undefined, style: undefined });
  const actions = (align: "start" | "center", index: number, status = true) =>
    contact && primary ? <HeroActions contact={contact} primary={primary} now={now ?? new Date()} align={align} status={status} className={rise(index).className} style={rise(index).style} /> : null;

  if (layout === "plate") {
    // The owner's own hero picture is the plate (it leads nowhere); else the first project's cover.
    const own = hasImage(profile.hero) ? profile.hero : null;
    const picture = own ? (
      <div data-plate className={cn(plateFrame, plateRatio(own, theme.layout.canvas === "wide"))}>
        <MediaImage src={own.src} focal={own.focal} alt={own.alt} sizes={theme.layout.canvas === "wide" ? mediaSizes.workPlate : mediaSizes.column} priority={!preview} />
        {profile.motion ? <HeroMotion src={profile.motion.src} /> : null}
      </div>
    ) : (
      plate
    );
    return (
      <header
        className={cn(
          "poster-hero-timeline grid grid-cols-1 gap-x-6 gap-y-5 px-creator-gutter pt-10 text-start @prose:px-0",
          // Beside the plate the words stand at the foot of the first five columns.
          // Without a plate the words open the page: they start under the band an example page lays
          // over the top of the hero (its "Example" badge), never beneath it.
          picture ? "@work:grid-cols-12 @work:grid-rows-[minmax(0,1fr)_auto] @work:items-end @work:pt-6" : "@work:pt-24",
        )}
      >
        {/* Without a plate the portrait stays beside the role line in the reading column, not at the canvas's far end. */}
        <div className={cn("grid min-w-0 grid-cols-1 gap-3", picture ? "@work:col-span-5 @work:row-start-1 @work:gap-4" : "max-w-prose")}>
          {live ? (
            <div className="justify-self-start">
              <HeroLive block={live} />
            </div>
          ) : null}
          {/* Without a photo the initials take the portrait's place, as in the statement hero: the role line keeps its height and stays clear of a preview's badge. */}
          <div className="flex min-w-0 items-center justify-between gap-4">
            {profile.tagline ? (
              <p dir="auto" className={cn(pageSide, "min-w-0 text-small text-balance break-words text-creator-fg-muted")} {...aiText(profile, "tagline")}>
                {profile.tagline}
              </p>
            ) : (
              <span />
            )}
            <span className="relative size-avatar-lg shrink-0 overflow-hidden rounded-full bg-creator-surface-2 text-h3">
              {hasImage(profile.avatar) ? (
                <MediaImage src={profile.avatar.src} focal={profile.avatar.focal} alt={profile.avatar.alt} sizes={mediaSizes.thumb} />
              ) : (
                <Monogram name={profile.displayName} />
              )}
            </span>
          </div>
          <Name profile={profile} isRtl={isRtl} theme={theme} scale="plate" />
        </div>
        {picture ? <div className="min-w-0 @work:col-span-7 @work:col-start-6 @work:row-span-2 @work:row-start-1">{picture}</div> : null}
        <div className={cn("grid min-w-0 grid-cols-1 justify-items-start gap-4", picture ? "@work:col-span-5 @work:col-start-1 @work:row-start-2" : "max-w-prose")}>
          {profile.bio ? (
            <p dir="auto" className={cn(pageSide, "line-clamp-3 w-full text-body-lg text-pretty break-words")} {...aiText(profile, "bio")}>
              {profile.bio}
            </p>
          ) : null}
          {actions("start", 0)}
          {/* Numbers follow the action here: the work, the sentence and the button come first. */}
          {profile.stats?.length ? <Stats stats={profile.stats} start /> : null}
          {socials ? <Socials block={socials} plain={plain} start /> : null}
        </div>
      </header>
    );
  }

  if (layout === "statement") {
    const line = contact ? contactStatus(contact, now ?? new Date()) : null;
    return (
      <header className="poster-hero-timeline grid grid-cols-1 justify-items-start gap-4 px-creator-gutter pt-10 text-start @prose:px-0 @work:gap-5 @work:pt-6">
        {live ? <HeroLive block={live} /> : null}
        <div className={cn("flex min-w-0 items-center gap-4", rise(0).className)} style={rise(0).style}>
          <span className="relative size-avatar-lg shrink-0 overflow-hidden rounded-full bg-creator-surface-2 text-h3">
            {hasImage(profile.avatar) ? <MediaImage src={profile.avatar.src} focal={profile.avatar.focal} alt={profile.avatar.alt} sizes={mediaSizes.thumb} /> : <Monogram name={profile.displayName} />}
          </span>
          {line ? <StatusLine text={line} /> : null}
        </div>
        <div className={cn("w-full min-w-0", rise(1).className)} style={rise(1).style}>
          <Name profile={profile} isRtl={isRtl} theme={theme} scale="statement" />
        </div>
        {profile.tagline ? (
          <p dir="auto" className={cn(pageSide, "w-full max-w-prose text-h3 leading-snug text-balance break-words", rise(2).className)} style={rise(2).style} {...aiText(profile, "tagline")}>
            {profile.tagline}
          </p>
        ) : null}
        {profile.bio ? (
          <p dir="auto" className={cn(pageSide, "w-full max-w-prose text-body-lg text-pretty break-words text-creator-fg-muted", rise(3).className)} style={rise(3).style} {...aiText(profile, "bio")}>
            {profile.bio}
          </p>
        ) : null}
        {profile.stats?.length ? <Stats stats={profile.stats} start /> : null}
        {actions("start", 4, false)}
        {socials ? (
          <div className={rise(5).className} style={rise(5).style}>
            <Socials block={socials} plain={plain} start />
          </div>
        ) : null}
      </header>
    );
  }

  // A moving picture always shows in its own colors: toning a face on video into the page color
  // reads as a filter, not as a portrait.
  const treatment = !hasImage(photo) && !profile.logo ? "monogram" : layout === "logo" && !profile.logo ? "portrait" : layout === "duotone" && profile.motion ? "portrait" : layout;
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
      {actions(start ? "start" : "center", 3)}
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
 * Compact bar that slides in once the hero has scrolled away: avatar, name, share; on a page with a
 * contact block also its primary action, as a small filled button before the share button.
 * Driven by the hero's view timeline; browsers without scroll-driven animations never show it.
 */
export function PosterBar({ profile, primary }: { profile: Profile; primary?: Primary | null | undefined }) {
  return (
    <div className="pointer-events-none sticky top-0 layer-sticky h-0">
      <div className="poster-bar pointer-events-auto flex h-control-xl items-center gap-3 border-b border-creator-line bg-creator-glass ps-creator-gutter pe-2 backdrop-blur-glass">
        <span className="relative size-control-sm shrink-0 overflow-hidden rounded-full bg-creator-surface-2 text-small">
          {hasImage(profile.avatar) ? <MediaImage src={profile.avatar.src} focal={profile.avatar.focal} alt="" sizes={mediaSizes.thumb} /> : <Monogram name={profile.displayName} />}
        </span>
        <p dir="auto" className={cn(pageSide, "min-w-0 flex-1 truncate text-body font-semibold")} {...aiText(profile, "displayName")}>
          {profile.displayName}
        </p>
        {primary ? (
          // The label may be cut short here; the link's name is still the whole label.
          <a
            href={primary.url}
            data-bar-action
            className={cn("inline-flex min-h-touch-target max-w-2/5 shrink-0 items-center rounded-creator-button bg-creator-accent px-4 text-small font-semibold text-creator-accent-fg", pressable)}
          >
            <span dir="auto" className="truncate">
              {primary.label}
            </span>
          </a>
        ) : null}
        <ShareButton title={profile.displayName} />
      </div>
    </div>
  );
}
