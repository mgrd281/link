import { hasImage, type AiProfileField, type BlockOf, type Page } from "@linkyo/blocks";
import { creatorTokens, tokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowDown, BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { initials, MediaImage, mediaSizes, Monogram } from "../shared/creator-kit";
import { HeroMotion } from "../shared/motion";
import { GLYPH_WIDTH, HeroActions, Socials } from "./hero";
import { HeroLive } from "./live";
import { displayStyle, pageSide, pressable } from "./styles";

type Profile = Page["profile"];
type Contact = BlockOf<"contact">;

/** `data-ai-generated` on a profile text an AI draft wrote (AI Act Art. 50(2)); nothing otherwise. */
const aiText = (profile: Profile, field: AiProfileField) => (profile.aiFields?.includes(field) ? { "data-ai-generated": "true" } : {});

/** Letters of the right-to-left scripts: a figure with them runs right to left, every other figure left to right. */
const RTL_LETTERS = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;

/** The picture's `sizes`: the whole screen up to the wide canvas, then the plate's half of it. */
const PLATE_SIZES = `(max-width: ${String(tokens.layout.work - 1)}px) 100vw, ${String(Math.round(tokens.layout.work / 2))}px`;

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
 * The name, as large as its longest line allows: a name of two words stands on two lines (one word
 * each), any other name wraps where it must. Never smaller than a headline and never larger than the
 * largest display size.
 */
function BleedName({ profile, theme, isRtl }: { profile: Profile; theme: ResolvedCreatorTheme; isRtl: boolean }) {
  const t = useTranslations("creator");
  const pairing = PAIRING_IDS.find((id) => creatorTokens.pairings[id] === theme.pairing) ?? "classic";
  const words = profile.displayName.trim().split(/\s+/u);
  const lines = words.length === 2 ? words : [profile.displayName];
  const ems = Math.max(...lines.map((line) => lineEms(line, pairing))).toFixed(2);
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
        "text-[length:clamp(var(--text-h1),var(--name-fit),var(--text-display-2xl))] @work:text-[length:clamp(var(--text-h1),var(--name-fit-work),var(--text-display-2xl))]",
        isRtl ? "leading-snug" : "leading-none",
      )}
      style={{ ...displayStyle, ...fit }}
      {...aiText(profile, "displayName")}
    >
      {/* Each line runs in its own direction (a Latin name on an Arabic page, and the reverse). */}
      {lines.length === 2 ? (
        <>
          <span className="block">
            <bdi dir="auto">{lines[0]}</bdi>
          </span>{" "}
          <span className="block">
            <bdi dir="auto">{lines[1]}</bdi>
            {verified}
          </span>
        </>
      ) : (
        <>
          <bdi dir="auto">{profile.displayName}</bdi>
          {verified}
        </>
      )}
    </h1>
  );
}

/**
 * The bleed hero (Laufbahn).
 *
 * Phones: the picture from edge to edge, about three quarters of the screen tall, a scrim from the
 * tokens at its foot carrying the role line as a quiet chip and the name in white, set very large.
 * Below it, on the page: the sentence, the numbers in a row between hairlines, then the actions where
 * the thumb is: the contact block's primary action when the page has one, and "read on" to the first
 * section. Without any picture the picture's place is an accent field with the initials, never an
 * empty box.
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
  jump,
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
  /** The first signposted section: "read on" leads there. */
  jump?: { href: string; title: string } | undefined;
}): ReactNode {
  const t = useTranslations("creator");
  const isRtl = profile.locale === "ar";
  const picture = hasImage(profile.hero) ? profile.hero : hasImage(profile.avatar) ? profile.avatar : null;
  // Beside the role line: the portrait when the large picture shows something else (a place, a
  // workshop), or the initials while there is no portrait yet. Nothing when the picture is the portrait.
  const face = hasImage(profile.hero) ? (hasImage(profile.avatar) ? profile.avatar : null) : undefined;
  const enter = theme.layout.motion === "reveal";
  const rise = (index: number) => (enter ? { className: "poster-rise", style: { "--poster-i": index } as CSSProperties } : { className: undefined, style: undefined });
  const action = contact && primary ? { contact, primary } : null;

  return (
    <header className="poster-hero-timeline grid grid-cols-1 @work:grid-cols-12 @work:grid-rows-[minmax(0,1fr)_auto] @work:gap-x-6 @work:pt-24">
      {/* The picture: edge to edge on phones and tablets, a tall plate on the wide canvas. */}
      <div
        data-hero-plate
        className={cn(
          "lb-plate relative col-start-1 row-start-1 overflow-hidden",
          "@work:col-span-6 @work:col-start-7 @work:row-span-2 @work:aspect-portrait @work:h-auto @work:rounded-xl",
          picture ? "bg-creator-surface-2" : "bg-creator-accent text-creator-accent-fg",
        )}
      >
        {picture ? (
          <>
            <MediaImage src={picture.src} focal={picture.focal} alt={picture.alt} sizes={PLATE_SIZES} priority={!preview} className="lb-zoom" />
            {profile.motion ? <HeroMotion src={profile.motion.src} /> : null}
            <div aria-hidden className="lb-scrim absolute inset-0 @work:hidden" />
          </>
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
          picture ? "text-white @work:text-creator-fg" : "text-creator-accent-fg @work:text-creator-fg",
        )}
      >
        {live ? <HeroLive block={live} /> : null}
        {profile.tagline || face !== undefined ? (
          <p
            className={cn(
              "inline-flex max-w-full min-w-0 items-center gap-2 rounded-xl border py-1 ps-1 text-small font-medium",
              // Over the picture: dark glass and white text; on the page (the wide canvas, or no picture): a surface with a hairline.
              picture ? "lb-chip text-white" : "border-creator-line bg-creator-surface text-creator-fg",
              "@work:border-creator-line @work:bg-creator-surface @work:text-creator-fg @work:backdrop-blur-none",
              profile.tagline ? "pe-4" : "pe-1",
              rise(0).className,
            )}
            style={rise(0).style}
          >
            {face !== undefined ? (
              <span className="relative size-control-sm shrink-0 overflow-hidden rounded-full">
                {face ? <MediaImage src={face.src} focal={face.focal} alt={face.alt} sizes={mediaSizes.thumb} /> : <Monogram name={profile.displayName} />}
              </span>
            ) : null}
            {profile.tagline ? (
              <span dir="auto" className={cn(pageSide, "min-w-0 py-1 text-balance break-words")} {...aiText(profile, "tagline")}>
                {profile.tagline}
              </span>
            ) : null}
          </p>
        ) : null}
        <div className={cn("w-full min-w-0", rise(1).className)} style={rise(1).style}>
          <BleedName profile={profile} theme={theme} isRtl={isRtl} />
        </div>
      </div>

      {/* Under the picture: the sentence, the numbers and the actions; under the name on the wide canvas. */}
      <div className="grid min-w-0 gap-6 px-creator-gutter pt-6 @prose:mx-auto @prose:w-full @prose:max-w-prose @prose:px-0 @prose:pt-8 @work:col-span-5 @work:col-start-1 @work:row-start-2 @work:mx-0 @work:max-w-none @work:pt-6">
        {profile.bio ? (
          <p dir="auto" className={cn(pageSide, "text-body-lg text-pretty break-words text-creator-fg", rise(2).className)} style={rise(2).style} {...aiText(profile, "bio")}>
            {profile.bio}
          </p>
        ) : null}
        {profile.stats?.length ? (
          <dl className={cn("grid auto-cols-fr grid-flow-col border-y border-creator-line py-4", rise(3).className)} style={rise(3).style}>
            {profile.stats.map((stat) => (
              // The label first for screen readers, the value on top for the eye; the first number on the reading edge.
              <div key={stat.label} className="flex min-w-0 flex-col-reverse justify-end gap-1 px-3 first:ps-0 last:pe-0 not-first:border-s not-first:border-creator-line @prose:px-5">
                <dt dir="auto" className={cn(pageSide, "text-caption text-balance text-creator-fg-muted")}>
                  {stat.label}
                </dt>
                {/* "40+" stays "40+" on an Arabic page; a figure in Arabic words runs right to left. */}
                <dd
                  dir={RTL_LETTERS.test(stat.value) ? "rtl" : "ltr"}
                  className={cn(pageSide, "text-title leading-none font-semibold whitespace-nowrap tabular-nums rtl:tracking-normal @prose:text-h3 @prose:rtl:tracking-normal")}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {action || jump ? (
          <div className={cn("grid min-w-0 gap-3 @prose:flex @prose:flex-wrap @prose:items-end", rise(4).className)} style={rise(4).style}>
            {action ? <HeroActions contact={action.contact} primary={action.primary} now={now} align="start" className="@prose:w-auto" /> : null}
            {jump ? (
              // With a contact block the quiet partner of its action; without one, the hero's one action.
              <a
                href={jump.href}
                // Where it leads, for screen readers; the visible words come first in the name.
                aria-label={t("laufbahn.jumpTo", { title: jump.title })}
                className={cn(
                  "inline-flex min-h-control-xl w-full items-center justify-center gap-2 rounded-creator-button px-6 py-2 text-center text-body leading-snug font-semibold @prose:w-auto",
                  action ? "border border-creator-line-strong text-creator-fg" : "bg-creator-accent text-creator-accent-fg",
                  pressable,
                )}
              >
                <Icon icon={ArrowDown} size="md" className="shrink-0" />
                <span>{t("laufbahn.jump")}</span>
              </a>
            ) : null}
          </div>
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
