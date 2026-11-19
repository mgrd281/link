"use client";

import { cn, IconButton } from "@linkyo/ui";
import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EXAMPLE_SHOTS } from "@/features/marketing/examples";

const SHOTS = Object.values(EXAMPLE_SHOTS);
const COLUMNS = 6;
/** Pages per column (before the copy that makes the loop seamless): tall enough to fill the panel. */
const PER_COLUMN = 4;

/**
 * Beside the sign-up and sign-in forms: a tilted wall of example pages made with Linkyo, its columns
 * drifting past each other. Decorative (hidden from screen readers); hover or the button stops it
 * (WCAG 2.2.2), reduced motion keeps it still.
 */
export function AuthWall() {
  const t = useTranslations("auth.side");
  const [paused, setPaused] = useState(false);
  // Column c takes every sixth page from c on (wrapping), so neighbours never show the same page.
  const columns = Array.from({ length: COLUMNS }, (_, column) =>
    Array.from({ length: PER_COLUMN }, (_, row) => SHOTS[(column + row * COLUMNS) % SHOTS.length] ?? SHOTS[0]).filter((shot) => shot !== undefined),
  );
  return (
    <aside aria-label={t("label")} data-paused={paused} className="relative isolate hidden overflow-hidden bg-canvas-muted lg:block">
      <div aria-hidden data-marquee className="mk-wall absolute -inset-1/4 grid grid-cols-6 gap-5">
        {columns.map((column, index) => (
          <div key={index} className={cn(index % 2 === 1 && "-mt-32")}>
            <ul className={cn("mk-marquee-y grid content-start gap-5 pb-5", index % 2 === 1 && "mk-marquee-reverse")}>
              {[...column, ...column].map((shot, position) => (
                <li key={position} className="overflow-hidden rounded-lg bg-surface shadow-e2">
                  <div className="relative aspect-phone">
                    <Image src={shot} alt="" fill sizes="13vw" placeholder="blur" className="object-cover object-top" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <IconButton
        icon={paused ? Play : Pause}
        label={paused ? t("play") : t("pause")}
        variant="secondary"
        size="sm"
        onClick={() => {
          setPaused((value) => !value);
        }}
        className="absolute end-4 bottom-4 rounded-full motion-reduce:hidden"
      />
    </aside>
  );
}
