import { tokens } from "@linkyo/tokens";
import { useLayoutEffect, useRef } from "react";

/** The emphasized curve from the tokens (WAAPI takes no CSS variables). */
const EASING = `cubic-bezier(${tokens.motion.easing.emphasized.join(", ")})`;

/** Where a row sits in its list by layout: transforms and running glides do not count. */
function layoutTop(row: HTMLElement): number {
  const list = row.parentElement;
  if (!list || row.offsetParent === list) return row.offsetTop;
  return row.offsetTop - list.offsetTop;
}

/** How far a glide under way has moved the row from its place (the `translate` it animates). */
function glideOffset(row: HTMLElement): number {
  const [, y] = getComputedStyle(row).translate.split(" ");
  return y ? Number.parseFloat(y) || 0 : 0;
}

/**
 * Rows glide to their new place when the order changes (move, delete, undo, duplicate), so the eye
 * can follow what moved: "First, Last, Invert, Play" on the `translate` property of each
 * `[data-row]` element (its value is the row's id). Rows that dnd-kit is moving (an inline
 * transform) are left to it, and `skip` says when a change came from a drop that dnd-kit animates
 * itself. With reduced motion the rows simply appear in their new place.
 *
 * Positions are kept after every render of the list's owner, so a row that changed height in
 * between (a longer title) does not glide by that difference later.
 */
export function useFlip(order: readonly string[], skip?: () => boolean): void {
  const key = order.join("\n");
  const shown = useRef<{ key: string; tops: Map<string, number> } | null>(null);
  const glides = useRef(new Map<string, Animation>());

  useLayoutEffect(() => {
    const before = shown.current;
    const tops = new Map<string, number>();
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-row]"));
    const changed = before !== null && before.key !== key;
    const still = !changed || (skip?.() ?? false) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (const row of rows) {
      const id = row.dataset.row;
      if (!id) continue;
      const top = layoutTop(row);
      tops.set(id, top);
      const from = before?.tops.get(id);
      if (still || from === undefined || row.style.transform) continue;
      // A glide still under way starts the next one from where the row shows now.
      const running = glides.current.get(id);
      const offset = running ? glideOffset(row) : 0;
      if (running) {
        running.cancel();
        glides.current.delete(id);
      }
      const dy = from + offset - top;
      if (Math.abs(dy) < 1) continue;
      const glide = row.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], {
        duration: tokens.motion.duration.standard,
        easing: EASING,
      });
      glides.current.set(id, glide);
      glide.addEventListener("finish", () => {
        if (glides.current.get(id) === glide) glides.current.delete(id);
      });
    }
    shown.current = { key, tops };
  });
}
