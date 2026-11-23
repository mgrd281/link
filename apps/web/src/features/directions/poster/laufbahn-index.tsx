"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The section index's list. On phones it is a row of chips to swipe; a chip reached with Tab is
 * scrolled fully into the row (the browser leaves a chip that already shows a little where it is, its
 * label and focus ring cut at the screen's edge). Where the chips wrap or stand in a column, the list
 * does not scroll and nothing happens. The links themselves stay plain anchors that work without it.
 */
export function IndexList({ className, children }: { className: string; children: ReactNode }): ReactNode {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const row = list.current;
    if (!row) return;
    const reveal = (event: FocusEvent) => {
      const chip = event.target;
      if (row.scrollWidth <= row.clientWidth || !(chip instanceof HTMLElement)) return;
      const [frame, box] = [row.getBoundingClientRect(), chip.getBoundingClientRect()];
      if (box.left >= frame.left && box.right <= frame.right) return;
      // To the chip's own snap position (its start), so the row's snapping keeps it whole.
      chip.scrollIntoView({ block: "nearest", inline: "start" });
    };
    row.addEventListener("focusin", reveal);
    return () => row.removeEventListener("focusin", reveal);
  }, []);
  return (
    <ol ref={list} className={className}>
      {children}
    </ol>
  );
}
