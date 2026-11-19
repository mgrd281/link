"use client";

import { cn, IconButton } from "@linkyo/ui";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
 * The hero's moving wall: three columns drifting past each other on large screens, one strip on
 * phones. Decorative (the same pages are in the gallery below as named buttons), so it is hidden
 * from screen readers and out of the tab order; a mouse click still opens the preview. Hover or the
 * pause button stops it (WCAG 2.2.2); reduced motion keeps it still.
 */
export function Showcase({ items, onOpen }: { items: readonly GalleryItem[]; onOpen: (item: GalleryItem) => void }) {
  const t = useTranslations("examples");
  const [paused, setPaused] = useState(false);
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
    <div data-paused={paused} className="relative grid min-w-0 gap-3">
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

      <div aria-hidden data-marquee className="-mx-5 overflow-hidden mask-x-from-90% mask-x-to-100% md:-mx-10 lg:hidden">
        <ul className="mk-marquee flex w-max gap-4 px-2 py-2">
          {[...items, ...items].map((item, position) => card(item, `${item.slug}-${position}`, "w-[40vw] max-w-(--container-menu) shrink-0"))}
        </ul>
      </div>

      <IconButton
        icon={paused ? Play : Pause}
        label={paused ? t("motion.play") : t("motion.pause")}
        variant="secondary"
        size="sm"
        onClick={() => setPaused((value) => !value)}
        className="justify-self-end motion-reduce:hidden lg:absolute lg:end-3 lg:bottom-3"
      />
    </div>
  );
}
