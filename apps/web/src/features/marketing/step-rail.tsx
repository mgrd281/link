"use client";

import { cn } from "@linkyo/ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";

export interface RailStep {
  id: string;
  label: string;
}

/**
 * The four steps of the feature tour as a bar under the header, like the progress bars of stories:
 * each step's bar fills while you read that step, the current one is named in full, and a tap jumps
 * to a step. It sticks flush under the header while the tour is on screen and leaves with it.
 *
 * Progress follows the reading line (a little above the middle of the screen) once per frame while
 * scrolling. It is driven by the reader's own scrolling, so nothing moves on its own.
 */
export function StepRail({ steps, label }: { steps: RailStep[]; label: string }) {
  const [active, setActive] = useState(0);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const ids = steps.map((step) => step.id).join(" ");

  useEffect(() => {
    const targets = ids.split(" ").map((id) => document.getElementById(id));
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let current = 0;
      targets.forEach((target, index) => {
        if (!target) return;
        const box = target.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (line - box.top) / box.height));
        fills.current[index]?.style.setProperty("--p", progress.toFixed(3));
        if (box.top <= line) current = index;
      });
      setActive(current);
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
  }, [ids]);

  return (
    <nav aria-label={label} data-step-rail className="mk-stuck-band layer-raised sticky top-16 bg-canvas">
      {/* A hairline under the bar only while it is stuck, where the steps slide beneath it. */}
      <span aria-hidden className="mk-stuck-edge pointer-events-none absolute inset-x-0 bottom-0 border-b border-transparent" />
      <ol className="mx-auto grid max-w-content grid-cols-4 gap-2 px-5 py-3 md:gap-4 md:px-10">
        {steps.map((step, index) => {
          const state = index === active ? "current" : index < active ? "done" : "next";
          return (
            <li key={step.id} className="min-w-0">
              <a
                href={`#${step.id}`}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "grid gap-2 rounded-xs pt-1 text-caption font-semibold transition-colors duration-standard ease-standard focus-visible:focus-ring md:text-small",
                  state === "current" ? "text-fg" : state === "done" ? "text-fg-secondary" : "text-fg-tertiary hover:text-fg-secondary",
                )}
              >
                <span className="flex min-w-0 items-baseline gap-1">
                  <span className="tabular-nums">{index + 1}</span>
                  <span className="truncate">{step.label}</span>
                </span>
                <span aria-hidden className="relative block h-1 overflow-hidden rounded-full bg-line-strong">
                  <span
                    ref={(node) => {
                      fills.current[index] = node;
                    }}
                    style={{ "--p": 0 } as CSSProperties}
                    className="absolute inset-0 origin-left scale-x-(--p) rounded-full bg-link transition-[scale] duration-micro ease-standard rtl:origin-right motion-reduce:transition-none"
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
