"use client";

import { cn, Icon, Logo } from "@linkyo/ui";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";

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
      setPast(sentinel.getBoundingClientRect().top < window.innerHeight * 0.45);
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

/**
 * The Linkyo bar on creator pages: slides up once visitors scroll past the hero, so it never covers
 * the creator's name or photo, and can be closed (for the rest of the visit). Linkyo's own look
 * (dark, violet), clearly apart from the creator's design. Works in every browser: no scroll-driven
 * CSS needed.
 */
export function LinkyoDock({ title, cta, href, closeLabel }: { title: string; cta: string; href: string; closeLabel: string }) {
  const past = usePastHero();
  // Hidden until scrolled either way, so the server and the first client render agree.
  const [closed, setClosed] = useState(() => typeof window !== "undefined" && wasClosed());
  const shown = past && !closed;

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
      className={cn(
        "layer-sticky fixed inset-x-0 bottom-0 px-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))] font-sans",
        "transition-[translate,opacity] duration-standard ease-standard motion-reduce:transition-opacity",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 motion-reduce:translate-y-0",
      )}
    >
      <div className="mx-auto flex max-w-creator items-center gap-2 rounded-full border border-line bg-surface p-1 ps-4 text-fg shadow-e3">
        <Logo className="h-5 shrink-0" title="Linkyo" />
        {/* Phones: logo, button, close. The line of text joins on wider screens, where it fits. */}
        <span className="min-w-0 flex-1 truncate text-small text-fg-secondary max-sm:invisible">{title}</span>
        <Link
          href={href}
          className="inline-flex h-control-md shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-small font-semibold text-primary-fg transition-colors duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
        >
          {cta}
          <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label={closeLabel}
          className="grid size-control-md shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring"
        >
          <Icon icon={X} size="sm" />
        </button>
      </div>
    </div>
  );
}
