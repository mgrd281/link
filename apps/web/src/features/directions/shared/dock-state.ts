/**
 * Whether the Linkyo bar on a creator page may slide in: once the visitor has scrolled and the end of
 * the hero (the `data-poster-sentinel` mark) has passed 45 % of the screen's height, so the page's own
 * name is out of sight. A short hero can end above that line before anyone scrolls (the statement
 * hero on a laptop, about 384 px down on a 900 px screen); the bar still waits for a scroll, so a
 * page at rest at the top never shows it. A pure module, so the rule can be tested.
 */
export function pastHero(sentinelTop: number, viewportHeight: number, scrollY: number): boolean {
  return scrollY > 0 && sentinelTop < viewportHeight * 0.45;
}
