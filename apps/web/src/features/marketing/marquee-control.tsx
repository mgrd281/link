"use client";

import { Icon } from "@linkyo/ui";
import { Pause, Play } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Moving content needs a pause control (WCAG 2.2.2). Hover and focus pause it as well. */
export function MarqueeControl({ children, pauseLabel, playLabel }: { children: ReactNode; pauseLabel: string; playLabel: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <div data-paused={paused} className="grid grid-cols-1 gap-6">
      {children}
      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        aria-pressed={paused}
        className="mx-auto inline-flex h-control-md items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-small font-medium text-fg-secondary transition-colors duration-micro hover:text-fg focus-visible:focus-ring motion-reduce:hidden"
      >
        <Icon icon={paused ? Play : Pause} size="sm" />
        {paused ? playLabel : pauseLabel}
      </button>
    </div>
  );
}
