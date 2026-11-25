// Relative imports only: next.config.ts loads this through features/legal/live-guard.ts.
import { REVIEW } from "../../legal/texts";

/**
 * Sentences of the informational pages that are a legal promise, not only a description of what the
 * code does. Each one shows the lawyer's review marker (`REVIEW.check`, "[vom Anwalt zu prüfen]")
 * right after it, as the legal drafts do, and the launch guard counts them (`infoPageMarkers` in
 * features/legal/live-guard.ts): a `LAUNCH=1` build fails while one is left. A key names the item
 * under `sitePages.<page>.sections`; remove it here once a lawyer has approved the sentence.
 */
export const LEGAL_PROMISES = {
  security: ["hosting.noSale", "statistics.noBanner"],
} as const satisfies Record<string, readonly string[]>;

export type InfoPage = keyof typeof LEGAL_PROMISES;

export const isLegalPromise = (page: InfoPage, key: string): boolean => (LEGAL_PROMISES[page] as readonly string[]).includes(key);

/** The marker shown after a legal promise (German, like the legal drafts it belongs with). */
export const LEGAL_PROMISE_MARKER = REVIEW.check;

/** The review markers the informational pages still show: one per unreviewed legal promise. */
export function infoPageMarkers(): string[] {
  return Object.values(LEGAL_PROMISES).flatMap((keys) => keys.map(() => LEGAL_PROMISE_MARKER));
}
