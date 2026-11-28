import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * A small in-route rate limiter (ADR draft-csp-and-limits): a fixed window per key, counted in this
 * server instance's memory.
 *
 * It is a FIRST layer only. Every instance (each Vercel function instance, each `next start`) counts
 * on its own and forgets on a restart, so a client spread over many instances gets more than the
 * limit. The second layer is a firewall rule in front of the app (the Vercel Firewall rules in the ADR).
 *
 * Keys are never raw values: `addressKey` and `valueKey` turn a client address, an account id or an
 * e-mail address into an HMAC with a secret made at start and held only in memory, so a key cannot be
 * turned back into an address and means nothing outside this process. Nothing is written anywhere.
 *
 * Usage (a route handler):
 *
 *   const limit = rateLimit({ name: "import-links", max: 10, windowMs: 10 * MINUTE });
 *   const verdict = limit.take(addressKey(requestPlace(request.headers).ip));
 *   if (!verdict.ok) return Response.json(body, { status: 429, headers: retryHeaders(verdict) });
 */

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

export interface RateLimitOptions {
  /** Names the limit (only in its own keys; two limits never share a count). */
  name: string;
  /** Requests allowed per key and window. */
  max: number;
  /** The window's length in milliseconds; it starts with a key's first request. */
  windowMs: number;
  /** Keys kept at most; past that, the oldest windows are dropped (memory stays bounded). Default 10 000. */
  maxKeys?: number;
}

export type Verdict = { ok: true; remaining: number } | { ok: false; retryAfter: number };

export interface RateLimit {
  /**
   * Counts one request for `key` and says whether it is within the limit. `retryAfter` is in whole
   * seconds (at least 1) until the window ends. A `null` key (no client address to key on, see
   * `addressKey`) is never counted and always allowed.
   */
  take(key: string | null, now?: number): Verdict;
  /** Forgets every count (tests). */
  reset(): void;
}

interface Window {
  count: number;
  endsAt: number;
}

export function rateLimit({ name, max, windowMs, maxKeys = 10_000 }: RateLimitOptions): RateLimit {
  if (!(max >= 1) || !(windowMs >= 1)) throw new Error(`rate limit ${name}: max and windowMs must be positive`);
  const windows = new Map<string, Window>();

  const sweep = (now: number) => {
    for (const [key, window] of windows) if (window.endsAt <= now) windows.delete(key);
    // Still full: drop the oldest windows (a Map keeps insertion order).
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  };

  return {
    take(key, now = Date.now()) {
      if (key === null) return { ok: true, remaining: max };
      let window = windows.get(key);
      if (!window || window.endsAt <= now) {
        if (window) windows.delete(key);
        if (windows.size >= maxKeys) sweep(now);
        window = { count: 0, endsAt: now + windowMs };
        windows.set(key, window);
      }
      if (window.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((window.endsAt - now) / SECOND)) };
      window.count += 1;
      return { ok: true, remaining: max - window.count };
    },
    reset() {
      windows.clear();
    },
  };
}

/** Made once per server instance, never stored or sent: keys from another instance or day mean nothing here. */
const SECRET = randomBytes(32);

/** An HMAC of `value` under this instance's secret, for one kind of value ("email", "account" …). */
export function valueKey(kind: string, value: string): string {
  return createHmac("sha256", SECRET).update(`${kind}\u0000${value}`).digest("base64url");
}

/** The machine itself: `next start` on a developer's machine or in the e2e run, never a visitor on Vercel. */
const LOOPBACK = /^(?:127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|localhost)$/i;

/**
 * The key for a client address as the route already derives it (`requestPlace(headers).ip`), or
 * null when there is none to key on: no address, or the loopback address (local development and the
 * e2e run, where every request comes from the machine itself). On Vercel every request carries the
 * client's address in `x-forwarded-for`, which the platform sets itself (a client cannot choose it).
 */
export function addressKey(ip: string): string | null {
  const address = ip.trim().replace(/^::ffff:/i, "");
  if (address === "" || LOOPBACK.test(address)) return null;
  return valueKey("address", address.toLowerCase());
}

/** The headers of a 429: when to try again (RFC 9110 `Retry-After`, seconds) and never from a cache. */
export function retryHeaders(verdict: { retryAfter: number }): Record<string, string> {
  return { "Retry-After": String(verdict.retryAfter), "Cache-Control": "no-store" };
}
