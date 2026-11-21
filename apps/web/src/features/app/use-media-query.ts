import { tokens } from "@linkyo/tokens";
import { useCallback, useSyncExternalStore } from "react";

/**
 * The `desk` breakpoint token: the compact live preview shows beside the content from here. In rem,
 * as the generated CSS has it (1 rem = 16 px there): a media query's rem follows the browser's font
 * size setting, so this query and the `desk:` classes always switch at the same width.
 */
export const DESK_QUERY = `(width >= ${tokens.breakpoint.desk / 16}rem)`;

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
