import { useSyncExternalStore } from "react";

/** Calls back at most once per frame while the window scrolls. */
function subscribe(onChange: () => void) {
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    if (frame) window.cancelAnimationFrame(frame);
  };
}

/**
 * Whether the window has scrolled away from the top. Bars show their hairline only then, so at rest
 * they sit on the ground with nothing between them and the content.
 */
export function useScrolled(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > 0,
    () => false,
  );
}
