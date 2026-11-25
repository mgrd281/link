/**
 * Touch targets on the public website (e2e/touch-targets.spec.ts).
 *
 * A `Segmented` (packages/ui) that a finger uses on a phone: on a touch screen every segment is at
 * least 44 × 44 px and the track grows around the segments. The usual way to a 44 px target, an invisible
 * extension of a smaller control (`before:` over it, see `IconButton`), would be clipped here: the track
 * scrolls sideways and so clips whatever sticks out of it. A mouse keeps the compact control.
 * Pass it as the `className` of the `Segmented`.
 */
export const touchSegmented = "pointer-coarse:h-auto pointer-coarse:[&>button]:min-h-touch-target pointer-coarse:[&>button]:min-w-touch-target";
