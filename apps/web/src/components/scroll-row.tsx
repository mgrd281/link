"use client";

import { cn, IconButton } from "@linkyo/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * One row of chips that scrolls sideways when it does not fit. An edge that hides more fades out,
 * and on larger screens an arrow there pages along (a mouse cannot swipe). Mirrored in Arabic.
 * `fade` is the color of what the row sits on ("from-canvas", "from-surface-elevated").
 */
export function ScrollRow({
  label,
  labels,
  fade,
  className,
  children,
}: {
  /** What the group of chips is for (its accessible name). */
  label: string;
  labels: { back: string; next: string };
  fade: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    // Scroll offsets are negative in right-to-left layouts; the distance from the start is what counts.
    const measure = () => {
      const offset = Math.abs(element.scrollLeft);
      setEdges({ start: offset < 2, end: offset + element.clientWidth >= element.scrollWidth - 2 });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, []);

  const page = (direction: 1 | -1) => {
    const element = scroller.current;
    if (!element) return;
    const rtl = getComputedStyle(element).direction === "rtl";
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    element.scrollBy({ left: direction * (rtl ? -1 : 1) * element.clientWidth * 0.7, behavior });
  };

  const edge = cn("pointer-events-none absolute inset-y-0 flex items-center from-50% to-transparent", fade);
  return (
    <div className={cn("relative min-w-0", className)}>
      <div ref={scroller} role="group" aria-label={label} className="flex scroll-px-10 gap-2 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none] md:scroll-px-20">
        {children}
      </div>
      {edges.start ? null : (
        <div className={cn(edge, "start-0 bg-linear-to-r pe-8 rtl:bg-linear-to-l")}>
          <IconButton icon={ChevronLeft} label={labels.back} size="sm" variant="secondary" onClick={() => page(-1)} className="pointer-events-auto max-md:hidden rtl:-scale-x-100" />
        </div>
      )}
      {edges.end ? null : (
        <div className={cn(edge, "end-0 bg-linear-to-l ps-8 rtl:bg-linear-to-r")}>
          <IconButton icon={ChevronRight} label={labels.next} size="sm" variant="secondary" onClick={() => page(1)} className="pointer-events-auto max-md:hidden rtl:-scale-x-100" />
        </div>
      )}
    </div>
  );
}
