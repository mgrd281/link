import { afterEach, describe, expect, it, vi } from "vitest";

import { ipHash } from "./ip-hash";

describe("ipHash", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the same all day (Berlin) and different the next day", () => {
    vi.stubEnv("AI_IP_SALT_SECRET", "local-test");
    vi.stubEnv("VERCEL", "");
    const morning = ipHash("203.0.113.7", new Date("2026-11-22T00:30:00+01:00"));
    expect(morning).toMatch(/^[0-9a-f]{64}$/);
    expect(ipHash("203.0.113.7", new Date("2026-11-22T23:30:00+01:00"))).toBe(morning);
    expect(ipHash("203.0.113.7", new Date("2026-11-23T00:30:00+01:00"))).not.toBe(morning);
    expect(ipHash("203.0.113.8", new Date("2026-11-22T00:30:00+01:00"))).not.toBe(morning);
    // 23:30 UTC on the 22nd is already the 23rd in Berlin.
    expect(ipHash("203.0.113.7", new Date("2026-11-22T23:30:00Z"))).not.toBe(morning);
  });

  it("depends on the secret and never contains the address", () => {
    vi.stubEnv("VERCEL", "");
    const at = new Date("2026-11-22T12:00:00Z");
    vi.stubEnv("AI_IP_SALT_SECRET", "one");
    const first = ipHash("203.0.113.7", at);
    vi.stubEnv("AI_IP_SALT_SECRET", "two");
    expect(ipHash("203.0.113.7", at)).not.toBe(first);
    expect(first).not.toContain("203");
  });

  it("needs the secret on Vercel and falls back to a development salt elsewhere", () => {
    const at = new Date("2026-11-22T12:00:00Z");
    vi.stubEnv("AI_IP_SALT_SECRET", "");
    vi.stubEnv("VERCEL", "1");
    expect(() => ipHash("203.0.113.7", at)).toThrow(/AI_IP_SALT_SECRET/);
    vi.stubEnv("VERCEL", "");
    expect(ipHash("203.0.113.7", at)).toMatch(/^[0-9a-f]{64}$/);
  });
});
