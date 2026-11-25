// Relative imports only: next.config.ts loads this through features/legal/live-guard.ts.
import { REVIEW } from "../../legal/texts";

/**
 * Sentences of the informational pages that a lawyer must see before launch: legal promises, and every
 * sentence whose counterpart in the privacy policy (features/legal/texts.ts) is still under review.
 * Each one shows the lawyer's review marker (`REVIEW.check`, "[vom Anwalt zu prüfen]") right after
 * it, as the legal drafts do, and the launch guard counts them (`infoPageMarkers` in
 * features/legal/live-guard.ts): a `LAUNCH=1` build fails while one is left. A key names the item
 * under `sitePages.<page>.sections`; remove it here once a lawyer has approved the sentence.
 *
 * Security & privacy: hosting and the transfer to Vercel (the policy's "Hosting", REVIEW.transfer);
 * that no data is sold; what the counting script sends and that it sends nothing with Do Not Track or
 * Global Privacy Control (the policy's objection paragraph, REVIEW.check); how long check values and
 * keys are kept and when they are deleted; that the counting needs no consent banner; what the AI
 * provider gets (the policy's "KI-Funktionen", REVIEW.transfer and REVIEW.dpa); how long sign-ins are
 * kept; what an account deletion removes. Help, features, about and pricing describe the product and
 * carry no markers.
 */
export const LEGAL_PROMISES = {
  security: ["hosting.vercel", "hosting.noSale", "statistics.script", "statistics.how", "statistics.noBanner", "ai.photos", "account.signIns", "account.delete"],
} as const satisfies Record<string, readonly string[]>;

export type InfoPage = keyof typeof LEGAL_PROMISES;

export const isLegalPromise = (page: InfoPage, key: string): boolean => (LEGAL_PROMISES[page] as readonly string[]).includes(key);

/** The marker shown after a legal promise (German, like the legal drafts it belongs with). */
export const LEGAL_PROMISE_MARKER = REVIEW.check;

/** The review markers the informational pages still show: one per unreviewed legal promise. */
export function infoPageMarkers(): string[] {
  return Object.values(LEGAL_PROMISES).flatMap((keys) => keys.map(() => LEGAL_PROMISE_MARKER));
}
