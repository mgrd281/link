"use client";

import { cn, IconButton } from "@linkyo/ui";
import { Pause, Play } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Moving content that plays on its own needs a way to stop it (WCAG 2.2.2). Hover stops it too
 * (`data-marquee`), reduced motion never starts it.
 */
export function MotionToggle({
  children,
  pauseLabel,
  playLabel,
  className,
  buttonClassName,
}: {
  children: ReactNode;
  pauseLabel: string;
  playLabel: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <div data-paused={paused} data-marquee className={cn("relative", className)}>
      {children}
      <IconButton
        icon={paused ? Play : Pause}
        label={paused ? playLabel : pauseLabel}
        variant="secondary"
        size="sm"
        onClick={() => setPaused((value) => !value)}
        className={cn("absolute motion-reduce:hidden", buttonClassName)}
      />
    </div>
  );
}
