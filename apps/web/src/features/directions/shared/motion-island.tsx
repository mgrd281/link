"use client";

import { useTranslations } from "next-intl";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Visitors who asked for less motion or less data start with the still photo (they can press play). */
function startsOnItsOwn(): boolean {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return !reduced && !saveData;
}

/**
 * A moving picture over the hero photo (`./motion.tsx` draws its icons and classes): a short silent
 * clip that loops. The photo underneath is the poster, so nothing jumps while the clip loads; the clip
 * fades in on its first frame.
 *
 * - It starts on its own, except for reduced motion or data saver.
 * - When the browser refuses (iPhone in Low Power Mode), it starts on the visitor's first tap.
 * - It pauses while scrolled out of view.
 * - A button pauses and plays it (WCAG 2.2.2: moving content can be stopped).
 *
 * Decorative (the photo carries the description), so the video itself is hidden from assistive tech.
 */
export function HeroMotionIsland({
  url,
  classes,
  icons,
}: {
  url: string;
  /** The video's classes while it plays and while it stands, and the play/pause button's. */
  classes: { playing: string; paused: string; button: string };
  icons: { pause: ReactNode; play: ReactNode };
}) {
  const t = useTranslations("creator");
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  // The visitor's own choice wins over autoplay and over coming back into view.
  const stopped = useRef(false);

  const play = useCallback(() => {
    const element = video.current;
    if (!element) return Promise.resolve(false);
    element.muted = true;
    element.preload = "auto";
    return element.play().then(
      () => {
        setPlaying(true);
        return true;
      },
      () => false,
    );
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let visible = false;
    const auto = startsOnItsOwn();
    // Refused without a tap (Low Power Mode): try again on the first tap anywhere on the page.
    const onFirstTap = () => {
      if (!stopped.current && visible) void play();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (!visible) {
          element.pause();
          return;
        }
        if (!auto || stopped.current) return;
        void play().then((started) => {
          if (!started) {
            document.addEventListener("pointerup", onFirstTap, { once: true });
            document.addEventListener("touchend", onFirstTap, { once: true });
          }
        });
      },
      { threshold: 0.1 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerup", onFirstTap);
      document.removeEventListener("touchend", onFirstTap);
    };
  }, [url, play]);

  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (playing) {
      stopped.current = true;
      element.pause();
      setPlaying(false);
    } else {
      stopped.current = false;
      void play();
    }
  };

  return (
    <>
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
        onPause={() => setPlaying(false)}
        onPlaying={() => setPlaying(true)}
        className={playing ? classes.playing : classes.paused}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("motionPause") : t("motionPlay")}
        className={classes.button}
      >
        <Fragment key={playing ? "pause" : "play"}>{playing ? icons.pause : icons.play}</Fragment>
      </button>
    </>
  );
}
