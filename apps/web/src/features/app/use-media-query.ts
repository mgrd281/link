import { useCallback, useSyncExternalStore } from "react";

/** The `desk` breakpoint (tokens: 1200 px): the compact live preview shows beside the content from here. */
export const DESK_QUERY = "(width >= 75rem)";

/**
 * Whether a media query matches, kept in sync as the window changes. The server (and the first client
 * render, for hydration) says false, so what it gates is mounted only on the client.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
