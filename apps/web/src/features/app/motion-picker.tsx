"use client";

import type { Page } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { Ban, Check, Link2, Pause, PenTool, Play, Video } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import {
  libraryClip,
  MOTION_LIBRARY,
  motionSrc,
  posterClip,
  withLibraryClip,
  type MotionClip,
} from "@/features/creator/motion-library";
import { resolveMedia } from "@/features/directions/shared/media";
import { resolveMotion } from "@/features/directions/shared/motion";
import { mediaSizes } from "@/features/directions/shared/platforms";

import { UrlInput } from "./form";

type Profile = Page["profile"];
type Hero = Profile["hero"];

/** A library clip becomes the moving header, and its first frame the header picture (so nothing jumps). */
export const withClip = (profile: Profile, clip: MotionClip): Profile => withLibraryClip(profile, clip);

/**
 * Leaving a library clip: the moving header goes, and so does the clip's still, which gives back the
 * header picture there was before. A picture chosen since then stays.
 */
export function withoutClip(profile: Profile, heroBefore: Hero, motion?: Profile["motion"]): Profile {
  // Both keys stay, set or undefined: a save merges the draft into the stored profile, so a key left
  // out would keep the old clip.
  return { ...profile, hero: posterClip(profile.hero?.src) ? heroBefore : profile.hero, motion };
}

/** "none", "own", or a library clip's key. */
type Choice = string;

/** A radio drawn as a tile: native input (arrow keys, screen readers), the dashboard's chosen look. */
function Tile({
  name,
  checked,
  onChange,
  className,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "duration-micro has-[:focus-visible]:focus-ring active:scale-pressed relative cursor-pointer rounded-lg border transition-[background-color,border-color,scale] motion-reduce:active:scale-none",
        checked
          ? "border-focus bg-selected text-selected-fg"
          : "border-line-strong bg-surface hover:border-line-input",
        className,
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

/**
 * "Moving header": Linkyo's own clips to choose from (each with its still and its length, and a button
 * that plays it right in the tile), none, or the owner's own MP4 link. A chosen clip also sets the
 * header picture to its first frame. Linkyo's clips are served from this site, so they play on the
 * public page too (it loads nothing from elsewhere).
 */
export function MotionPicker({
  profile,
  onChange,
  onCheck,
  error,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
  /** The own link was left: check it now. */
  onCheck?: (() => void) | undefined;
  error?: string | undefined;
}) {
  const t = useTranslations("app.profile");
  const name = useId();
  const labelId = useId();
  const leadId = useId();
  const src = profile.motion?.src;
  const clip = libraryClip(src);
  // "Own link" stays chosen while its field is still empty; a link typed earlier comes back with it.
  const [ownChosen, setOwnChosen] = useState(() => Boolean(src) && !clip);
  const [ownUrl, setOwnUrl] = useState(() => (clip ? "" : (src ?? "")));
  // The header picture from before a clip's still replaced it.
  const [heroBefore, setHeroBefore] = useState<Hero>(() =>
    posterClip(profile.hero?.src) ? undefined : profile.hero,
  );
  const [watching, setWatching] = useState<MotionClip["key"] | null>(null);
  const choice: Choice = clip ? clip.key : ownChosen || src ? "own" : "none";

  const choose = (next: Choice) => {
    const picked = MOTION_LIBRARY.find((item) => item.key === next);
    if (picked) {
      if (!clip && !posterClip(profile.hero?.src)) setHeroBefore(profile.hero);
      setOwnChosen(false);
      onChange(withClip(profile, picked));
      return;
    }
    setOwnChosen(next === "own");
    const own = next === "own" && ownUrl.trim() ? { src: ownUrl.trim() } : undefined;
    onChange(withoutClip(profile, heroBefore, own));
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <p id={labelId} className="text-small text-fg">
        {t("motion")}
      </p>
      <p id={leadId} className="text-small font-regular text-fg-secondary -mt-2">
        {t("motionLead")}
      </p>
      {/* Clips as tall tiles, two per row on phones and four in a wider sheet; then "none" and "own link" as
          short ones. One group of native radios: the arrow keys go through all of them. */}
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={leadId}
        className="grid grid-cols-1 gap-2"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MOTION_LIBRARY.map((item) => {
            const title = t(`motionClips.${item.key}`);
            const playing = watching === item.key;
            const still = resolveMedia(item.poster);
            const url = resolveMotion(motionSrc(item));
            return (
              <div key={item.key} className="relative">
                <Tile
                  name={name}
                  checked={choice === item.key}
                  onChange={() => choose(item.key)}
                  className="grid h-full content-start gap-2 p-2"
                >
                  <span className="aspect-portrait bg-canvas-muted relative block overflow-hidden rounded-md">
                    <Image src={still} alt="" fill sizes={mediaSizes.half} className="object-cover" />
                    {playing && url ? (
                      <video
                        src={url}
                        poster={typeof still === "string" ? still : still.src}
                        muted
                        loop
                        playsInline
                        autoPlay
                        aria-hidden
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : null}
                    {/* The chosen clip's mark sits on its picture, so the name keeps the tile's whole width. */}
                    {choice === item.key ? (
                      <span className="border-line bg-surface-elevated text-fg absolute start-2 top-2 grid size-6 place-items-center rounded-full border">
                        <Icon icon={Check} size="sm" />
                      </span>
                    ) : null}
                    {/* Real footage or a drawing, as a badge on the picture; screen readers hear it after the length. */}
                    <span aria-hidden className="absolute inset-x-2 bottom-2 flex">
                      <span className="border-line bg-surface-elevated text-caption text-fg inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 font-medium">
                        <Icon icon={item.kind === "film" ? Video : PenTool} size="sm" className="shrink-0" />
                        <span className="truncate">{t(`motionKind.${item.kind}`)}</span>
                      </span>
                    </span>
                  </span>
                  <span className="grid min-w-0 px-1 pb-1">
                    <span className="text-small font-medium break-words">{title}</span>
                    <span className="text-small font-regular text-fg-secondary">
                      {t("motionSeconds", { seconds: item.seconds })}
                      <span className="sr-only">, {t(`motionKindLong.${item.kind}`)}</span>
                    </span>
                  </span>
                </Tile>
                {/* Outside the tile's label, so it is a control of its own: it plays the clip, it does not choose it.
                  A 44 px target around a smaller disc, so it does not cover a narrow picture; the disc stays
                  opaque on hover, readable over the moving picture. */}
                <button
                  type="button"
                  aria-label={playing ? t("motionStop", { name: title }) : t("motionWatch", { name: title })}
                  aria-pressed={playing}
                  onClick={() => setWatching(playing ? null : item.key)}
                  className="group size-touch-target focus-visible:focus-ring absolute end-1 top-1 grid place-items-center rounded-full"
                >
                  <span className="size-control-sm border-line bg-surface-elevated text-fg duration-micro group-hover:bg-canvas-muted group-active:scale-pressed grid place-items-center rounded-full border transition-[background-color,scale] motion-reduce:group-active:scale-none">
                    <Icon icon={playing ? Pause : Play} size="sm" solid />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Tile
            name={name}
            checked={choice === "none"}
            onChange={() => choose("none")}
            className="min-h-touch-target text-small flex items-center gap-2 px-3 font-medium"
          >
            <Icon icon={Ban} size="sm" className="shrink-0" />
            <span className="min-w-0 break-words">{t("motionNone")}</span>
          </Tile>
          <Tile
            name={name}
            checked={choice === "own"}
            onChange={() => choose("own")}
            className="min-h-touch-target text-small flex items-center gap-2 px-3 font-medium"
          >
            <Icon icon={Link2} size="sm" className="shrink-0" />
            <span className="min-w-0 break-words">{t("motionOwn")}</span>
          </Tile>
        </div>
      </div>
      {choice === "own" ? (
        <UrlInput
          label={t("motionOwnUrl")}
          hint={t("motionHint")}
          value={ownUrl}
          onValue={(typed) => {
            setOwnUrl(typed);
            onChange(
              typed.trim()
                ? { ...profile, motion: { src: typed.trim() } }
                : withoutClip(profile, profile.hero),
            );
          }}
          onBlur={onCheck}
          error={error}
        />
      ) : null}
    </div>
  );
}
