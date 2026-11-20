"use client";

import { tokens } from "@linkyo/tokens";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A number that counts up once, the first time it scrolls into view (sample figures on the
 * analytics card). The final number is in the page from the start (server rendering, screen
 * readers, reduced motion); only the visible digits run.
 */
export function CountUp({ value, percent = false }: { value: number; percent?: boolean }) {
  const locale = useLocale();
  const format = useMemo(() => new Intl.NumberFormat(locale, percent ? { style: "percent" } : undefined), [locale, percent]);
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen when the page loads: leave the number as it is.
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    let frame = requestAnimationFrame(() => {
      setShown(0);
    });
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = tokens.motion.duration.reveal;
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - progress) ** 3;
          setShown(percent ? Math.round(value * eased * 100) / 100 : Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value, percent]);

  return (
    <span ref={ref}>
      <span aria-hidden>{format.format(shown)}</span>
      <span className="sr-only">{format.format(value)}</span>
    </span>
  );
}
