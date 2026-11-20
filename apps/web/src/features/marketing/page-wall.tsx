import { cn } from "@linkyo/ui";
import Image from "next/image";

import { EXAMPLE_SHOTS, WALL } from "./examples";

const SHOTS = WALL.map((slug) => EXAMPLE_SHOTS[slug]);
const COLUMNS = 6;
/** Pages per column: tall enough to fill a tilted panel (the wall is half again as large as its frame). */
const PER_COLUMN = 4;

/**
 * A tilted wall of example pages made with Linkyo (real captures of their first screen). Decorative
 * (hidden from screen readers; the same pages are named in the gallery). The sign-in and sign-up
 * screens let its columns drift past each other once, then rest (`moving`, mk-marquee-y: holds under
 * the mouse and while the keyboard moves through the page, still with reduced motion, WCAG 2.2.2).
 * The templates page shows the same wall standing still, on phones as a band of smaller cards.
 */
export function PageWall({
  moving = false,
  eager = false,
  sizes = "(min-width: 64rem) 13vw, 25vw",
  className,
}: {
  moving?: boolean;
  /**
   * The wall is the first thing on screen (templates page): its top rows load at once, the first
   * three at high priority, and on phones and tablets the rows the band never shows are not rendered
   * (so never downloaded).
   */
  eager?: boolean;
  sizes?: string;
  className?: string;
}) {
  // Column c steps through the pages five at a time from c on (18 pages: five and 18 share no
  // factor, so no page repeats within a column and neighbours differ).
  const columns = Array.from({ length: COLUMNS }, (_, column) =>
    Array.from({ length: PER_COLUMN }, (_, row) => SHOTS[(column + row * 5) % SHOTS.length]).filter((shot) => shot !== undefined),
  );
  return (
    <div aria-hidden className={cn("relative isolate overflow-hidden bg-canvas-muted", className)}>
      <div {...(moving ? { "data-marquee": "" } : {})} className="mk-wall absolute -inset-1/4 grid grid-cols-6 gap-2 sm:gap-3 lg:gap-5">
        {columns.map((column, index) => (
          <div key={index} className={cn(index % 2 === 1 && "-mt-16 lg:-mt-32")}>
            <ul className={cn("grid content-start gap-2 pb-2 sm:gap-3 sm:pb-3 lg:gap-5 lg:pb-5", moving && "mk-marquee-y", moving && index % 2 === 1 && "mk-marquee-reverse")}>
              {(moving ? [...column, ...column] : column).map((shot, position) => (
                <li
                  key={position}
                  className={cn("overflow-hidden rounded-md border border-line bg-surface lg:rounded-lg", eager && !moving && position > 1 && "max-lg:hidden")}
                >
                  <div className="relative aspect-phone">
                    <Image
                      src={shot}
                      alt=""
                      fill
                      sizes={sizes}
                      placeholder="blur"
                      {...(eager && position < 2 ? { loading: "eager" as const } : {})}
                      {...(eager && position === 0 && index < 3 ? { fetchPriority: "high" as const } : {})}
                      className="object-cover object-top"
                    />
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
