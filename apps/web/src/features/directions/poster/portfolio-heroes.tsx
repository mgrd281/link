import { hasImage, type BlockOf, type Page } from "@linkyo/blocks";
import { contactStatus } from "@linkyo/blocks/project";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { MediaImage, mediaSizes, Monogram } from "../shared/creator-kit";
import { HeroMotion } from "../shared/motion";
import { aiText, HeroActions, Name, Socials, Stats, StatusLine } from "./hero";
import { ratioOf } from "./justified";
import { HeroLive } from "./live";
import { plateFrame } from "./projects";
import { displayStyle, pageSide } from "./styles";

/**
 * The heroes of Stage 3's portfolio templates (plan 4.2). Each has the page's one primary action
 * (`HeroActions`), its profiles and its numbers, like every hero; what differs is what opens the page:
 *
 * - strip (Leuchttisch, photographers): the name and role, small, on one line; then the work itself, the
 *   first covers in one row at their own ratios (`ProjectStrip`); the words follow, in the creator column.
 * - titleblock (Grundriss, designers and architects): an architect's title block, a ruled box holding the
 *   name, the discipline, the place, the availability and the action, beside the lead project's cover
 *   with its drawing label. Phones: the block, then the cover at 3:2.
 * - readme (Logbuch, developers and makers): a README's first screen: the name as its heading, the role
 *   line, the sentence and the action; beside them, a monospace list of facts (stack, place,
 *   availability, repositories) drawn from the page's own blocks, never typed twice.
 *
 * No picture carries text; nothing moves (the three looks are calm).
 */

type Profile = Page["profile"];
type Contact = BlockOf<"contact">;

interface HeroProps {
  profile: Profile;
  socials: BlockOf<"socials"> | undefined;
  live?: BlockOf<"live"> | undefined;
  theme: ResolvedCreatorTheme;
  preview: boolean;
  /** The page's contact block, and its primary action (`primaryAction`): both or neither. */
  contact?: Contact | undefined;
  primary?: Contact["primary"] | null | undefined;
  now: Date;
}

function actionsOf({ contact, primary, now }: HeroProps, status: boolean): ReactNode {
  return contact && primary ? <HeroActions contact={contact} primary={primary} now={now} align="start" status={status} /> : null;
}

/** The owner's own hero picture, uncropped, never taller than 70svh: where no project opens the page. */
function OwnPicture({ image, motion, preview }: { image: NonNullable<Profile["hero"]>; motion: Profile["motion"]; preview: boolean }): ReactNode {
  return (
    <div className="px-creator-gutter @prose:px-0">
      <div data-plate style={{ "--ratio": ratioOf(image) } as CSSProperties} className="relative aspect-(--ratio) w-[min(100%,calc(70svh*var(--ratio)))] overflow-hidden bg-creator-surface-2">
        <MediaImage src={image.src} focal={image.focal} alt={image.alt} sizes={mediaSizes.work} priority={!preview} />
        {motion ? <HeroMotion src={motion.src} /> : null}
      </div>
    </div>
  );
}

/**
 * Leuchttisch. `strip` is the work's first covers (`ProjectStrip`); without any, the owner's own hero
 * picture stands there, uncropped; without that, the words open the page.
 */
export function StripHero(props: HeroProps & { strip?: ReactNode }): ReactNode {
  const { profile, socials, live, theme, preview, strip } = props;
  const t = useTranslations("creator");
  const own = hasImage(profile.hero) ? profile.hero : undefined;
  // The strip's scroller reaches the screen's edges on phones (it is pulled out by the gutter it adds back inside).
  const pictures = strip ? <div className="px-creator-gutter @prose:px-0">{strip}</div> : own ? <OwnPicture image={own} motion={profile.motion} preview={preview} /> : null;
  const plain = theme.layout.socials === "plain";
  return (
    <header className="poster-hero-timeline grid grid-cols-1 gap-y-5 pt-6 text-start @work:gap-y-8">
      {/* The name bar: the name and the role, small, on one line where they fit. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 px-creator-gutter @prose:px-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="min-w-0 font-creator-display text-title leading-snug font-semibold break-words" style={displayStyle} {...aiText(profile, "displayName")}>
            <bdi dir="auto">{profile.displayName}</bdi>
            {profile.verified ? (
              <span className="ms-2 inline-block align-middle text-creator-accent-text">
                <Icon icon={BadgeCheck} size="sm" label={t("verified")} />
              </span>
            ) : null}
          </h1>
          {profile.tagline ? (
            <p dir="auto" className={cn(pageSide, "min-w-0 text-small break-words text-creator-fg-muted")} {...aiText(profile, "tagline")}>
              {profile.tagline}
            </p>
          ) : null}
        </div>
        {live ? <HeroLive block={live} /> : null}
      </div>
      {pictures}
      {/* The words, in the creator column; on the canvas the action and the profiles stand at the far side. */}
      <div className="grid grid-cols-1 justify-items-start gap-5 px-creator-gutter @prose:px-0 @work:grid-cols-12 @work:gap-x-6">
        {profile.bio ? (
          <p dir="auto" className={cn(pageSide, "w-full max-w-creator text-body-lg text-pretty break-words @work:col-span-6")} {...aiText(profile, "bio")}>
            {profile.bio}
          </p>
        ) : null}
        <div className="grid w-full min-w-0 justify-items-start gap-5 @work:col-span-5 @work:col-start-8">
          {actionsOf(props, true)}
          {profile.stats?.length ? <Stats stats={profile.stats} start /> : null}
          {socials ? <Socials block={socials} plain={plain} start solid balance /> : null}
        </div>
      </div>
    </header>
  );
}

/** A row of the title block: its label in small capitals, then the value. */
function TitleRow({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] items-baseline gap-x-4 border-b border-creator-line-strong px-4 py-3 @prose:px-5">
      <dt className="min-w-0 text-caption font-semibold tracking-wide break-words text-creator-fg-muted uppercase rtl:tracking-normal rtl:normal-case">{label}</dt>
      <dd className="min-w-0 text-small font-medium break-words">{children}</dd>
    </div>
  );
}

/**
 * Grundriss. `plate` is the lead project's cover with its drawing label (`ProjectPlate drawing`);
 * without a project the owner's own hero picture stands there, at 3:2.
 */
export function TitleBlockHero(props: HeroProps & { plate?: ReactNode }): ReactNode {
  const { profile, socials, live, theme, preview, contact, now, plate } = props;
  const t = useTranslations("creator");
  const isRtl = profile.locale === "ar";
  const own = hasImage(profile.hero) ? profile.hero : undefined;
  const picture = own ? (
    <div data-plate className={cn(plateFrame, "aspect-photo")}>
      <MediaImage src={own.src} focal={own.focal} alt={own.alt} sizes={mediaSizes.workPlate} priority={!preview} />
      {profile.motion ? <HeroMotion src={profile.motion.src} /> : null}
    </div>
  ) : (
    plate
  );
  const status = contact ? contactStatus(contact, now) : null;
  const actions = actionsOf(props, false);
  const plain = theme.layout.socials === "plain";
  return (
    <header
      className={cn(
        "poster-hero-timeline grid grid-cols-1 gap-y-6 px-creator-gutter pt-8 text-start @prose:px-0",
        picture ? "@work:grid-cols-12 @work:grid-rows-[auto_minmax(0,1fr)] @work:gap-x-6 @work:pt-6" : "@work:pt-24",
      )}
    >
      {/* The title block: paper over the column guides, ruled like the corner of a drawing. */}
      <div className={cn("grid min-w-0 grid-cols-1 border border-creator-line-strong bg-creator-bg", picture ? "@work:col-span-5 @work:row-start-1" : "w-full max-w-prose")}>
        {live ? (
          <div className="border-b border-creator-line-strong px-4 py-3 @prose:px-5">
            <HeroLive block={live} />
          </div>
        ) : null}
        <div className="min-w-0 border-b border-creator-line-strong px-4 pt-4 pb-5 @prose:px-5">
          <Name profile={profile} isRtl={isRtl} theme={theme} scale="block" inset="2 * var(--spacing-5) + var(--spacing-1)" />
        </div>
        {profile.tagline || profile.location || status ? (
          <dl className="grid grid-cols-1">
            {profile.tagline ? (
              <TitleRow label={t("titleblock.discipline")}>
                <span dir="auto" className={cn(pageSide, "block")} {...aiText(profile, "tagline")}>
                  {profile.tagline}
                </span>
              </TitleRow>
            ) : null}
            {profile.location ? (
              <TitleRow label={t("titleblock.place")}>
                <bdi dir="auto">{profile.location}</bdi>
              </TitleRow>
            ) : null}
            {status ? (
              <TitleRow label={t("titleblock.status")}>
                <StatusLine text={status} />
              </TitleRow>
            ) : null}
          </dl>
        ) : null}
        {actions ? <div className="p-4 @prose:p-5">{actions}</div> : null}
      </div>
      {picture ? <div className="min-w-0 @work:col-span-7 @work:col-start-6 @work:row-span-2 @work:row-start-1">{picture}</div> : null}
      {profile.bio || profile.stats?.length || socials ? (
        <div className={cn("grid min-w-0 grid-cols-1 justify-items-start gap-4", picture ? "@work:col-span-5 @work:col-start-1 @work:row-start-2" : "max-w-prose")}>
          {profile.bio ? (
            <p dir="auto" className={cn(pageSide, "w-full text-body-lg text-pretty break-words")} {...aiText(profile, "bio")}>
              {profile.bio}
            </p>
          ) : null}
          {profile.stats?.length ? <Stats stats={profile.stats} start /> : null}
          {socials ? <Socials block={socials} plain={plain} start solid balance /> : null}
        </div>
      ) : null}
    </header>
  );
}

/** A key of the README's list: lower case, as it would stand in a file. */
function ReadmeRow({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] items-baseline gap-x-4 border-b border-creator-line px-4 py-3 last:border-b-0">
      <dt className="min-w-0 break-words text-creator-fg-muted lowercase">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/**
 * Logbuch. `tools` is the page's first skills block (its first four items are the stack), `repos` the
 * repositories its projects were read from ("owner/name").
 */
export function ReadmeHero(props: HeroProps & { tools?: BlockOf<"tools"> | undefined; repos: readonly string[] }): ReactNode {
  const { profile, socials, live, theme, contact, now, tools, repos } = props;
  const t = useTranslations("creator");
  const isRtl = profile.locale === "ar";
  const status = contact ? contactStatus(contact, now) : null;
  const stack = tools?.items.slice(0, 4) ?? [];
  const plain = theme.layout.socials === "plain";
  const facts = stack.length > 0 || Boolean(profile.location) || status !== null || repos.length > 0;
  return (
    <header className="poster-hero-timeline grid grid-cols-1 gap-6 px-creator-gutter pt-10 text-start @prose:px-0 @work:grid-cols-12 @work:gap-x-6 @work:pt-24">
      <div className="grid min-w-0 grid-cols-1 justify-items-start gap-4 @work:col-span-7">
        {live ? <HeroLive block={live} /> : null}
        {/* A README's first line: the heading mark, then the name (the mark takes its share of the line). */}
        <div className="flex w-full min-w-0 items-baseline gap-3">
          <span aria-hidden className="shrink-0 font-creator-body text-h2 leading-none font-semibold text-creator-accent-text">
            #
          </span>
          <Name profile={profile} isRtl={isRtl} theme={theme} scale="block" inset="var(--spacing-6) + var(--spacing-3)" />
        </div>
        {/* The role line, with the small avatar at its inline end. */}
        <div className="flex w-full min-w-0 items-center justify-between gap-4">
          {profile.tagline ? (
            <p dir="auto" className={cn(pageSide, "min-w-0 text-title text-balance break-words")} {...aiText(profile, "tagline")}>
              {profile.tagline}
            </p>
          ) : (
            <span />
          )}
          <span className="relative size-avatar-md shrink-0 overflow-hidden rounded-full bg-creator-surface-2 text-small">
            {hasImage(profile.avatar) ? <MediaImage src={profile.avatar.src} focal={profile.avatar.focal} alt={profile.avatar.alt} sizes={mediaSizes.thumb} /> : <Monogram name={profile.displayName} />}
          </span>
        </div>
        {profile.bio ? (
          <p dir="auto" className={cn(pageSide, "w-full max-w-prose text-body text-pretty break-words text-creator-fg-muted")} {...aiText(profile, "bio")}>
            {profile.bio}
          </p>
        ) : null}
        {actionsOf(props, false)}
        {socials ? <Socials block={socials} plain={plain} start solid balance /> : null}
      </div>
      {facts || profile.stats?.length ? (
        <div className="grid min-w-0 grid-cols-1 content-start gap-5 @work:col-span-5 @work:col-start-8">
          {facts ? (
            <dl className="grid grid-cols-1 rounded-creator-card border border-creator-line bg-creator-surface font-creator-body text-small">
              {stack.length > 0 ? (
                <ReadmeRow label={t("readme.stack")}>
                  <span dir="auto" className={cn(pageSide, "block")}>
                    {stack.join(" · ")}
                  </span>
                </ReadmeRow>
              ) : null}
              {profile.location ? (
                <ReadmeRow label={t("readme.place")}>
                  <bdi dir="auto">{profile.location}</bdi>
                </ReadmeRow>
              ) : null}
              {status ? (
                <ReadmeRow label={t("readme.available")}>
                  <StatusLine text={status} />
                </ReadmeRow>
              ) : null}
              {repos.length > 0 ? (
                <ReadmeRow label={t("readme.repos")}>
                  {/* Repository names read left to right on every page. */}
                  <bdi dir="ltr">{repos.join(", ")}</bdi>
                </ReadmeRow>
              ) : null}
            </dl>
          ) : null}
          {profile.stats?.length ? <Stats stats={profile.stats} start /> : null}
        </div>
      ) : null}
    </header>
  );
}
