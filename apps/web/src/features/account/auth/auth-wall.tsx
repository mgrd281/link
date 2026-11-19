"use client";

import { cn } from "@linkyo/ui";
import Image from "next/image";

import { EXAMPLE_SHOTS, WALL } from "@/features/marketing/examples";

const SHOTS = WALL.map((slug) => EXAMPLE_SHOTS[slug]);
const COLUMNS = 6;
/** Pages per column (before the copy that makes the loop seamless): tall enough to fill the panel. */
const PER_COLUMN = 4;

/**
 * Beside the sign-up and sign-in forms: a tilted wall of example pages made with Linkyo, its columns
 * drifting past each other. Decorative (hidden from screen readers). No pause button: the wall makes
 * one slow pass and rests, holds under the mouse and while the keyboard moves through the page, and
 * stays still with reduced motion (mk-marquee-y, WCAG 2.2.2).
 */
export function AuthWall() {
  // Column c steps through the pages five at a time from c on (18 pages: five and 18 share no
  // factor, so no page repeats within a column and neighbours differ).
  const columns = Array.from({ length: COLUMNS }, (_, column) =>
    Array.from({ length: PER_COLUMN }, (_, row) => SHOTS[(column + row * 5) % SHOTS.length]).filter((shot) => shot !== undefined),
  );
  return (
    <div aria-hidden className="relative isolate hidden overflow-hidden bg-canvas-muted lg:block">
      <div data-marquee className="mk-wall absolute -inset-1/4 grid grid-cols-6 gap-5">
        {columns.map((column, index) => (
          <div key={index} className={cn(index % 2 === 1 && "-mt-32")}>
            <ul className={cn("mk-marquee-y grid content-start gap-5 pb-5", index % 2 === 1 && "mk-marquee-reverse")}>
              {[...column, ...column].map((shot, position) => (
                <li key={position} className="overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="relative aspect-phone">
                    <Image src={shot} alt="" fill sizes="13vw" placeholder="blur" className="object-cover object-top" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
