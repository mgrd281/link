"use client";

import { cn } from "@linkyo/ui";
import { useRef, type PointerEvent, type ReactNode } from "react";

/**
 * The hero phones lean toward the mouse (desktop only, never on touch). CSS does the motion
 * (`mk-tilt`, eased, off for reduced motion); this only writes two numbers between -1 and 1.
 */
export function TiltStage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (x: number, y: number) => {
    ref.current?.style.setProperty("--tilt-x", x.toFixed(3));
    ref.current?.style.setProperty("--tilt-y", y.toFixed(3));
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    set(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1);
  };
  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={() => set(0, 0)} className={cn("mk-tilt", className)}>
      {children}
    </div>
  );
}
