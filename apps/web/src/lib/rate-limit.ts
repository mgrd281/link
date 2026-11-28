import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * A small in-route rate limiter (ADR 0090-csp-and-limits): a fixed window per key, counted in this
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
  /**
   * Keys kept at most (memory stays bounded). Default 10 000. When full, ended windows go first, then
   * the oldest windows still under the limit. A window that has used up its limit is never dropped
   * before it ends (else many new keys would reset it); with only such windows left, a new key is
   * refused until the first of them ends (fails closed).
   */
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

  /** Makes room for one more key; false when every window kept is live and used up. */
  const makeRoom = (now: number): boolean => {
    for (const [key, window] of windows) if (window.endsAt <= now) windows.delete(key);
    // Still full: drop the oldest windows under their limit (a Map keeps insertion order).
    for (const [key, window] of windows) {
      if (windows.size < maxKeys) break;
      if (window.count < max) windows.delete(key);
    }
    return windows.size < maxKeys;
  };
  /** Seconds until the first kept window ends (when a full map refuses a new key). */
  const firstEnd = (now: number): number => Math.min(...[...windows.values()].map((window) => window.endsAt)) - now;

  return {
    take(key, now = Date.now()) {
      if (key === null) return { ok: true, remaining: max };
      let window = windows.get(key);
      if (!window || window.endsAt <= now) {
        if (window) windows.delete(key);
        if (windows.size >= maxKeys && !makeRoom(now)) return { ok: false, retryAfter: Math.max(1, Math.ceil(firstEnd(now) / SECOND)) };
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

/** The eight groups of an IPv6 address (`::` expanded), or null for anything else. */
function ipv6Groups(address: string): string[] | null {
  if (!address.includes(":") || !/^[0-9a-f:.]+$/i.test(address)) return null;
  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) return null;
  const part = (text: string | undefined) => (text ? text.split(":") : []);
  const head = part(halves[0]);
  const tail = part(halves[1]);
  // An IPv4 tail (::ffff:1.2.3.4 and the like) counts as two groups.
  const last = tail.length > 0 ? tail : head;
  if (last.length > 0 && (last[last.length - 1] ?? "").includes(".")) last.splice(-1, 1, "0", "0");
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  return groups.every((group) => /^[0-9a-f]{1,4}$/.test(group)) ? groups.map((group) => group.replace(/^0+(?=.)/, "")) : null;
}

/**
 * The key for a client address as the route already derives it (`requestPlace(headers).ip`), or
 * null when there is none to key on: no address, or the loopback address (local development and the
 * e2e run, where every request comes from the machine itself).
 *
 * An IPv6 address is keyed by its /64: one connection usually holds a whole /64, so keying single
 * addresses would give a client 2^64 fresh keys. An IPv4 address is keyed as it is.
 *
 * The address is trusted only because Vercel overwrites `x-forwarded-for` with the client's address
 * (vercel.json makes Vercel the only deployment target); behind anything else a client could choose it.
 */
export function addressKey(ip: string): string | null {
  const address = ip.trim().replace(/^::ffff:(?=\d+\.)/i, "");
  if (address === "" || LOOPBACK.test(address)) return null;
  const groups = ipv6Groups(address);
  return valueKey("address", groups ? `${groups.slice(0, 4).join(":")}::/64` : address.toLowerCase());
}

/** The headers of a 429: when to try again (RFC 9110 `Retry-After`, seconds) and never from a cache. */
export function retryHeaders(verdict: { retryAfter: number }): Record<string, string> {
  return { "Retry-After": String(verdict.retryAfter), "Cache-Control": "no-store" };
}
