import type { BlockOf, Page } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { MediaImage, mediaSizes, PlatformGlyph, platformName } from "../shared/creator-kit";
import { ShareButton } from "./share";
import { displayStyle } from "./styles";

type Profile = Page["profile"];

function Name({ profile, isRtl }: { profile: Profile; isRtl: boolean }) {
  const t = useTranslations("creator");
  return (
    <h1 className={cn("font-creator-display text-display text-balance break-words @prose:text-display-xl", isRtl ? "leading-tight" : "leading-none")} style={displayStyle}>
      {profile.displayName}
      {profile.verified ? (
        <span className="ms-2 inline-block align-middle text-creator-accent-text">
          <Icon icon={BadgeCheck} size="lg" label={t("verified")} />
        </span>
      ) : null}
    </h1>
  );
}

function Socials({ block }: { block: BlockOf<"socials"> }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {block.items.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            aria-label={platformName(item.platform)}
            className="grid size-touch-target place-items-center rounded-full text-creator-fg transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring"
          >
            <PlatformGlyph platform={item.platform} size="lg" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The hero. Three treatments chosen by the template:
 * - portrait: the photo fades into the page, the name overlaps the fade;
 * - duotone: the photo is toned into the page color (screen for dark photos, multiply for light);
 * - logo: the creator's logo over a softly blurred photo (falls back to portrait without a logo).
 * On scroll the photo softens and fades away (CSS scroll-driven animation, no JavaScript).
 */
export function PosterHero({
  profile,
  socials,
  theme,
  preview,
}: {
  profile: Profile;
  socials: BlockOf<"socials"> | undefined;
  theme: ResolvedCreatorTheme;
  preview: boolean;
}) {
  const isRtl = profile.locale === "ar";
  const photo = profile.hero ?? profile.avatar;
  const treatment = theme.layout.hero === "logo" && !profile.logo ? "portrait" : theme.layout.hero;

  return (
    <header className="poster-hero-timeline grid justify-items-center text-center">
      {treatment === "logo" && profile.logo ? (
        <div className="poster-hero-fade relative grid aspect-square w-full place-items-center overflow-hidden mask-b-from-55% mask-b-to-100% @prose:rounded-t-xl">
          <MediaImage src={photo.src} alt="" sizes={mediaSizes.column} priority={!preview} className="scale-lift blur-glass" />
          <div aria-hidden className="absolute inset-0 bg-creator-bg opacity-secondary" />
          <h1 className="relative w-3/5">
            <span className="relative block aspect-square">
              <MediaImage src={profile.logo.src} alt={profile.displayName} sizes={mediaSizes.half} className="object-contain" />
            </span>
          </h1>
        </div>
      ) : (
        <div
          className={cn(
            "poster-hero-fade relative aspect-portrait w-full overflow-hidden mask-b-from-45% mask-b-to-90% @prose:rounded-t-xl",
            treatment === "duotone" && "isolate bg-creator-bg",
          )}
        >
          <MediaImage
            src={photo.src}
            alt={photo.alt}
            sizes={mediaSizes.column}
            priority={!preview}
            className={treatment === "duotone" ? cn("grayscale contrast-125", photo.tone === "light" ? "mix-blend-multiply" : "mix-blend-screen") : undefined}
          />
        </div>
      )}
      <div className={cn("relative grid justify-items-center gap-3 px-creator-gutter", treatment === "logo" && profile.logo ? "-mt-6" : "-mt-16")}>
        {treatment === "logo" && profile.logo ? null : <Name profile={profile} isRtl={isRtl} />}
        {profile.tagline ? <p className="text-small font-semibold tracking-wide text-balance uppercase">{profile.tagline}</p> : null}
        {profile.bio ? <p className="max-w-prose text-body-lg text-balance text-creator-fg-muted">{profile.bio}</p> : null}
        {socials ? (
          <div className="pt-1">
            <Socials block={socials} />
          </div>
        ) : null}
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
        <span className="relative size-control-sm shrink-0 overflow-hidden rounded-full bg-creator-surface-2">
          <MediaImage src={profile.avatar.src} alt="" sizes={mediaSizes.thumb} />
        </span>
        <p className="min-w-0 flex-1 truncate text-body font-semibold">{profile.displayName}</p>
        <ShareButton title={profile.displayName} />
      </div>
    </div>
  );
}
