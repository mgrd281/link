"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cx } from "./cx";
import { pastHero } from "./dock-state";
import { useInGalleryPreview } from "./privacy";

const CLOSED = "linkyo.dock.closed";

/** True once the hero has mostly scrolled away (the page's own name is then out of sight). */
function usePastHero(): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const sentinel = document.querySelector("[data-poster-sentinel]");
    if (!sentinel) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      setPast(pastHero(sentinel.getBoundingClientRect().top, window.innerHeight, window.scrollY));
    };
    const onScroll = () => {
      frame ||= window.requestAnimationFrame(check);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return past;
}

const wasClosed = () => {
  try {
    return window.sessionStorage.getItem(CLOSED) === "1";
  } catch {
    return false;
  }
};

/** What the bar draws where the page is rendered (`./dock.tsx`): the logo, the button's arrow and the close icon. */
export interface DockParts {
  logo: ReactNode;
  arrow: ReactNode;
  close: ReactNode;
}

/**
 * The Linkyo bar on creator pages: slides up once visitors scroll past the hero, so it never covers
 * the creator's name or photo, and can be closed (for the rest of the visit). Linkyo's own look
 * (dark, teal), clearly apart from the creator's design. Works in every browser: no scroll-driven
 * CSS needed. The call to action is a plain link (a full page load to sign-up is fine, and the page
 * carries no router link code for it).
 */
export function LinkyoDockIsland({ title, cta, href, closeLabel, parts }: { title: string; cta: string; href: string; closeLabel: string; parts: DockParts }) {
  const past = usePastHero();
  // Hidden until scrolled either way, so the server and the first client render agree.
  const [closed, setClosed] = useState(() => typeof window !== "undefined" && wasClosed());
  // In the templates gallery's preview the panel beside the page already offers "Use this template".
  const previewed = useInGalleryPreview();
  const shown = past && !closed && !previewed;

  const close = () => {
    setClosed(true);
    try {
      window.sessionStorage.setItem(CLOSED, "1");
    } catch {
      // Without storage it stays closed for this page view.
    }
  };

  return (
    <div
      data-theme="dark"
      data-shown={shown ? "" : undefined}
      aria-hidden={!shown}
      inert={!shown}
      className={cx(
        "layer-sticky fixed inset-x-0 bottom-0 px-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))] font-sans",
        "transition-[translate,opacity] duration-standard ease-standard motion-reduce:transition-opacity",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 motion-reduce:translate-y-0",
      )}
    >
      <div className="mx-auto flex max-w-creator items-center gap-2 rounded-full border border-line bg-surface p-1 ps-4 text-fg">
        {parts.logo}
        {/* Phones: logo, button, close. The line of text joins on wider screens, where it fits. */}
        <span className="min-w-0 flex-1 truncate text-small text-fg-secondary max-sm:invisible">{title}</span>
        {/* Both are 40 px to the eye and 44 px targets on a touch screen (an invisible 2 px around them, as IconButton does). */}
        <a
          href={href}
          className="relative inline-flex h-control-md shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-small font-semibold text-primary-fg transition-colors duration-micro before:absolute before:inset-0 pointer-coarse:before:-inset-0.5 hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
        >
          {cta}
          {parts.arrow}
        </a>
        <button
          type="button"
          onClick={close}
          aria-label={closeLabel}
          className="relative grid size-control-md shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-micro before:absolute before:inset-0 pointer-coarse:before:-inset-0.5 hover:bg-hover hover:text-fg focus-visible:focus-ring"
        >
          {parts.close}
        </button>
      </div>
    </div>
  );
}
