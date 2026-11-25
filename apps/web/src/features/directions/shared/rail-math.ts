/** How far one card is from the next in a row (its width and the gap), whatever the direction. */
export function cardStep(first: { left: number; width: number } | undefined, second: { left: number } | undefined): number {
  if (!first) return 0;
  return second ? Math.abs(second.left - first.left) : first.width;
}

/** Whether a row stands at its start or its end. Scroll offsets run negative in right-to-left layouts. */
export function railEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): { start: boolean; end: boolean; scrolls: boolean } {
  const offset = Math.abs(scrollLeft);
  const scrolls = scrollWidth - clientWidth > 1;
  return { start: offset < 2, end: offset + clientWidth >= scrollWidth - 2, scrolls };
}
