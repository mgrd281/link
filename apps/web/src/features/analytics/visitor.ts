import { createHmac } from "node:crypto";

/**
 * One visitor of one page on one day, as a hash: HMAC-SHA-256 of the page's name, the network address
 * and the browser string, keyed with the day's random salt (`page_stats_salt()`). The address and the
 * browser string never leave the server process; the database gets 64 hex characters. With the next
 * day's salt the same person gives an unrelated hash, and the salt and the hashes of a finished day
 * are deleted (`page_stats_purge`), so no day can be linked to another or to anyone. Server only.
 */
export function visitorHash(salt: string, page: string, address: string, userAgent: string): string {
  return createHmac("sha256", salt).update(`${page.trim().toLowerCase()}\n${address}\n${userAgent}`).digest("hex");
}
