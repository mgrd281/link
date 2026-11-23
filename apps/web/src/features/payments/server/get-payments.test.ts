import { afterEach, describe, expect, it, vi } from "vitest";

import { ipHash } from "@/lib/server/ip-hash";

import { formIpHash } from "./get-payments";

const request = (ip: string) => new Request("https://linkyo.app/api/withdrawals", { method: "POST", headers: { "x-forwarded-for": ip } });

describe("the sender's network for the contract forms", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is a daily hash, the same for one address and different for another", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("AI_IP_SALT_SECRET", "unit-salt");
    const hash = formIpHash(request("203.0.113.7"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(formIpHash(request("203.0.113.7"))).toBe(hash);
    expect(formIpHash(request("203.0.113.8"))).not.toBe(hash);
    expect(hash).not.toContain("203.0.113.7");
  });

  it("never throws when the salt secret is missing on Vercel: a declaration must still be stored", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("AI_IP_SALT_SECRET", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // The hash itself refuses to work without its secret …
    expect(() => ipHash("203.0.113.7")).toThrow("AI_IP_SALT_SECRET is not set");
    // … but the forms get one shared bucket instead of an error, and one line says what is wrong.
    expect(formIpHash(request("203.0.113.7"))).toBe("unknown");
    expect(formIpHash(request("203.0.113.8"))).toBe("unknown");
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({ evt: "ip_hash_failed", error: "AI_IP_SALT_SECRET is not set" });
    expect(String(log.mock.calls[0]?.[0])).not.toContain("203.0.113");
  });
});
