"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A row that scrolls sideways on phones and may fit whole on wider screens (Leuchttisch's strip): a
 * named region that takes focus (so a keyboard can scroll it) only while it really scrolls. Until it
 * is measured, and without script, it is one: phones, where it scrolls, keep working. Once measured,
 * a row that fits is a plain box, so a keyboard meets no stop that does nothing and a screen reader
 * hears of no "scrollable row" that is not there. The element that scrolls is marked
 * `data-scroll-track` (else the box itself).
 */
export function ScrollRegion({ label, className, children }: { label: string; className?: string | undefined; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(true);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const track = element.querySelector<HTMLElement>("[data-scroll-track]") ?? element;
    const measure = () => setScrolls(track.scrollWidth - track.clientWidth > 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className={className} {...(scrolls ? { role: "region", "aria-label": label, tabIndex: 0 } : {})}>
      {children}
    </div>
  );
}
