"use client";

import { cn } from "@linkyo/ui";
import { useEffect, useRef, useState } from "react";

const SAMPLE_PREFIX = "sample:motion-";

/** Where a moving picture lives: our sample clips by key, or the creator's own https link. */
export function resolveMotion(src: string): string | null {
  if (src.startsWith(SAMPLE_PREFIX)) return `/media/motion/${src.slice(SAMPLE_PREFIX.length)}.mp4`;
  return src.startsWith("https://") ? src : null;
}

/** Visitors who asked for less motion or less data keep the still photo. */
function mayMove(): boolean {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return !reduced && !saveData;
}

/**
 * A moving picture over the hero photo: a short silent clip that loops. The photo underneath is the
 * poster, so nothing jumps while the clip loads; the clip fades in on its first frame, pauses when it
 * scrolls out of view, and never plays for reduced motion or data saver. Decorative (the photo
 * carries the description), so it is hidden from assistive technology.
 */
export function HeroMotion({ src, className }: { src: string; className?: string | undefined }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const url = resolveMotion(src);

  useEffect(() => {
    const element = video.current;
    if (!element || !url || !mayMove()) return;
    element.muted = true;
    element.preload = "auto";
    const play = () => {
      element.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    };
    // Play only while on screen: no decoding for a hero the visitor has scrolled past.
    const observer = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? play() : element.pause()), { threshold: 0.1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [url]);

  if (!url) return null;
  return (
    <video
      ref={video}
      src={url}
      aria-hidden
      tabIndex={-1}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-slow ease-standard motion-reduce:hidden",
        playing ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
