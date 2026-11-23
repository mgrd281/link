"use client";

import { Button, cn } from "@linkyo/ui";
import { Crosshair } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, type MouseEvent } from "react";

import { remoteImageProps, resolveMedia } from "@/features/directions/shared/media";

import type { ImageValue } from "./form";

/** The slider steps (0–100 in steps of 5): a tap lands on the same grid, so both agree. */
const STEP = 5;
const CENTRE: [number, number] = [0.5, 0.5];

/** A share (0–1) on the slider grid. */
export const snapFocal = (share: number): number => Math.round(Math.min(1, Math.max(0, share)) * (100 / STEP)) / (100 / STEP);

/** Where a pointer at (x, y) lies on a box, as a focal point on the slider grid. */
export function focalAt(x: number, y: number, box: { left: number; top: number; width: number; height: number }): [number, number] {
  return [snapFocal((x - box.left) / Math.max(1, box.width)), snapFocal((y - box.top) / Math.max(1, box.height))];
}

const position = ([x, y]: readonly [number, number]): string => `${String(x * 100)}% ${String(y * 100)}%`;

/** The three crops a picture gets on a page: a square tile, a wide lead tile and an upright rail card. */
const PREVIEWS = [
  { key: "square", className: "aspect-square w-20" },
  { key: "video", className: "aspect-video w-32" },
  { key: "portrait", className: "aspect-portrait w-20" },
] as const;

/**
 * The focal point of a picture: the spot cards crop around. The whole picture with a round marker,
 * set by one tap or click anywhere on it (a single pointer action), or with two sliders for the
 * keyboard and screen readers; three live previews show the crops. The stored file is never cut.
 * Pictures never mirror, so the picture, its previews and the left-to-right slider are left to right
 * in every language: in Arabic too, the marker and the slider's thumb move the same way.
 */
export function FocalInput({ image, onFocal }: { image: ImageValue; onFocal: (focal: [number, number] | undefined) => void }) {
  const t = useTranslations("app.portfolio.focus");
  const id = useId();
  const focal = image.focal ?? CENTRE;
  const resolved = resolveMedia(image.src);
  const ratio = image.w && image.h ? `${String(image.w)} / ${String(image.h)}` : undefined;
  const set = (next: [number, number]) => onFocal(next[0] === 0.5 && next[1] === 0.5 ? undefined : next);
  const tap = (event: MouseEvent<HTMLDivElement>) => set(focalAt(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()));

  return (
    <div className="grid grid-cols-1 gap-5">
      <p className="text-small font-regular text-fg-secondary">{t("hint")}</p>
      <div dir="ltr" className="grid grid-cols-1 gap-4">
        {/* The tap target is the picture itself; the sliders below are its keyboard twin. */}
        <div
          data-focal-picture
          aria-hidden
          onClick={tap}
          style={{ aspectRatio: ratio }}
          className={cn("relative w-full cursor-crosshair overflow-hidden rounded-md border border-line bg-canvas-muted", ratio ? null : "aspect-photo")}
        >
          <Image src={resolved} alt="" fill sizes="(width < 64rem) 100vw, 40rem" className="object-contain" {...remoteImageProps(resolved)} />
          <span
            data-focal-marker
            style={{ left: `${String(focal[0] * 100)}%`, top: `${String(focal[1] * 100)}%` }}
            // White ring and dot on a dark disc in both modes (control-knob is white in the dark
            // dashboard too, where surface-elevated is near black): it stands out on any picture.
            className="pointer-events-none absolute grid size-touch-target -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-control-knob bg-scrim"
          >
            <span className="size-dot rounded-full bg-control-knob" />
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3" aria-hidden>
          {PREVIEWS.map((preview) => (
            <span key={preview.key} data-focal-preview={preview.key} className={cn("relative shrink-0 overflow-hidden rounded-sm border border-line bg-canvas-muted", preview.className)}>
              <Image src={resolved} alt="" fill sizes="8rem" className="object-cover" style={{ objectPosition: position(focal) }} {...remoteImageProps(resolved)} />
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Slider id={`${id}-x`} label={t("x")} value={focal[0]} ltr onValue={(x) => set([x, focal[1]])} />
        <Slider id={`${id}-y`} label={t("y")} value={focal[1]} ltr onValue={(y) => set([focal[0], y])} />
      </div>
      <Button type="button" variant="ghost" icon={Crosshair} className="justify-self-start" disabled={image.focal === undefined} onClick={() => onFocal(undefined)}>
        {t("centre")}
      </Button>
    </div>
  );
}

/** A native range input (0–100, steps of 5) with its label and value. */
function Slider({ id, label, value, onValue, ltr = false }: { id: string; label: string; value: number; onValue: (value: number) => void; ltr?: boolean }) {
  const percent = Math.round(value * 100);
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-small text-fg">
          {label}
        </label>
        <span aria-hidden className="text-caption text-fg-secondary tabular-nums">
          {percent}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={STEP}
        value={percent}
        dir={ltr ? "ltr" : undefined}
        onChange={(event) => onValue(Number(event.target.value) / 100)}
        className="h-touch-target w-full cursor-pointer accent-fg focus-visible:focus-ring"
      />
    </div>
  );
}
