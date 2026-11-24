"use client";

import { cn, Icon } from "@linkyo/ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { arrowStep, clampIndex, slideAt, type ViewerOpening } from "./picture-viewer";

/** Marks the history entry the viewer adds, so the back gesture closes it instead of leaving the page. */
const HISTORY_KEY = "linkyoPictureViewer";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isRtl = (element: Element) => getComputedStyle(element).direction === "rtl";

/** A round control: the border CLAUDE.md asks for on secondary buttons, a fill step on hover. */
const ROUND =
  "grid size-control-lg shrink-0 place-items-center rounded-full border border-creator-line-strong bg-creator-bg text-creator-fg transition-colors duration-micro hover:bg-creator-surface focus-visible:focus-ring aria-disabled:cursor-default aria-disabled:opacity-secondary aria-disabled:hover:bg-creator-bg";

/**
 * The project page's picture viewer (WP8, plan §1.5.7), loaded on the first press of a picture.
 *
 * A native `<dialog>` opened as a modal (the page behind is inert, focus stays inside), filling the
 * screen on the page's own ground. The pictures sit side by side in a track that snaps: a swipe on a
 * phone moves one picture, pinch zoom is the browser's. Close, previous and next are round buttons;
 * a visible counter, and a polite live region that says "Picture 3 of 11" when it changes. Arrow keys
 * follow what the visitor sees (in Arabic the left arrow goes on), Home and End jump to the ends,
 * Escape closes. Opening adds one history entry, so the phone's back gesture closes the viewer and
 * stays on the page. Focus starts on Close and goes back to the picture that opened it, without the
 * page moving. It fades in (`duration-standard`), at once with reduced motion.
 */
export function PictureViewerDialog({ pictures, start, opener, onClosed }: ViewerOpening & { onClosed: () => void }) {
  const t = useTranslations("creator.portfolio");
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const done = useRef(false);
  const [token] = useState(() => `${String(Date.now())}-${Math.random().toString(36).slice(2)}`);
  const total = pictures.length;
  const [index, setIndex] = useState(() => clampIndex(start, total));

  // Closing happens here once, however it was asked for (button, Escape, back gesture).
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    if (dialog.current?.open) dialog.current.close();
    opener.focus({ preventScroll: true });
    onClosed();
  }, [opener, onClosed]);

  // Button and Escape step back through history when the viewer's entry is the current one; the
  // popstate that follows closes it, exactly as the back gesture does.
  const requestClose = useCallback(() => {
    const state: unknown = window.history.state;
    if (state && typeof state === "object" && (state as Record<string, unknown>)[HISTORY_KEY] === token) window.history.back();
    else finish();
  }, [finish, token]);

  // The picture the viewer is heading for: a second press while the track still glides goes one
  // further, not to the same picture again. A swipe sets it when the track comes to rest.
  const aim = useRef(clampIndex(start, total));

  /** Moves `by` pictures from the one the viewer is heading for, or `to` one. */
  const go = (move: { by: number } | { to: number }) => {
    const strip = track.current;
    const target = clampIndex("to" in move ? move.to : aim.current + move.by, total);
    const slide = strip?.children[target];
    if (!strip || !slide) return;
    aim.current = target;
    // To a position, not by an amount: a relative scroll would stop at every picture on the way
    // (each slide is `snap-always`, so a swipe never skips one), and Home and End must jump.
    const delta = slide.getBoundingClientRect().left - strip.getBoundingClientRect().left;
    strip.scrollTo({ left: strip.scrollLeft + delta, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  // Opened once per mount (the island mounts the viewer anew for every opening, with the same
  // pictures throughout), and everything is in place before the first paint: the modal, the tapped
  // picture, focus on Close, the history entry, and the keys, the counter and the back gesture.
  useLayoutEffect(() => {
    const element = dialog.current;
    const strip = track.current;
    if (!element || !strip) return;
    if (!element.open) element.showModal();
    // On the tapped picture: no slide across the others.
    strip.scrollLeft = (isRtl(strip) ? -1 : 1) * clampIndex(start, total) * strip.clientWidth;
    close.current?.focus({ preventScroll: true });
    window.history.pushState({ [HISTORY_KEY]: token }, "");

    const onPop = () => {
      const state: unknown = window.history.state;
      if (!(state && typeof state === "object" && (state as Record<string, unknown>)[HISTORY_KEY] === token)) finish();
    };
    // Keys anywhere in the viewer (on Close, on the track, on a button): arrows, Home and End.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const step = arrowStep(event.key, isRtl(element));
      const move = step !== 0 ? { by: step } : event.key === "Home" ? { to: 0 } : event.key === "End" ? { to: total - 1 } : null;
      if (!move) return;
      event.preventDefault();
      go(move);
    };
    // The counter follows the track, however it was moved (swipe, wheel, buttons, keys).
    let frame = 0;
    const shown = () => slideAt(strip.scrollLeft, strip.clientWidth, total);
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setIndex(shown()));
    };
    const onScrollEnd = () => {
      aim.current = shown();
    };
    window.addEventListener("popstate", onPop);
    element.addEventListener("keydown", onKeyDown);
    strip.addEventListener("scroll", onScroll, { passive: true });
    strip.addEventListener("scrollend", onScrollEnd);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", onPop);
      element.removeEventListener("keydown", onKeyDown);
      strip.removeEventListener("scroll", onScroll);
      strip.removeEventListener("scrollend", onScrollEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening (see above)
  }, []);

  const first = index <= 0;
  const last = index >= total - 1;
  const caption = pictures[index]?.caption ?? "";
  const position = t("pictureOf", { n: index + 1, total });

  return (
    <dialog
      ref={dialog}
      data-picture-viewer
      aria-label={t("viewer")}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={finish}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden bg-creator-bg p-0 font-creator-body text-creator-fg opacity-100 transition-opacity duration-standard ease-standard backdrop:bg-creator-bg starting:open:opacity-0 motion-reduce:transition-none"
    >
      {/* The page behind does not scroll while the viewer is open. */}
      <style>{"html:has(dialog[data-picture-viewer][open]){overflow:hidden}"}</style>
      <div className="grid size-full grid-rows-[auto_minmax(0,1fr)_auto]">
        <div className="flex h-16 items-center justify-between gap-4 px-creator-gutter">
          <p aria-hidden data-viewer-counter className="text-small font-semibold tabular-nums">
            <bdi dir="ltr">{`${String(index + 1)} / ${String(total)}`}</bdi>
          </p>
          <button ref={close} type="button" onClick={requestClose} aria-label={t("closeViewer")} className={ROUND}>
            <Icon icon={X} size="md" />
          </button>
        </div>
        <div
          ref={track}
          data-viewer-track
          role="region"
          aria-label={t("viewer")}
          tabIndex={0}
          className="flex min-h-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:focus-field [&::-webkit-scrollbar]:hidden"
        >
          {pictures.map((picture, at) => (
            <div key={`${picture.href}-${String(at)}`} role="group" aria-label={t("pictureOf", { n: at + 1, total })} className="h-full w-full shrink-0 snap-center snap-always px-2 sm:px-6 md:px-24">
              <div className="relative size-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- the page's own optimizer candidates, already resolved for this picture */}
                <img
                  src={picture.href}
                  srcSet={picture.srcSet || undefined}
                  sizes="100vw"
                  alt={picture.alt}
                  loading={Math.abs(at - start) <= 1 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 size-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex min-h-20 items-center gap-3 px-creator-gutter py-3">
          <button type="button" onClick={() => go({ by: -1 })} aria-label={t("previousPicture")} aria-disabled={first || undefined} className={cn(ROUND, "md:absolute md:start-6 md:top-1/2 md:-translate-y-1/2")}>
            <Icon icon={ChevronLeft} size="md" className="rtl:-scale-x-100" />
          </button>
          <p dir="auto" data-viewer-caption className="line-clamp-2 min-w-0 flex-1 text-center text-small text-pretty text-creator-fg-muted">
            {caption}
          </p>
          <button type="button" onClick={() => go({ by: 1 })} aria-label={t("nextPicture")} aria-disabled={last || undefined} className={cn(ROUND, "md:absolute md:end-6 md:top-1/2 md:-translate-y-1/2")}>
            <Icon icon={ChevronRight} size="md" className="rtl:-scale-x-100" />
          </button>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {position}
      </p>
    </dialog>
  );
}
