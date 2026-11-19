/**
 * The people search lives in the browser's history, as a screen does in an app: opening it adds a
 * step, so the back button (or the back swipe) closes it, and coming back from a person's page
 * returns to the search as it was left. Only the open state, the typed words and the chosen field
 * are kept, in the history entry itself: no cookie, no storage.
 */
const KEY = "linkyoSearch";
const CHANGE = "linkyo:search";

export interface SearchState {
  query: string;
  category: string | null;
}

/** What the current history entry holds for the search, or null when the search is closed. */
export function heldSearch(): SearchState | null {
  const state = window.history.state as Record<string, unknown> | null;
  const held = state?.[KEY] as Partial<SearchState> | undefined;
  if (!held || typeof held !== "object") return null;
  return { query: typeof held.query === "string" ? held.query : "", category: typeof held.category === "string" ? held.category : null };
}

export const isSearchOpen = () => heldSearch() !== null;

/** Tells React when the search opens or closes: by our own doing or by the browser's back and forward. */
export function onSearchChange(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(CHANGE, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(CHANGE, notify);
  };
}

/** Opens the search as a new step in the history. */
export function openSearch() {
  if (isSearchOpen()) return;
  window.history.pushState({ [KEY]: { query: "", category: null } satisfies SearchState }, "");
  window.dispatchEvent(new Event(CHANGE));
}

/** Closes the search the way the back button does: one step back. */
export function closeSearch() {
  if (isSearchOpen()) window.history.back();
}

/** Before leaving for a person's page: note what was typed, so coming back finds it again. */
export function rememberSearch(state: SearchState) {
  if (!isSearchOpen()) return;
  window.history.replaceState({ [KEY]: state }, "");
}
