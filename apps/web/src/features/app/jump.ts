import type { DesignTab } from "./routes";

/*
 * What the section panel does on a plain click: it moves within the screen and never touches the
 * history, so the shell's back model and `history.length` stay right.
 */

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The id of a block row's edit button in the Page editor: the target of an outline item. */
export const rowAnchor = (blockId: string) => `row-${blockId}`;

/**
 * Scrolls a part of the screen to the top (clear of the sticky toolbar through the page's scroll
 * padding) and focuses its title, so the next Tab continues there. Smooth unless reduced motion is
 * asked for, or `instant` (a link opened in a new tab lands there at once).
 */
export function jumpTo(target: HTMLElement, { instant = false }: { instant?: boolean } = {}) {
  target.scrollIntoView({ block: "start", behavior: instant || reducedMotion() ? "auto" : "smooth" });
  target.focus({ preventScroll: true });
}

/**
 * Puts the Design tab in the address without a navigation.
 *
 * Load-bearing: the state passed is `null`, never `window.history.state`. Next 16 patches
 * `history.replaceState` and treats a state that carries its own markers (`__NA`, `_N`) as one of its
 * internal calls, and then does not update `useSearchParams` (next/dist/client/components/app-router.js).
 * And no `router.replace`: it would fetch the route again, so a tab click would wait for the network.
 * A replace adds no history entry, so Back still leaves Design.
 */
export function setDesignTabUrl(tab: DesignTab) {
  window.history.replaceState(null, "", `?tab=${tab}`);
}
