/**
 * Where a toast stands on a phone, as geometry only (the Toaster measures the screen and asks).
 *
 * A toast lives at the bottom, above the tab bar. That is where thumbs are, so it can sit on the very
 * button that was just pressed, or on the rows below it that are pressed next ("Link copied" over the
 * QR-code row). The top of the screen, under the app's bar, is the other place it may stand: it takes
 * that one when it covers less there.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type ToastSide = "bottom" | "top";

export interface Placement {
  /** Where the toasts would stand at the bottom and at the top of the screen. */
  bands: Record<ToastSide, Box>;
  /** Every control on screen (links, buttons, switches, fields): what a toast would hide. */
  controls: readonly Box[];
  /** The control that was just used, while it is still on screen: it is never covered if the other side is better. */
  used?: Box | null;
  /** Parts of the screen that show the result of what was just done (a preview): covered only as a last resort. */
  keepClear?: readonly Box[];
}

const overlaps = (a: Box, b: Box): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** What standing in `band` would hide: each control, the control just used a hundred times over, a preview a thousand. */
export function coverCost(band: Box, { controls, used = null, keepClear = [] }: Omit<Placement, "bands">): number {
  return controls.filter((control) => overlaps(band, control)).length + (used && overlaps(band, used) ? 100 : 0) + keepClear.filter((region) => overlaps(band, region)).length * 1000;
}

/** The side that covers less; the bottom, where toasts live, when it is a tie. */
export function pickToastSide(placement: Placement): ToastSide {
  return coverCost(placement.bands.top, placement) < coverCost(placement.bands.bottom, placement) ? "top" : "bottom";
}
