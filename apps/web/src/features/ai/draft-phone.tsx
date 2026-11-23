"use client";

import type { Page } from "@linkyo/blocks";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cn } from "@linkyo/ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PhoneFrame } from "@/features/app/preview";
import { themeStyle } from "@/features/creator/theme";
import { PosterRenderer } from "@/features/directions/poster/renderer";

/**
 * The draft's two columns: the phone at the top on phones; from lg the words on the start side and the
 * phone beside them (sticky under the header, `top`: under the header and the status strip while a
 * run works, under the header alone in the review).
 */
export function DraftColumns({ phone, children, top = "run", className }: { phone: ReactNode; children: ReactNode; top?: "run" | "review"; className?: string | undefined }) {
  return (
    <div className={cn("mx-auto grid w-full max-w-content grid-cols-1 gap-6 px-4 pt-4 md:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 lg:pt-6", className)}>
      <div
        data-draft-column
        className={cn(
          "grid min-w-0 justify-items-center gap-3 lg:sticky lg:order-last lg:self-start",
          top === "run" ? "lg:top-[calc(var(--spacing-16)+var(--spacing-20))]" : "lg:top-20",
        )}
      >
        {phone}
      </div>
      <div className="grid min-w-0 grid-cols-1 content-start gap-6 lg:max-w-prose">{children}</div>
    </div>
  );
}

/** The phone's height on phones: smaller while a run works (the steps peek below it), half the screen in the review; from lg, what the window leaves beside the words. */
export const DRAFT_PHONE_HEIGHT = {
  run: "h-[40dvh] lg:h-[calc(100dvh-var(--spacing-32)-var(--spacing-32)-var(--spacing-12))]",
  review: "h-[50dvh] lg:h-[calc(100dvh-var(--spacing-32)-var(--spacing-12))]",
} as const;

/** The quiet chip above the phone, outside the page ("Draft · made with AI"). */
export function DraftChip({ children }: { children: ReactNode }) {
  return <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-fg-secondary">{children}</p>;
}

/** How far down an element sits inside a scroller's content (layout positions, so the scale does not count). */
function offsetWithin(element: HTMLElement, scroller: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== scroller && scroller.contains(node)) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return top;
}

/** The page in the phone: 390 px wide, scaled from its top start corner to the frame's width. */
const SCROLLER = "absolute start-0 top-0 w-preview origin-top-left cursor-grab active:cursor-grabbing rtl:origin-top-right";

/**
 * The draft on a phone, drawn by the real page renderer at a real phone's width (390 px) and scaled
 * to the frame. The only place with colour on the build screen: the creator's own page. While the
 * run streams, the page re-themes when the look arrives (`transition-colors`), each block rises in as
 * it arrives and the phone follows the newest one.
 *
 * It is a picture, not a second app: the page inside is inert and hidden from screen readers (the
 * review's block list says the same in words). While a run works the phone moves by itself and is
 * no tab stop; a mouse can still drag or wheel through it. With `scrollable` (the review, where the
 * owner checks the draft before using it) the page in the phone scrolls like any page: by touch, by
 * wheel, and with the keyboard once the phone has focus (a ring inside the screen's edge shows it).
 * At the draft's top and bottom the screen around it scrolls on, so a thumb is never stuck in it.
 */
export function DraftPhone({
  page,
  theme,
  label,
  busy,
  followId = null,
  scrollable = false,
  className,
}: {
  page: Page;
  theme: CreatorThemeConfig;
  /** The phone's accessible name (`ai.run.phone`). */
  label: string;
  /** The draft is still being written (`aria-busy`, blocks rise in). */
  busy: boolean;
  /** The newest block: the phone scrolls to it when it changes. */
  followId?: string | null;
  /** The owner scrolls the page in the phone themselves (touch, wheel, keyboard): the phone is a tab stop. */
  scrollable?: boolean;
  className?: string | undefined;
}) {
  const rtl = page.profile.locale === "ar";
  const resolved = useMemo(() => resolveCreatorTheme(theme, { rtlScript: rtl }), [theme, rtl]);
  const screen = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  // Fit the 390 px wide page into whatever width the frame has.
  useEffect(() => {
    const element = screen.current;
    const content = scroller.current;
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

  // Follow the newest block, so what just arrived is in view.
  useEffect(() => {
    const box = scroller.current;
    if (!box || !followId) return;
    const frame = requestAnimationFrame(() => {
      const element = box.querySelector<HTMLElement>(`[data-block-ids~="${CSS.escape(followId)}"]`);
      if (!element) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: Math.max(0, offsetWithin(element, box) - box.clientHeight / 3), behavior: reduced ? "auto" : "smooth" });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [followId, page]);

  // A mouse drags or wheels the page in the phone (it moves under the pointer; the page is scaled,
  // the pointer is not). Touch and the keyboard scroll it natively where it is `scrollable`.
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
    const wheel = (event: WheelEvent) => {
      const before = element.scrollTop;
      element.scrollTop += event.deltaY / ratio;
      // Only when the page in the phone moved: at its ends the screen scrolls on as usual.
      if (element.scrollTop !== before) event.preventDefault();
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("wheel", wheel);
    };
  }, [scale]);

  const fit = scale === null ? undefined : { scale, height: `${100 / scale}%` };
  const content = (
    // A grid, so the page fills the phone even while it is short (its own background, no gap below).
    <div inert aria-hidden className="grid min-h-full">
      <PosterRenderer page={page} theme={resolved} preview />
    </div>
  );

  return (
    // The name sits on what takes focus: the scroller where the phone scrolls, else the phone as a whole.
    <div role={scrollable ? undefined : "region"} aria-label={scrollable ? undefined : label} aria-busy={scrollable ? undefined : busy} data-draft-phone className={cn("min-h-0", className)}>
      <PhoneFrame className="aspect-phone h-full w-auto max-w-full">
        <div
          ref={screen}
          className="absolute inset-0 bg-creator-bg text-creator-fg transition-colors duration-slow ease-standard motion-reduce:transition-none"
          style={themeStyle(resolved)}
        >
          {scrollable ? (
            <div ref={scroller} role="region" aria-label={label} aria-busy={busy} tabIndex={0} data-draft-scroller className={cn(SCROLLER, "peer overflow-y-auto focus-visible:outline-none", scale === null && "invisible")} style={fit}>
              {content}
            </div>
          ) : (
            <div ref={scroller} className={cn(SCROLLER, "overflow-hidden", scale === null && "invisible", busy && "motion-safe:[&_[data-block-ids]]:animate-rise-in")} style={fit}>
              {content}
            </div>
          )}
          {/* Keyboard focus on the page in the phone: a ring inside the screen's edge, over the page,
              in the page's own accent (which the theme engine keeps readable on its background). */}
          {scrollable ? (
            <span aria-hidden data-draft-focus className="pointer-events-none absolute inset-0 hidden rounded-lg [--color-focus:var(--creator-accent-text)] focus-field peer-focus-visible:block" />
          ) : null}
        </div>
      </PhoneFrame>
    </div>
  );
}
