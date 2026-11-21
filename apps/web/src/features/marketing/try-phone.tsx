"use client";

import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { BatteryFull, CircleCheck, Lock, SignalHigh, Wifi } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { themeStyle } from "@/features/creator/theme";
import { PosterRenderer } from "@/features/directions/poster/renderer";

import { buildTryPage, type TryPageInput } from "./try-page";

/**
 * Where the phone should scroll to after a change: the top for the name and photo (the page's photo
 * softens as it scrolls away, so it is shown unscrolled) or the newest block.
 */
export interface Reveal {
  to: "top" | "end";
  /** Changes with every request, so the same place can be asked for twice. */
  at: number;
}

/**
 * A phone showing a page exactly as its visitors will see it: the real page renderer at a real
 * phone's width (390 px, the "preview" layout token), scaled down to fit the frame, under a status
 * bar and the browser's address bar. Links and players stay inert in a preview.
 *
 * It never takes the website's scroll: the wheel, a trackpad and a finger over the phone scroll the
 * website, as anywhere else on it (a second scroll area in the middle of the page would catch them).
 * The page in the phone scrolls by itself to each change, so the visitor sees what they just did; it
 * can also be dragged with a mouse, like a phone, and scrolled with the keys once it has focus.
 *
 * It builds the page and resolves the look itself: this module (with the renderer, the picture
 * catalogue and the theme engine) loads only when the playground comes near (see Playground).
 */
export function TryPhone({
  input,
  config,
  rtl,
  label,
  reveal,
  toast,
  crop = false,
  className,
}: {
  input: TryPageInput;
  config: CreatorThemeConfig;
  rtl: boolean;
  label: string;
  reveal: Reveal;
  /** A short message dropping in over the page, like a phone's notification ("Your page is live"). */
  toast?: string | null;
  /** Below lg: the phone rises from the stage's lower edge, its screen cut off there (see mk-play-crop). */
  crop?: boolean;
  className?: string;
}) {
  const screen = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const page = useMemo(() => buildTryPage(input), [input]);
  const theme = useMemo(() => resolveCreatorTheme(config, { rtlScript: rtl }), [config, rtl]);

  // Fit the 390 px wide screen into whatever width the frame has.
  useEffect(() => {
    const element = screen.current;
    const content = inner.current;
    if (!element || !content) return;
    const measure = () => {
      if (content.offsetWidth > 0) setScale(element.clientWidth / content.offsetWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (!element || reveal.at === 0) return;
    const frame = requestAnimationFrame(() => {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollTo({ top: reveal.to === "top" ? 0 : element.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [reveal]);

  // The page in the phone scrolls when asked: dragged with a mouse (it moves under the pointer; the
  // page is scaled, the pointer is not) and with the keys a scrolling page answers to.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const ratio = scale ?? 1;
    let drag: { y: number; top: number } | null = null;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      drag = { y: event.clientY, top: element.scrollTop };
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (drag) element.scrollTop = drag.top - (event.clientY - drag.y) / ratio;
    };
    const up = () => {
      drag = null;
    };
    const key = (event: KeyboardEvent) => {
      const screenful = element.clientHeight * 0.85;
      const step: Record<string, number> = {
        ArrowDown: element.clientHeight / 8,
        ArrowUp: -element.clientHeight / 8,
        PageDown: screenful,
        PageUp: -screenful,
        " ": event.shiftKey ? -screenful : screenful,
      };
      const by = step[event.key];
      if (event.key === "Home") element.scrollTo({ top: 0 });
      else if (event.key === "End") element.scrollTo({ top: element.scrollHeight });
      else if (by !== undefined) element.scrollBy({ top: by });
      else return;
      event.preventDefault();
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("keydown", key);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("keydown", key);
    };
  }, [scale]);

  const address = `linkyo.app/${page.profile.username}`;
  return (
    <div className={cn("relative rounded-xl border border-teal-700 bg-ink p-2", crop && "max-lg:h-full max-lg:rounded-b-none max-lg:border-b-0 max-lg:pb-0", className)}>
      <div
        ref={screen}
        data-try-preview
        className={cn("relative aspect-phone overflow-hidden rounded-lg bg-creator-bg", crop && "max-lg:aspect-auto max-lg:h-full max-lg:rounded-b-none")}
        style={themeStyle(theme)}
      >
        <div
          ref={inner}
          className={cn(
            "absolute start-0 top-0 flex w-preview origin-top-left flex-col bg-creator-bg text-creator-fg transition-colors duration-slow ease-standard motion-reduce:transition-none rtl:origin-top-right",
            scale === null && "invisible",
          )}
          style={scale === null ? undefined : { scale, height: `${100 / scale}%` }}
        >
          {/* The phone's own top: the time, the island, signal and battery. Always left to right, like a phone. */}
          <div aria-hidden dir="ltr" className="relative flex h-12 shrink-0 items-center justify-between px-8 font-sans text-small font-semibold">
            <span className="tabular-nums">9:41</span>
            <span className="absolute top-3 left-1/2 h-8 w-32 -translate-x-1/2 rounded-full bg-ink" />
            <span className="flex items-center gap-1">
              <Icon icon={SignalHigh} size="sm" />
              <Icon icon={Wifi} size="sm" />
              <Icon icon={BatteryFull} size="md" />
            </span>
          </div>
          {/* The browser's address bar, with the page's address. */}
          <div aria-hidden className="shrink-0 px-4 pb-2">
            <p dir="ltr" className="flex h-control-md items-center justify-center gap-2 rounded-full bg-creator-surface-2 px-4 font-sans text-small text-creator-fg-muted">
              <Icon icon={Lock} size="sm" className="shrink-0" />
              <span className="truncate">{address}</span>
            </p>
          </div>
          <div
            ref={scroller}
            role="region"
            aria-label={label}
            tabIndex={0}
            className="relative min-h-0 flex-1 cursor-grab overflow-hidden focus-visible:focus-ring active:cursor-grabbing"
          >
            {/* The page itself: seen, scrolled, never clicked (and not read twice: the controls say what it holds). */}
            <div inert aria-hidden className="min-h-full">
              <PosterRenderer page={page} theme={theme} preview />
            </div>
          </div>
          {toast ? (
            <p
              key={toast}
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-24 flex items-center justify-center gap-2 rounded-full bg-creator-accent px-4 py-3 font-sans text-small font-semibold text-creator-accent-fg motion-safe:animate-pop-in"
            >
              <Icon icon={CircleCheck} size="sm" className="shrink-0" />
              <span className="truncate">{toast}</span>
            </p>
          ) : null}
          <span aria-hidden className={cn("pointer-events-none absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-creator-fg opacity-secondary", crop && "max-lg:hidden")} />
        </div>
      </div>
    </div>
  );
}
