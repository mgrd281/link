"use client";

import { cn } from "@linkyo/ui";
import { useTranslations } from "next-intl";

import { CardFace, type GalleryItem } from "./gallery-card";
import { CATEGORIES } from "./looks";

/**
 * Picks pages for the moving wall: one per category in turn, so the wall shows the range at a
 * glance. Pages of real people stay in the gallery only (no famous faces as advertising).
 */
export function pickShowcase(items: readonly GalleryItem[], count: number): GalleryItem[] {
  const queues = CATEGORIES.map((category) => items.filter((item) => item.category === category && !item.badge && item.photo));
  const picked: GalleryItem[] = [];
  for (let round = 0; picked.length < count && queues.some((queue) => queue.length > round); round += 1) {
    for (const queue of queues) {
      const next = queue[round];
      if (next && picked.length < count) picked.push(next);
    }
  }
  return picked;
}

/**
 * The hero's moving wall: three columns drifting past each other on large screens, a row to swipe
 * on phones. Decorative (the same pages are in the gallery below as named buttons), so it is hidden
 * from screen readers and out of the tab order; a mouse click still opens the preview. No pause
 * button: the wall makes one slow pass and rests, holds under the mouse and while the keyboard
 * moves through the page (mk-marquee-y, WCAG 2.2.2); phones get a row to swipe; reduced motion
 * keeps everything still.
 */
export function Showcase({ items, onOpen }: { items: readonly GalleryItem[]; onOpen: (item: GalleryItem) => void }) {
  const t = useTranslations("examples");
  const columns = [0, 1, 2].map((column) => items.filter((_, index) => index % 3 === column));
  const label = (item: GalleryItem) => (item.badge ? t(`badges.${item.badge}`) : t(`categories.${item.category}`));
  const card = (item: GalleryItem, key: string, className?: string) => (
    <li key={key} className={className}>
      <button type="button" tabIndex={-1} onClick={() => onOpen(item)} className="group block w-full cursor-pointer rounded-xl text-start">
        <span className="block rounded-xl shadow-e2 transition-[translate,box-shadow] duration-standard ease-standard group-hover:-translate-y-1 group-hover:shadow-e3 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
          <CardFace item={item} label={label(item)} compact />
        </span>
      </button>
    </li>
  );

  return (
    <div className="relative grid min-w-0 gap-3">
      <div aria-hidden className="relative isolate hidden lg:block">
        <div className="mk-glow absolute inset-x-8 inset-y-16 rounded-full bg-selected blur-ambient" />
        <div data-marquee className="relative grid h-(--container-prose) grid-cols-3 gap-4 overflow-hidden mask-y-from-85% mask-y-to-100%">
          {columns.map((column, index) => (
            <ul key={column[0]?.slug ?? index} className={cn("mk-marquee-y grid content-start gap-4 pb-4", index === 1 && "mk-marquee-reverse")}>
              {[...column, ...column].map((item, position) => card(item, `${item.slug}-${position}`))}
            </ul>
          ))}
        </div>
      </div>

      <div aria-hidden className="mk-no-scrollbar -mx-5 snap-x snap-mandatory scroll-px-5 overflow-x-auto md:-mx-10 md:scroll-px-10 lg:hidden">
        <ul className="flex w-max gap-4 px-5 py-2 md:px-10">
          {items.map((item) => card(item, item.slug, "w-[44vw] max-w-(--container-menu) shrink-0 snap-start"))}
        </ul>
      </div>
    </div>
  );
}
