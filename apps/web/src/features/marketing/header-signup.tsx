"use client";

import { cn } from "@linkyo/ui";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";

/**
 * Sign-up in the phone's header. On the homepage it waits: a visitor first reads what Linkyo is and
 * sees real pages, then meets sign-up in the hero. Only once that has scrolled away does the button
 * slide into the header, so sign-up stays in reach from there on. `after` is the id of the hero's
 * sign-up; without it (other pages) the button is simply there.
 */
export function HeaderSignup({ label, after }: { label: string; after?: string | undefined }) {
  const [shown, setShown] = useState(after === undefined);

  useEffect(() => {
    const target = after ? document.getElementById(after) : null;
    if (!target) return;
    // Measured on scroll (once per frame), not with an IntersectionObserver: that one stays silent
    // when the page jumps straight from below the block to above it, or back (a tap on the phone's
    // status bar scrolls to the top in one go).
    let frame = 0;
    const measure = () => {
      frame = 0;
      const edge = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      // Shown once the hero's sign-up has gone up under the header; hidden while it is in view or below.
      setShown(target.getBoundingClientRect().bottom < edge);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [after]);

  return (
    <Link
      href="/signup"
      data-header-signup
      data-shown={shown || undefined}
      className={cn(
        "inline-flex h-control-sm items-center rounded-full bg-primary px-3 text-small font-semibold text-primary-fg transition-[background-color,opacity,scale,visibility] duration-standard ease-standard hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed motion-reduce:transition-none md:hidden",
        shown ? "visible opacity-100" : "invisible scale-pressed opacity-0",
      )}
    >
      {label}
    </Link>
  );
}
