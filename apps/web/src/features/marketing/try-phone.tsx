"use client";

import type { Page } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { BatteryFull, CircleCheck, Lock, SignalHigh, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { themeStyle } from "@/features/creator/theme";
import { PosterRenderer } from "@/features/directions/poster/renderer";

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
 * bar and the browser's address bar. The page scrolls inside (wheel, touch or the arrow keys once
 * the screen has focus) but cannot be clicked: links and players stay inert in a preview.
 *
 * After a change it scrolls to where the change is, so the visitor sees what they just did.
 */
export function TryPhone({
  page,
  theme,
  label,
  reveal,
  toast,
  className,
}: {
  page: Page;
  theme: ResolvedCreatorTheme;
  label: string;
  reveal: Reveal;
  /** A short message over the page, like the app's ("Your page is live"). */
  toast?: string | null;
  className?: string;
}) {
  const screen = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

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

  const address = `linkyo.app/${page.profile.username}`;
  return (
    <div className={cn("relative rounded-xl border border-line-strong bg-ink p-2", className)}>
      <div ref={screen} data-try-preview className="relative aspect-phone overflow-hidden rounded-lg bg-creator-bg" style={themeStyle(theme)}>
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
          <div ref={scroller} role="region" aria-label={label} tabIndex={0} className="mk-no-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:focus-ring">
            {/* The page itself: seen, scrolled, never clicked (and not read twice: the controls say what it holds). */}
            <div inert aria-hidden className="min-h-full">
              <PosterRenderer page={page} theme={theme} preview />
            </div>
          </div>
          {toast ? (
            <p
              key={toast}
              aria-hidden
              className="pointer-events-none absolute inset-x-6 bottom-10 flex items-center justify-center gap-2 rounded-full bg-creator-accent px-4 py-3 font-sans text-small font-semibold text-creator-accent-fg motion-safe:animate-pop-in"
            >
              <Icon icon={CircleCheck} size="sm" className="shrink-0" />
              <span className="truncate">{toast}</span>
            </p>
          ) : null}
          <span aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-creator-fg opacity-secondary" />
        </div>
      </div>
    </div>
  );
}
