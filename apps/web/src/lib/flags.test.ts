import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { analyticsEnabled } from "./flags";

const ROOT = path.resolve(import.meta.dirname, "../../../..");

describe("the analytics switch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless LINKYO_ANALYTICS is exactly \"on\"", () => {
    vi.stubEnv("LINKYO_ANALYTICS", undefined);
    expect(analyticsEnabled()).toBe(false);
    for (const value of ["", "1", "true", "ON", "On", " on", "on ", "yes", "off"]) {
      vi.stubEnv("LINKYO_ANALYTICS", value);
      expect(analyticsEnabled(), JSON.stringify(value)).toBe(false);
    }
    vi.stubEnv("LINKYO_ANALYTICS", "on");
    expect(analyticsEnabled()).toBe(true);
  });

  it("is read on each call, so a server takes the value it was started with", () => {
    vi.stubEnv("LINKYO_ANALYTICS", "on");
    expect(analyticsEnabled()).toBe(true);
    vi.stubEnv("LINKYO_ANALYTICS", undefined);
    expect(analyticsEnabled()).toBe(false);
  });

  it("is a server variable: never NEXT_PUBLIC_, listed for Turborepo's strict env mode and in .env.example", () => {
    const flags = readFileSync(path.join(ROOT, "apps/web/src/lib/flags.ts"), "utf8");
    expect(flags).not.toMatch(/NEXT_PUBLIC_\w*ANALYTICS/);
    const turbo = JSON.parse(readFileSync(path.join(ROOT, "turbo.json"), "utf8")) as { tasks: { build: { env: string[] } } };
    expect(turbo.tasks.build.env).toContain("LINKYO_ANALYTICS");
    expect(readFileSync(path.join(ROOT, ".env.example"), "utf8")).toMatch(/^LINKYO_ANALYTICS=\s/m);
  });

  it("is on in the e2e web server only", () => {
    const config = readFileSync(path.join(ROOT, "apps/web/playwright.config.ts"), "utf8");
    expect(config).toContain('LINKYO_ANALYTICS: process.env.LINKYO_ANALYTICS ?? "on"');
    expect(readFileSync(path.join(ROOT, "apps/web/vercel.json"), "utf8")).not.toContain("LINKYO_ANALYTICS");
  });
});
