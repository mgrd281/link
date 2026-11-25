import type { ReactNode } from "react";

/**
 * Rich-text tags of the website's messages. Arabic messages put Latin names, figures and handles in
 * `<bdi>`, so they keep their own direction inside a right-to-left sentence; German and English
 * messages use the same keys, mostly without the tag.
 */
export const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

/**
 * A short technical term or measure that must stay on one line ("HMAC-SHA-256" would break at its
 * hyphens, "44 × 44" at its spaces): isolated like `bdi`, without a line break. Only for short
 * terms; a phrase stays in `bdi`, so it may wrap.
 */
export const term = (chunks: ReactNode) => <bdi className="whitespace-nowrap">{chunks}</bdi>;

/** The same tags for plain text (metadata, search, structured data): the words without the markup. */
export const plainTags = { bdi: (chunks: string) => chunks, term: (chunks: string) => chunks };
