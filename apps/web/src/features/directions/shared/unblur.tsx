"use client";

import { useEffect } from "react";

const PLACEHOLDER = ["background-image", "background-size", "background-position", "background-repeat"] as const;

/**
 * A picture that has loaded no longer needs its blur placeholder; one that failed also shows its alt
 * text again (next/image hides it with `color: transparent` while the picture loads).
 */
function settle(image: HTMLImageElement, failed: boolean): void {
  if (image.style.backgroundImage) for (const property of PLACEHOLDER) image.style.removeProperty(property);
  if (failed) image.style.removeProperty("color");
}

/**
 * Does after a picture loads what next/image's client component does (creator pages draw next/image's
 * `<img>` without that component, `PlainImage`, ADR 0008): takes the blur placeholder away, which is
 * the picture's own background and, left there, showed at a picture's rounded, anti-aliased edge and
 * through a translucent picture; and shows the alt text of a picture that failed. One island per page;
 * it renders nothing.
 */
export function Unblur(): null {
  useEffect(() => {
    for (const image of document.querySelectorAll<HTMLImageElement>("img[data-nimg]")) {
      if (image.complete) settle(image, image.naturalWidth === 0);
    }
    const done = (event: Event) => {
      if (event.target instanceof HTMLImageElement && event.target.dataset.nimg) settle(event.target, event.type === "error");
    };
    document.addEventListener("load", done, true);
    document.addEventListener("error", done, true);
    return () => {
      document.removeEventListener("load", done, true);
      document.removeEventListener("error", done, true);
    };
  }, []);
  return null;
}
