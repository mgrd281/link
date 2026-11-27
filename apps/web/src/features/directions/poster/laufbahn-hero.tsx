import { hasImage, type BlockOf, type Page } from "@linkyo/blocks";
import { contactStatus } from "@linkyo/blocks/project";
import { creatorTokens, tokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowDown, BadgeCheck, Download, FileText, MailOpen, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import type { DocumentsView, FigureParts } from "@/features/documents/offer";
import { splitFigure } from "@/features/documents/offer";

import { MediaImage } from "../shared/creator-kit";
import { LinkIconGlyph } from "../shared/link-icons";
import { HeroMotion } from "../shared/motion";
import { aiText, GLYPH_WIDTH, isPdf, Socials } from "./hero";
import { keepSeparators, lineEms, widestWord } from "./laufbahn-content";
import { HeroLive } from "./live";
import { ShareAction } from "./share";
import { displayStyle, pageSide } from "./styles";

type Profile = Page["profile"];
type Contact = BlockOf<"contact">;
type Fact = NonNullable<BlockOf<"about">["facts"]>[number];

/** The facts the head shows (the position applied for, and the employer beside it), from `targetFacts`. */
export interface HeadFacts {
  target: Fact | null;
  employer: Fact | null;
}

/** A space that never breaks, written by its code (no invisible character in the source). */
const NBSP = String.fromCharCode(0xa0);

/** The wide canvas, its twelve columns and their gap (gap-x-6). */
const CANVAS = "min(100cqi - 2 * var(--spacing-creator-gutter), var(--container-work))";
const columns = (count: number) => `(${CANVAS} - 11 * var(--spacing-6)) * ${String(count)} / 12 + ${String(count - 1)} * var(--spacing-6)`;
/** On phones the words keep the gutters; from tablet widths they stand in the reading column. */
const NARROW = "min(100cqi - 2 * var(--spacing-creator-gutter), var(--container-prose))";
/** Below the canvas the head's words line up with the reading column (centred), never closer to the edge than the gutter. */
const COLUMN_INSET = "px-creator-gutter @prose:px-[max(var(--spacing-creator-gutter),calc((100cqi-var(--container-prose))/2))] @work:px-0";

/** The plate on the wide canvas: four of the twelve columns wide. */
const WIDE_PLATE_WIDTH = Math.round(((tokens.layout.work - 11 * tokens.spacing["6"]) * 4) / 12 + 3 * tokens.spacing["6"]);
/** The plate on phones and tablets: the screen's width, 3 : 2 (aspect-photo), as height over width. */
const PHONE_PLATE_RATIO = 2 / 3;
/**
 * The wide plate's shape (width over height) as `sizes` counts it: as tall as the words beside it,
 * which is seldom taller than 2 : 3 (a long sentence and the social links), so the picture fetched is
 * wide enough for it.
 */
const WIDE_PLATE_TALLEST = 2 / 3;

interface Picture {
  w?: number | undefined;
  h?: number | undefined;
}

/**
 * The picture's `sizes`: it covers its plate, so a picture wider than the plate's shape is drawn wider
 * than the plate, and the browser fetches the width it really draws. Without a stored size the picture
 * counts as square on phones and as 4 : 5 on the wide canvas.
 */
function plateSizes(picture: Picture): string {
  const aspect = picture.w && picture.h ? picture.w / picture.h : 1;
  const phone = Math.max(1, aspect * PHONE_PLATE_RATIO);
  const wide = Math.max(1, (picture.w && picture.h ? aspect : 4 / 5) / WIDE_PLATE_TALLEST) * WIDE_PLATE_WIDTH;
  return `(max-width: ${String(tokens.layout.work - 1)}px) ${String(Math.round(phone * 100))}vw, ${String(Math.round(wide))}px`;
}

/** The pairing's id and its average glyph width (the name and the figures are fitted with it). */
function averageOf(theme: ResolvedCreatorTheme): number {
  const pairing = PAIRING_IDS.find((id) => creatorTokens.pairings[id] === theme.pairing) ?? "classic";
  return GLYPH_WIDTH[pairing] ?? GLYPH_WIDTH.classic ?? 0.53;
}

/**
 * The name, type first: on phones as large as its widest word allows (each word may take its own line,
 * so "Jonas Brandt" stands on two lines at 72 px on a 390 px phone), never below a display size; on the
 * wide canvas the whole name on one line in the words' eight columns. Arabic stops one step lower.
 * The estimate errs a little wide (× 1.04), so a fitted line never breaks by a hair.
 */
function DossierName({ profile, theme, isRtl, className, style }: { profile: Profile; theme: ResolvedCreatorTheme; isRtl: boolean; className?: string | undefined; style?: CSSProperties | undefined }) {
  const t = useTranslations("creator");
  const average = averageOf(theme);
  const name = profile.displayName.trim();
  const word = (lineEms(widestWord(name, average), average) * 1.04).toFixed(2);
  const line = (lineEms(name, average) * 1.04).toFixed(2);
  const badge = profile.verified ? " - var(--spacing-icon-lg) - var(--spacing-2)" : "";
  const fit = { "--name-fit": `calc((${NARROW}${badge}) / ${word})`, "--name-fit-work": `calc((${columns(8)}${badge}) / ${line})` } as CSSProperties;
  return (
    <h1
      // The app bar appears once the name has passed under it, as an app's large title does (BarReveal).
      data-lb-name
      className={cn(
        "mt-5 font-creator-display text-balance break-words @work:mt-6",
        "text-[length:clamp(var(--text-display-sm),var(--name-fit),var(--text-display-xl))]",
        isRtl
          ? "leading-tight @work:text-[length:clamp(var(--text-h1),var(--name-fit-work),var(--text-display-xl))]"
          : "leading-none @work:text-[length:clamp(var(--text-h1),var(--name-fit-work),var(--text-display-2xl))]",
        className,
      )}
      style={{ ...displayStyle, ...fit, ...style }}
      {...aiText(profile, "displayName")}
    >
      {/* The name runs in its own direction (a Latin name on an Arabic page, and the reverse). */}
      <bdi dir="auto">{profile.displayName}</bdi>
      {profile.verified ? (
        <span className="ms-2 inline-block align-middle text-white">
          <Icon icon={BadgeCheck} size="lg" label={t("verified")} />
        </span>
      ) : null}
    </h1>
  );
}

/** The owner's availability in their own words: a still dot (decorative) and the words, on a soft pill. */
export function StatusPill({ text, className, style }: { text: string; className?: string | undefined; style?: CSSProperties | undefined }): ReactNode {
  return (
    <p className={cn("inline-flex min-h-control-sm max-w-full items-center gap-2 rounded-full bg-hover-inverse px-3 text-small font-semibold text-white", className)} style={style}>
      <span aria-hidden className="size-dot shrink-0 rounded-full bg-success" />
      <span dir="auto" className={cn(pageSide, "min-w-0 break-words")}>
        {text}
      </span>
    </p>
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
 * A button on ink: 48 px, the template's pill, a press that shrinks it a little (not with reduced
 * motion), the overlay in the text's own colour under the pointer, and the white focus ring.
 */
export const inkButton = cn(
  "relative isolate inline-flex min-h-control-lg min-w-0 items-center justify-center gap-2 rounded-creator-button px-4 text-center text-body leading-snug font-semibold @work:px-6",
  "transition-[scale] duration-micro ease-standard active:scale-pressed motion-reduce:transition-none motion-reduce:active:scale-none",
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-current after:opacity-0 after:transition-opacity after:duration-micro hover:after:opacity-hover active:after:opacity-pressed",
  "focus-visible:focus-ring-inverse",
);

/** The filled action on ink: white with ink words (never the accent, which may be ink itself). */
export const inkFilled = "bg-white text-ink";
/** The soft action on ink: a light fill over the ink, white words. */
export const inkSoft = "bg-hover-inverse text-white";

/**
 * The hero's two actions where the thumb is. First, filled in white: the contact block's primary
 * action, else "Read the letter", else "Read on". Second, soft: the Lebenslauf as a PDF when the page
 * offers one, else the owner's own CV, else "Share". The two share a row while both labels fit; below
 * that they stack at full width. On phones they keep a little less padding at their sides (px-3), so
 * the template's longest pair, "Anschreiben lesen" and "Lebenslauf", still shares a row at 390 px (338
 * of 350 px); on a 360 px phone it stacks. Both grow to fill their row, so the padding shows only
 * there, at the point of wrapping.
 */
function DossierActions({
  profile,
  action,
  lead,
  documents,
  ownCv,
  className,
  style,
}: {
  profile: Profile;
  action: { contact: Contact; primary: Contact["primary"] } | null;
  lead: Lead | undefined;
  documents: DocumentsView | null;
  ownCv: { href: string; label: string | null } | null;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}): ReactNode {
  const t = useTranslations("creator");
  const first = cn(inkButton, inkFilled, "grow-3 px-3 @prose:flex-none @prose:px-4 @work:px-6");
  const second = cn(inkButton, inkSoft, "grow-2 px-3 @prose:flex-none @prose:px-4 @work:px-6");
  const cv = documents?.cv;
  return (
    <div data-hero-actions className={cn("mt-6 flex min-w-0 flex-wrap gap-2 @work:mt-8 @work:gap-3", className)} style={style}>
      {action ? (
        <a href={action.primary.url} className={first}>
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
          className={first}
        >
          <Icon icon={lead.kind === "letter" ? MailOpen : ArrowDown} size="md" className="shrink-0" />
          <span>{t(lead.kind === "letter" ? "laufbahn.readLetter" : "laufbahn.jump")}</span>
        </a>
      ) : null}
      {cv ? (
        <a href={cv.href} download={cv.filename} data-app-download="" aria-label={t("laufbahn.downloadName", { document: t("laufbahn.cvInSentence"), pages: cv.pages })} className={second}>
          <Icon icon={Download} size="md" className="shrink-0" />
          <span>{t("laufbahn.cv")}</span>
        </a>
      ) : ownCv ? (
        <a href={ownCv.href} className={second}>
          <Icon icon={FileText} size="md" className="shrink-0" />
          <span dir="auto" className="min-w-0 break-words">
            {ownCv.label ?? t(isPdf(ownCv.href) ? "portfolio.cvPdf" : "laufbahn.cv")}
          </span>
        </a>
      ) : (
        <ShareAction title={profile.displayName} label={t("laufbahn.share")} className={second} />
      )}
    </div>
  );
}

/** Letters of the right-to-left scripts: a figure in them runs right to left, every other figure left to right. */
const RTL_LETTERS = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;

/** A figure's unit as set: after a no-break space where `splitFigure` says so ("\u00A0%"), else as it is. */
const unitText = (parts: Extract<FigureParts, { kind: "number" }>): string => (parts.unit && parts.spaced ? `\u00A0${parts.unit}` : parts.unit);

/**
 * The figures (at most three) on one baseline: each one a label (read first), a qualifier ("seit")
 * over its number, the number and its unit ("%", "Jahre") at half its size, or a value in words. The
 * three numbers share one size, as large as the widest of them allows in its column, so the row is even.
 */
function DossierFigures({ stats, average, className, style }: { stats: NonNullable<Profile["stats"]>; average: number; className?: string | undefined; style?: CSSProperties | undefined }): ReactNode {
  const figures = stats.slice(0, 3).map((stat) => ({ stat, parts: splitFigure(stat.value) }));
  const numbers = figures.flatMap(({ parts }) => (parts.kind === "number" ? [parts] : []));
  // The widest number with its unit (the unit at half size, after its no-break space or a hair), in em of the display face.
  const ems = Math.max(1, ...numbers.map((parts) => lineEms(parts.number, average) + lineEms(unitText(parts), average) / 2 + (parts.unit && !parts.spaced ? 0.1 : 0)));
  const count = figures.length;
  const column = (room: string, gap: string) => `(${room} - ${String(count - 1)} * ${gap}) / ${String(count)}`;
  const size = {
    "--figure-fit": `calc(${column(NARROW, "var(--spacing-4)")} / ${(ems * 1.06).toFixed(2)})`,
    "--figure-fit-work": `calc(${column(columns(7), "var(--spacing-6)")} / ${(ems * 1.06).toFixed(2)})`,
  } as CSSProperties;
  const qualified = numbers.some((parts) => parts.qualifier !== "");
  return (
    <dl
      className={cn(
        "mt-10 grid gap-x-4 [--figure-size:clamp(var(--text-h2),var(--figure-fit),var(--text-display-sm))] @work:mt-16 @work:gap-x-6 @work:[--figure-size:clamp(var(--text-h1),var(--figure-fit-work),var(--text-display))]",
        count === 3 ? "grid-cols-3" : count === 2 ? "grid-cols-2" : "grid-cols-1",
        className,
      )}
      style={{ ...size, ...style }}
    >
      {figures.map(({ stat, parts }) => (
        // Rows: the qualifier (kept for all when any has one, so the numbers stand level), the value, the
        // label. The label comes first for screen readers ("Pickgenauigkeit 2025: 99,6 %").
        // One track that may shrink below its longest word (minmax(0, 1fr)): a label never pushes its
        // column into the gutter. A long word too wide for its column hyphenates in the page's language
        // ("Pickgenau-igkeit" at 320 px; lb-hyphens), and only a word too long even then breaks (WCAG 1.4.10).
        <div key={`${stat.label}-${stat.value}`} className="row-span-3 grid min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-subgrid">
          <dt dir="auto" className={cn(pageSide, "row-start-3 mt-2 text-caption break-words lb-hyphens lb-ink-muted @work:text-small")}>
            {stat.label}
          </dt>
          <FigureValue parts={parts} qualified={qualified} />
        </div>
      ))}
    </dl>
  );
}

function FigureValue({ parts, qualified }: { parts: FigureParts; qualified: boolean }): ReactNode {
  if (parts.kind === "word") {
    return (
      <dd dir={RTL_LETTERS.test(parts.text) ? "rtl" : "auto"} className={cn(pageSide, "row-start-2 self-end text-h3 leading-tight font-semibold text-balance break-words lb-hyphens text-white @work:text-h2")}>
        {parts.text}
      </dd>
    );
  }
  return (
    <>
      {qualified ? (
        <dd dir="auto" className={cn(pageSide, "row-start-1 self-end text-small font-medium break-words lb-ink-muted")}>
          {parts.qualifier}
        </dd>
      ) : null}
      <dd className={cn(pageSide, "row-start-2 self-end text-white")}>
        {/* "99,6 %" stays left to right on an Arabic page; its digits are Geist's there too (the Arabic
            companion's unicode-range leaves them to the Latin face after it). */}
        <bdi dir="ltr" className="inline-flex items-baseline whitespace-nowrap">
          <span className="text-[length:var(--figure-size)] leading-none font-bold tracking-display tabular-nums">{parts.number}</span>
          {/* One form with the paper: "99,6 %" and "12 Jahre" with a no-break space of the unit's size (DIN 5008), "40+" on the number. */}
          {parts.unit ? <span className={cn("text-[length:calc(var(--figure-size)/2)] leading-none font-bold", parts.spaced ? null : "ms-0_5")}>{unitText(parts)}</span> : null}
        </bdi>
      </dd>
    </>
  );
}

/**
 * Laufbahn's head (ADR 0069 round 6, "Dossier"): type first, on ink from edge to edge, so a recruiter
 * reads who, what and for which position within seconds, and the two actions are where the thumb is.
 *
 * In this order: the availability pill, the name (h1), the role, the target line ("Bewerbung als …"
 * with the owner's own label and value), the place, the sentence, the two actions, then the figures
 * (qualifier, number and unit, label) and, last on phones, the picture or clip as a plate from edge to
 * edge (3 : 2). On the wide canvas one composition on twelve columns: the words on eight, the figures
 * under them on seven, the plate as a rounded picture on the last four, from the top of the words to
 * their last row (so it ends on a line of the head). No picture: no plate and no initials. One DOM
 * for every width. The lines rise in once when the page opens; nothing in the head
 * moves after that (no parallax), and nothing at all with reduced motion.
 */
export function DossierHero({
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
  documents = null,
  head = { target: null, employer: null },
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
  /** A badge lies over the top of the page (a prepared preview, an example): the words start below it. */
  banner?: boolean;
  /** The CV and the cover letter as PDFs (features/documents), or null. */
  documents?: DocumentsView | null | undefined;
  /** The position applied for and the employer, shown in the head (and no longer among About's facts). */
  head?: HeadFacts | undefined;
}): ReactNode {
  const isRtl = profile.locale === "ar";
  const picture = hasImage(profile.hero) ? profile.hero : hasImage(profile.avatar) ? profile.avatar : null;
  const enter = theme.layout.motion === "reveal";
  const rise = (index: number) => (enter ? { className: "poster-rise", style: { "--poster-i": index } as CSSProperties } : { className: undefined, style: undefined });
  const action = contact && primary ? { contact, primary } : null;
  const status = contact ? contactStatus(contact, now) : null;
  const ownCv = documents?.ownCv ?? (() => {
    const link = contact?.links?.find((entry) => entry.kind === "cv");
    return link ? { href: link.url, label: link.label?.trim() ? link.label : null } : null;
  })();
  const dark = theme.palette.mode !== "light";
  const average = averageOf(theme);
  const { target, employer } = head;

  return (
    <header
      data-lb-head
      className={cn(
        "poster-hero-timeline lb-ground text-white",
        // On a dark page the step from the page to ink is small: a hairline marks the head's foot.
        dark && "border-b border-creator-line",
        picture ? "pb-0 @work:pb-24" : "pb-10 @work:pb-24",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-1 @work:mx-auto @work:box-content @work:max-w-work @work:grid-cols-12 @work:grid-rows-[auto_1fr] @work:gap-x-6 @work:px-creator-gutter",
          banner ? "pt-20 @work:pt-32" : "pt-6 @work:pt-24",
        )}
      >
        {/* The words: eight columns on the wide canvas. */}
        <div data-lb-words className={cn("grid min-w-0 justify-items-start @work:col-span-8 @work:col-start-1 @work:row-start-1", COLUMN_INSET)}>
          {live ? <HeroLive block={live} /> : null}
          {status ? <StatusPill text={status} className={rise(0).className} style={rise(0).style} /> : null}
          <div className={cn("w-full min-w-0", rise(1).className)} style={rise(1).style}>
            {/* The name keeps its space under the live pill or the status; first in the head, it starts at the top. */}
            <DossierName profile={profile} theme={theme} isRtl={isRtl} className={status || live ? undefined : "mt-0"} />
          </div>
          {profile.tagline ? (
            <p data-lb-role dir="auto" className={cn(pageSide, "mt-4 max-w-full text-h3 font-medium text-balance break-words @work:text-h2 rtl:leading-normal", rise(2).className)} style={rise(2).style} {...aiText(profile, "tagline")}>
              {keepSeparators(profile.tagline)}
            </p>
          ) : null}
          {target ? (
            <p data-lb-target className={cn("mt-3 max-w-full text-body text-pretty break-words @work:text-body-lg", rise(3).className)} style={rise(3).style}>
              <span dir="auto" className="lb-ink-muted">
                {target.label.trim().replace(/\s*:$/u, "")}
              </span>{" "}
              <bdi dir="auto" className="font-semibold text-white">
                {target.value}
              </bdi>
              {employer ? (
                <>
                  {`${NBSP}· `}
                  <span dir="auto" className="lb-ink-muted">
                    {employer.label.trim().replace(/\s*:$/u, "")}
                  </span>{" "}
                  <bdi dir="auto" className="font-semibold text-white">
                    {employer.value}
                  </bdi>
                </>
              ) : null}
            </p>
          ) : null}
          {profile.location ? (
            <p className="mt-3 inline-flex max-w-full items-center gap-1 text-small font-medium lb-ink-muted">
              <Icon icon={MapPin} size="sm" className="shrink-0" />
              <span dir="auto" className="min-w-0 break-words">
                {profile.location}
              </span>
            </p>
          ) : null}
          {profile.bio ? (
            <p dir="auto" className={cn(pageSide, "mt-4 max-w-prose text-body text-pretty break-words lb-ink-muted @work:text-body-lg")} {...aiText(profile, "bio")}>
              {profile.bio}
            </p>
          ) : null}
          <DossierActions
            profile={profile}
            action={action}
            lead={lead}
            documents={documents}
            ownCv={ownCv}
            className={cn("w-full", rise(4).className)}
            style={rise(4).style}
          />
          {socials ? (
            <div className={cn("mt-6", rise(4).className)} style={rise(4).style}>
              <Socials block={socials} plain={theme.layout.socials === "plain"} start inverse />
            </div>
          ) : null}
        </div>

        {/* The figures: under the words, seven columns on the wide canvas. */}
        {profile.stats?.length ? (
          <DossierFigures
            stats={profile.stats}
            average={average}
            className={cn(COLUMN_INSET, "@work:col-span-7 @work:col-start-1 @work:row-start-2 @work:self-end", rise(5).className)}
            style={rise(5).style}
          />
        ) : null}

        {/* The picture or clip: last on phones and tablets, from edge to edge; on the wide canvas a plate
            on the last four columns from the top of the words to their last row (the actions, or the
            social links under them), the picture covering it at its focal point. */}
        {picture ? (
          <div
            data-hero-plate
            className="relative mt-10 aspect-photo overflow-hidden bg-hover-inverse @work:col-span-4 @work:col-start-9 @work:row-start-1 @work:mt-0 @work:aspect-auto @work:self-stretch @work:rounded-xl"
          >
            <MediaImage src={picture.src} focal={picture.focal} alt={picture.alt} sizes={plateSizes(picture)} priority={!preview} />
            {profile.motion ? <HeroMotion src={profile.motion.src} tone="ink" /> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
