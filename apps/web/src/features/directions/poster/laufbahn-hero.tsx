import { hasImage, type BlockOf, type Page } from "@linkyo/blocks";
import { contactStatus } from "@linkyo/blocks/project";
import { creatorTokens, tokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowDown, BadgeCheck, FileText, MailOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { initials, MediaImage, mediaSizes } from "../shared/creator-kit";
import { LinkIconGlyph } from "../shared/link-icons";
import { HeroMotion } from "../shared/motion";
import { aiText, GLYPH_WIDTH, isPdf, Socials, StatusLine } from "./hero";
import { HeroLive } from "./live";
import { ShareAction } from "./share";
import { displayStyle, pageSide, pressable } from "./styles";

type Profile = Page["profile"];
type Contact = BlockOf<"contact">;

/** Letters of the right-to-left scripts: a figure with them runs right to left, every other figure left to right. */
const RTL_LETTERS = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;

/** How much taller than wide the plate is on a phone (72svh of a 390 × 844 screen: 608 × 390). */
const PHONE_PLATE_RATIO = 1.56;
/** The plate on the wide canvas: half the canvas wide, 4 : 5 (aspect-portrait). */
const WIDE_PLATE = { width: tokens.layout.work / 2, ratio: 5 / 4 };

/**
 * The picture's `sizes`. It covers its plate, so a picture wider than the plate's shape is drawn wider
 * than the plate (a 4 : 3 photo in the phone plate is about twice the screen wide): the browser fetches
 * the width it really draws. Without a stored size the picture counts as square. A portrait that rides
 * high on phones (`portrait`) is drawn in a square the screen's width.
 */
function plateSizes(picture: { w?: number | undefined; h?: number | undefined }, portrait: boolean): string {
  const aspect = picture.w && picture.h ? picture.w / picture.h : 1;
  const phone = portrait ? Math.max(1, aspect) : Math.max(1, aspect * PHONE_PLATE_RATIO);
  const wide = Math.max(1, aspect * WIDE_PLATE.ratio) * WIDE_PLATE.width;
  return `(max-width: ${String(tokens.layout.work - 1)}px) ${String(Math.round(phone * 100))}vw, ${String(Math.round(wide))}px`;
}

/** The wide canvas, and the five of its twelve columns the words take beside the plate. */
const CANVAS = "min(100cqi - 2 * var(--spacing-creator-gutter), var(--container-work))";
const WORDS = `(${CANVAS} - 11 * var(--spacing-6)) * 5 / 12 + 4 * var(--spacing-6)`;
/** On phones the words keep the gutters; from tablet widths they stand in the reading column. */
const NARROW = "min(100cqi - 2 * var(--spacing-creator-gutter), var(--container-prose))";
/** Below the canvas the words line up with the reading column (centred), never closer to the edge than the gutter. */
const COLUMN_INSET = "@prose:px-[max(var(--spacing-creator-gutter),calc((100cqi-var(--container-prose))/2))]";

/**
 * How wide a line of the name is, in em of the display face. A single word set this large has no
 * spaces to average over, so letters count by their class (measured on Inter Bold at the pairing's
 * tracking: i, l, t, r and friends narrow; m and w wide; capitals wider than lowercase), scaled to the
 * pairing's average glyph width. Scripts without capitals (Arabic) count at that average.
 */
const NARROW_GLYPHS = /[fijlrtI'’.,:;!|]/u;
const WIDE_GLYPHS = /[mwMW]/u;
const LATIN_GLYPH = /\p{Script=Latin}|\p{N}/u;
function lineEms(line: string, pairing: string): number {
  const average = GLYPH_WIDTH[pairing] ?? GLYPH_WIDTH.classic ?? 0.53;
  const scale = average / (GLYPH_WIDTH.classic ?? 0.53);
  return Array.from(line).reduce((sum, glyph) => {
    if (/\s/u.test(glyph)) return sum + 0.28 * scale;
    if (!LATIN_GLYPH.test(glyph)) return sum + average;
    if (NARROW_GLYPHS.test(glyph)) return sum + 0.3 * scale;
    if (WIDE_GLYPHS.test(glyph)) return sum + 0.92 * scale;
    return sum + (glyph === glyph.toUpperCase() && glyph !== glyph.toLowerCase() ? 0.72 : 0.6) * scale;
  }, 0);
}

/**
 * The name on one line, as large as that line allows: never smaller than a headline and never larger
 * than the largest display size; over the picture also never taller than an eighth of the screen
 * (lb-name). A name too long for one line at headline size wraps where it must (balanced). The width
 * is estimated a little generously, so a fitted name never breaks by a hair.
 */
function BleedName({ profile, theme, isRtl }: { profile: Profile; theme: ResolvedCreatorTheme; isRtl: boolean }) {
  const t = useTranslations("creator");
  const pairing = PAIRING_IDS.find((id) => creatorTokens.pairings[id] === theme.pairing) ?? "classic";
  const ems = (lineEms(profile.displayName.trim(), pairing) * 1.04).toFixed(2);
  const badge = profile.verified ? " - var(--spacing-icon-lg) - var(--spacing-2)" : "";
  const fit = { "--name-fit": `calc((${NARROW}${badge}) / ${ems})`, "--name-fit-work": `calc((${WORDS}${badge}) / ${ems})` } as CSSProperties;
  const verified = profile.verified ? (
    <span className="ms-2 inline-block align-middle">
      <Icon icon={BadgeCheck} size="lg" label={t("verified")} />
    </span>
  ) : null;
  return (
    <h1
      className={cn(
        "font-creator-display text-balance break-words",
        // Over the picture: fitted to the width and capped by the screen's height (lb-name); on the wide canvas: fitted to the words' columns.
        "lb-name @work:text-[length:clamp(var(--text-h1),var(--name-fit-work),var(--text-display-2xl))]",
        isRtl ? "leading-tight" : "leading-none",
      )}
      style={{ ...displayStyle, ...fit }}
      {...aiText(profile, "displayName")}
    >
      {/* The name runs in its own direction (a Latin name on an Arabic page, and the reverse). */}
      <bdi dir="auto">{profile.displayName}</bdi>
      {verified}
    </h1>
  );
}

/**
 * The bleed hero (Laufbahn).
 *
 * Phones: the picture from edge to edge, about three quarters of the screen tall, the role line as a
 * quiet chip and the name in white, set very large, on a veil of ink tied to the words (lb-veil), so
 * they keep AA however short the picture is. When the picture is the portrait itself (no separate
 * hero picture), it rides high in a square and fades into an ink ground, so the words stand below the
 * face, never across it. Below it, on the page: the sentence, then two actions where the thumb is
 * (LaufbahnActions: the page's first action, filled, and "Share", outlined), on a phone's first screen,
 * then the numbers in a row between hairlines. Without any picture the picture's place is an accent
 * field with the initials, never an empty box.
 *
 * The wide canvas: one composition on twelve columns. The words on the first five (the name on two
 * lines when it has two words), the picture as a tall rounded plate on the last six.
 *
 * One DOM for every width (the name and the actions exist once). The lines rise in once; the picture
 * eases in a little as the hero scrolls away; neither with reduced motion.
 */
export function BleedHero({
  profile,
  socials,
  live,
  theme,
  preview,
  contact,
  primary,
  now,
  lead,
  banner = false,
}: {
  profile: Profile;
  socials: BlockOf<"socials"> | undefined;
  live?: BlockOf<"live"> | undefined;
  theme: ResolvedCreatorTheme;
  preview: boolean;
  /** The page's contact block, and its primary action (`primaryAction`): both or neither. */
  contact?: Contact | undefined;
  primary?: Contact["primary"] | null | undefined;
  now: Date;
  /** Without a contact block: where the first action leads (the letter, the first section or the start of the content). */
  lead?: Lead | undefined;
  /** A badge lies over the top of the page (a prepared preview, an example): the wide canvas starts below it. */
  banner?: boolean;
}): ReactNode {
  const isRtl = profile.locale === "ar";
  const picture = hasImage(profile.hero) ? profile.hero : hasImage(profile.avatar) ? profile.avatar : null;
  // Beside the role line: the portrait when the large picture shows something else (a place, a
  // workshop). Nothing when there is no portrait, or when the picture is the portrait.
  const face = hasImage(profile.hero) ? (hasImage(profile.avatar) ? profile.avatar : null) : undefined;
  // The picture is the portrait: on phones it rides high so that the words below never cover the face.
  const portrait = picture !== null && face === undefined;
  const enter = theme.layout.motion === "reveal";
  const rise = (index: number) => (enter ? { className: "poster-rise", style: { "--poster-i": index } as CSSProperties } : { className: undefined, style: undefined });
  const action = contact && primary ? { contact, primary } : null;

  return (
    <header className={cn("poster-hero-timeline grid grid-cols-1 @work:grid-cols-12 @work:grid-rows-[minmax(0,1fr)_auto] @work:gap-x-6", banner ? "@work:pt-32" : "@work:pt-24")}>
      {/* The picture: edge to edge on phones and tablets, a tall plate on the wide canvas. */}
      <div
        data-hero-plate
        className={cn(
          "lb-plate relative col-start-1 row-start-1 overflow-hidden",
          "@work:col-span-6 @work:col-start-7 @work:row-span-2 @work:aspect-portrait @work:h-auto @work:rounded-xl",
          picture ? (portrait ? "lb-ground @work:bg-creator-surface-2" : "bg-creator-surface-2") : "bg-creator-accent text-creator-accent-fg",
        )}
      >
        {picture ? (
          // A portrait: a square at the top on phones, fading into the ink ground; the whole plate on the wide canvas.
          <div className={cn("absolute", portrait ? "inset-x-0 top-0 aspect-square mask-b-from-60% mask-b-to-100% @work:inset-0 @work:aspect-auto @work:mask-none" : "inset-0")}>
            <MediaImage src={picture.src} focal={picture.focal} alt={picture.alt} sizes={plateSizes(picture, portrait)} priority={!preview} className="lb-zoom" />
            {profile.motion ? <HeroMotion src={profile.motion.src} /> : null}
          </div>
        ) : (
          // No picture yet: the initials, set like a signpost on the accent. Decorative: the name is the heading.
          <span aria-hidden className="absolute inset-x-0 top-0 bottom-2/5 grid place-items-center font-creator-display text-display-2xl leading-none @work:bottom-0" style={displayStyle}>
            {initials(profile.displayName)}
          </span>
        )}
      </div>

      {/* Over the foot of the picture on phones; at the foot of the words' first row on the wide canvas. */}
      <div
        className={cn(
          "relative col-start-1 row-start-1 grid min-w-0 content-end justify-items-start gap-4 self-end px-creator-gutter pb-8",
          COLUMN_INSET,
          "@prose:pb-10 @work:col-span-5 @work:px-0 @work:pb-2",
          // Over the picture: white on the veil (gone on the wide canvas, where the words stand on the page).
          picture ? "lb-veil text-white @work:text-creator-fg @work:before:hidden" : "text-creator-accent-fg @work:text-creator-fg",
        )}
      >
        {live ? <HeroLive block={live} /> : null}
        {/* The name, then the role right under it as a quiet line: name and role read as one unit. */}
        <div className={cn("w-full min-w-0", rise(0).className)} style={rise(0).style}>
          <BleedName profile={profile} theme={theme} isRtl={isRtl} />
        </div>
        {profile.tagline || face ? (
          <p className={cn("-mt-1 flex max-w-full min-w-0 items-center gap-3 text-body font-medium @work:text-body-lg @work:font-regular @work:text-creator-fg-muted", rise(1).className)} style={rise(1).style}>
            {/* A portrait beside the role only when the large picture shows something else; never initials. */}
            {face ? (
              <span className="relative size-control-sm shrink-0 overflow-hidden rounded-full">
                <MediaImage src={face.src} focal={face.focal} alt={face.alt} sizes={mediaSizes.thumb} />
              </span>
            ) : null}
            {profile.tagline ? (
              <span dir="auto" className={cn(pageSide, "min-w-0 text-pretty break-words")} {...aiText(profile, "tagline")}>
                {profile.tagline}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Under the picture: the sentence, the actions (within a phone's first screen) and the numbers; under the name on the wide canvas. */}
      <div className="grid min-w-0 gap-6 px-creator-gutter pt-6 @prose:mx-auto @prose:w-full @prose:max-w-prose @prose:px-0 @prose:pt-8 @work:col-span-5 @work:col-start-1 @work:row-start-2 @work:mx-0 @work:max-w-none @work:pt-6">
        {profile.bio ? (
          <p dir="auto" className={cn(pageSide, "text-body-lg text-pretty break-words text-creator-fg", rise(2).className)} style={rise(2).style} {...aiText(profile, "bio")}>
            {profile.bio}
          </p>
        ) : null}
        <LaufbahnActions profile={profile} action={action} lead={lead} now={now} className={rise(3).className} style={rise(3).style} />
        {profile.stats?.length ? (
          <dl className={cn("grid auto-cols-fr grid-flow-col border-y border-creator-line py-4", rise(4).className)} style={rise(4).style}>
            {profile.stats.map((stat) => (
              // The label first for screen readers, the value on top for the eye; the first number on the reading edge.
              <div key={stat.label} className="flex min-w-0 flex-col-reverse justify-end gap-1 px-3 first:ps-0 last:pe-0 not-first:border-s not-first:border-creator-line @prose:px-5">
                <dt dir="auto" className={cn(pageSide, "text-caption text-balance hyphens-auto text-creator-fg-muted")}>
                  {stat.label}
                </dt>
                {/* "40+" stays "40+" on an Arabic page; a figure in Arabic words runs right to left. On the
                    narrowest screens (320) a value of two words may take two lines rather than run into the hairline. */}
                <dd
                  dir={RTL_LETTERS.test(stat.value) ? "rtl" : "ltr"}
                  className={cn(pageSide, "text-title leading-none font-semibold tabular-nums rtl:tracking-normal @prose:text-h3 @prose:rtl:tracking-normal")}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {socials ? (
          <div className={rise(5).className} style={rise(5).style}>
            <Socials block={socials} plain={theme.layout.socials === "plain"} start />
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Where the hero's first action leads on a page without a contact block. */
export interface Lead {
  href: string;
  /** The cover letter ("Read the letter"), the first section or the start of the content ("Read on"). */
  kind: "letter" | "section" | "content";
  /** The first section's title: "Read on" names its destination for screen readers. */
  title?: string | undefined;
}

/**
 * Both hero buttons: the same height, radius and press as every button on the page (48 px, the
 * template's button radius, scale on press, the focus ring). On phones they share a row when both
 * labels fit (the first action takes the larger part) and stack at full width when they do not.
 */
const heroButton = cn(
  "inline-flex min-h-control-lg max-w-full min-w-0 basis-auto items-center justify-center gap-2 rounded-creator-button px-3 text-center text-body leading-snug font-semibold @prose:flex-none @prose:px-6",
  pressable,
);

/**
 * The hero's actions: the page's first action as the one filled button (the contact block's primary
 * action when there is one, else "Read the letter" on an application with a cover letter, else "Read
 * on" to the first section) and "Share" beside it, outlined: the native share sheet, or the address
 * copied and announced. With a contact block its availability line stands above and its CV below.
 */
function LaufbahnActions({
  profile,
  action,
  lead,
  now,
  className,
  style,
}: {
  profile: Profile;
  action: { contact: Contact; primary: Contact["primary"] } | null;
  lead: Lead | undefined;
  now: Date;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}): ReactNode {
  const t = useTranslations("creator");
  const line = action ? contactStatus(action.contact, now) : null;
  const cv = action?.contact.links?.find((link) => link.kind === "cv");
  const filled = cn(heroButton, "grow-2 bg-creator-accent text-creator-accent-fg");
  return (
    <div data-hero-actions className={cn("grid w-full min-w-0 gap-3", className)} style={style}>
      {line ? <StatusLine text={line} /> : null}
      <div className="flex min-w-0 flex-wrap gap-2 @prose:gap-3">
        {action ? (
          <a href={action.primary.url} className={filled}>
            {action.primary.icon ? <LinkIconGlyph icon={action.primary.icon} size="md" className="shrink-0" /> : null}
            <span dir="auto" className="min-w-0 break-words">
              {action.primary.label}
            </span>
          </a>
        ) : lead ? (
          <a
            href={lead.href}
            // "Read on" says where it leads for screen readers; the visible words come first in the name.
            aria-label={lead.kind === "section" && lead.title ? t("laufbahn.jumpTo", { title: lead.title }) : undefined}
            className={filled}
          >
            <Icon icon={lead.kind === "letter" ? MailOpen : ArrowDown} size="md" className="shrink-0" />
            <span>{t(lead.kind === "letter" ? "laufbahn.readLetter" : "laufbahn.jump")}</span>
          </a>
        ) : null}
        <ShareAction title={profile.displayName} label={t("laufbahn.share")} className={cn(heroButton, "grow border border-creator-line-strong bg-creator-surface text-creator-fg")} />
      </div>
      {cv ? (
        <a
          href={cv.url}
          className="inline-flex min-h-touch-target items-center gap-2 justify-self-start rounded-xs text-small font-semibold text-creator-accent-text transition-colors duration-micro hover:text-creator-fg focus-visible:focus-ring motion-reduce:transition-none"
        >
          <Icon icon={FileText} size="sm" className="shrink-0" />
          <span dir="auto">{cv.label?.trim() ? cv.label : t(isPdf(cv.url) ? "portfolio.cvPdf" : "portfolio.cv")}</span>
        </a>
      ) : null}
    </div>
  );
}
