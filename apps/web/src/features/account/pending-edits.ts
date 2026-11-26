/**
 * Changes that have not reached the store yet: the dashboard's editor writes a change a moment after
 * the last one (its autosave delay). Whoever needs everything saved now asks these to hand their
 * change over first: the stores before signing out and when the tab goes away, the iPhone app before
 * it changes the page itself. Its own module, so both stores can ask without importing the app's store.
 */
const pendingEdits = new Set<() => void>();

/** The editor registers how to hand over its waiting change; the answer unregisters it. */
export function registerPendingEdits(handOver: () => void): () => void {
  pendingEdits.add(handOver);
  return () => {
    pendingEdits.delete(handOver);
  };
}

/** Every waiting change goes to the store now (it saves them with its next save). */
export function handOverPendingEdits(): void {
  for (const handOver of pendingEdits) {
    try {
      handOver();
    } catch {
      // One editor that cannot hand over (it is unmounting) never stops the save that asked.
    }
  }
}
