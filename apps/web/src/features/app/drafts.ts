import { useCallback, useSyncExternalStore } from "react";

import type { Legal } from "@/features/account/types";

/*
 * Unsaved legal-notice edits, kept outside the form: they survive moving between dashboard screens
 * (the save status in the shell shows them), not a reload. One draft per account.
 */

const legalDrafts = new Map<string, Legal | null>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setLegalDraft(accountId: string, next: Legal | null) {
  if ((legalDrafts.get(accountId) ?? null) === next) return;
  if (next === null) legalDrafts.delete(accountId);
  else legalDrafts.set(accountId, next);
  for (const listener of listeners) listener();
}

/** The account's unsaved legal notice (null when there is none) and a setter; null clears it. */
export function useLegalDraft(accountId: string): readonly [Legal | null, (next: Legal | null) => void] {
  const draft = useSyncExternalStore(
    subscribe,
    () => legalDrafts.get(accountId) ?? null,
    () => null,
  );
  const set = useCallback((next: Legal | null) => setLegalDraft(accountId, next), [accountId]);
  return [draft, set] as const;
}

/** True while the account has unsaved edits somewhere (today: the legal notice). */
export function useHasUnsavedDraft(accountId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (legalDrafts.get(accountId) ?? null) !== null,
    () => false,
  );
}
