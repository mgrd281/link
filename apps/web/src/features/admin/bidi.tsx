import type { ReactNode } from "react";

/**
 * The `<bdi>` tag of the team console's messages: in Arabic, Latin names (Pro, Stripe, CSV, IP) and
 * numbers sit inside it, so they keep their own direction and the sentence's punctuation stays where
 * it belongs. German and English carry no tag; the function is then never called.
 *
 * - `bdi` for `t.rich(key, { bdi })` where the text lands in the page (a paragraph, a cell, a badge);
 * - `isolate` for `t.markup(key, { bdi: isolate })` where only plain text fits (a toast, a menu item,
 *   a panel title, an `aria-label`): the same isolation as First Strong Isolate … Pop Directional Isolate.
 */
export const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

export const isolate = (chunks: string) => `⁨${chunks}⁩`;

/**
 * `ltr` for `t.rich(key, { bdi: ltr })` where an isolated run holds only figures and signs, such as a
 * range "1–25": with no letter to tell its direction, an Arabic line would show it as "25–1".
 */
export const ltr = (chunks: ReactNode) => <bdi dir="ltr">{chunks}</bdi>;
