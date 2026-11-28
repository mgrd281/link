import { describe, expect, it } from "vitest";

import { addressKey, MINUTE, rateLimit, retryHeaders, SECOND, valueKey } from "./rate-limit";

const T0 = Date.parse("2026-11-28T12:00:00Z");

describe("rateLimit: a fixed window per key", () => {
  it("allows max requests in a window, then refuses with the seconds until it ends", () => {
    const limit = rateLimit({ name: "t", max: 3, windowMs: 10 * MINUTE });
    expect(limit.take("k", T0)).toEqual({ ok: true, remaining: 2 });
    expect(limit.take("k", T0 + 1)).toEqual({ ok: true, remaining: 1 });
    expect(limit.take("k", T0 + 2)).toEqual({ ok: true, remaining: 0 });
    expect(limit.take("k", T0 + 3)).toEqual({ ok: false, retryAfter: 600 });
    // Rounded up to whole seconds, never 0.
    expect(limit.take("k", T0 + 10 * MINUTE - 1)).toEqual({ ok: false, retryAfter: 1 });
  });

  it("starts a new window once the old one has ended (the reset), and the refusals did not extend it", () => {
    const limit = rateLimit({ name: "t", max: 2, windowMs: MINUTE });
    limit.take("k", T0);
    limit.take("k", T0);
    for (let i = 0; i < 5; i++) expect(limit.take("k", T0 + 30 * SECOND).ok).toBe(false);
    expect(limit.take("k", T0 + MINUTE)).toEqual({ ok: true, remaining: 1 });
    expect(limit.take("k", T0 + MINUTE + 1)).toEqual({ ok: true, remaining: 0 });
    expect(limit.take("k", T0 + MINUTE + 2).ok).toBe(false);
  });

  it("counts each key on its own, and each limit on its own", () => {
    const one = rateLimit({ name: "one", max: 1, windowMs: MINUTE });
    const two = rateLimit({ name: "two", max: 1, windowMs: MINUTE });
    expect(one.take("a", T0).ok).toBe(true);
    expect(one.take("a", T0).ok).toBe(false);
    expect(one.take("b", T0).ok).toBe(true);
    expect(two.take("a", T0).ok).toBe(true);
  });

  it("never counts a null key (no client address to key on)", () => {
    const limit = rateLimit({ name: "t", max: 1, windowMs: MINUTE });
    for (let i = 0; i < 20; i++) expect(limit.take(null, T0).ok).toBe(true);
  });

  it("reset() forgets every count", () => {
    const limit = rateLimit({ name: "t", max: 1, windowMs: MINUTE });
    limit.take("k", T0);
    expect(limit.take("k", T0).ok).toBe(false);
    limit.reset();
    expect(limit.take("k", T0).ok).toBe(true);
  });

  it("keeps at most maxKeys windows: ended ones go first, then the oldest", () => {
    const limit = rateLimit({ name: "t", max: 1, windowMs: MINUTE, maxKeys: 3 });
    for (const key of ["a", "b", "c"]) limit.take(key, T0);
    // A fourth key drops the oldest live window ("a"), which then counts from zero again.
    limit.take("d", T0 + 1);
    expect(limit.take("a", T0 + 2).ok).toBe(true);
    // "b" was dropped to make room for "a"; "c" and "d" still hold their counts.
    expect(limit.take("c", T0 + 3).ok).toBe(false);
    expect(limit.take("d", T0 + 3).ok).toBe(false);
  });

  it("refuses a limit that could never allow anything", () => {
    expect(() => rateLimit({ name: "t", max: 0, windowMs: MINUTE })).toThrow(/positive/);
    expect(() => rateLimit({ name: "t", max: 1, windowMs: 0 })).toThrow(/positive/);
  });
});

describe("keys never hold the raw value", () => {
  it("an address becomes an HMAC: stable in this instance, without the address in it", () => {
    const key = addressKey("203.0.113.7");
    expect(key).toMatch(/^[\w-]{43}$/);
    expect(key).not.toContain("203");
    expect(addressKey("203.0.113.7")).toBe(key);
    expect(addressKey("::ffff:203.0.113.7")).toBe(key);
    expect(addressKey(" 203.0.113.7 ")).toBe(key);
    expect(addressKey("203.0.113.8")).not.toBe(key);
    expect(addressKey("2001:DB8::1")).toBe(addressKey("2001:db8::1"));
  });

  it("no address, or the machine itself (loopback), gives no key", () => {
    for (const ip of ["", " ", "127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1", "localhost"]) expect(addressKey(ip), ip).toBeNull();
    expect(addressKey("10.0.0.1")).not.toBeNull();
  });

  it("a value key depends on its kind and never contains the value", () => {
    const email = valueKey("email", "mira@example.com");
    expect(email).not.toContain("mira");
    expect(valueKey("account", "mira@example.com")).not.toBe(email);
    expect(valueKey("email", "mira@example.com")).toBe(email);
  });
});

describe("retryHeaders", () => {
  it("says when to try again and keeps the answer out of every cache", () => {
    expect(retryHeaders({ retryAfter: 42 })).toEqual({ "Retry-After": "42", "Cache-Control": "no-store" });
  });
});
