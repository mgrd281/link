import { describe, expect, it, vi } from "vitest";

import { config } from "../proxy";

import { creatorRedirect, creatorRewrite } from "./creator-path";

// Only the matcher is read here; next-intl's middleware does not load outside Next.
vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));

describe("which paths reach the proxy", () => {
  // Each matcher is "/" plus one group that is a plain regular expression, which Next anchors at both
  // ends (with an optional closing "/", "#" or "?"): the same expression, compiled here the same way.
  const matchers = config.matcher.map((source) => new RegExp(`^${source}[/#?]?$`));
  const runs = (path: string) => matchers.some((matcher) => matcher.test(path));

  it("runs for creator addresses that merely begin with a skipped name", () => {
    for (const path of ["/apiary", "/api-fan", "/apinya/", "/Apiary", "/mila", "/", "/de/app", "/u/apiary"]) expect(runs(path), path).toBe(true);
    // The address is then served by the creator route like any other.
    expect(creatorRewrite("/apiary", true)).toBe("/u/apiary");
    expect(creatorRewrite("/api-fan", true)).toBe("/u/api-fan");
  });

  it("still skips the API, Next's own paths and files", () => {
    for (const path of ["/api", "/api/", "/api/people", "/_next/static/chunks/a.js", "/_next/image", "/_vercel/insights", "/favicon.svg", "/media/motion/a.mp4"]) {
      expect(runs(path), path).toBe(false);
    }
  });
});

describe("creator page addresses", () => {
  it("serves /<name> from the creator route when real accounts are on", () => {
    expect(creatorRewrite("/mila", true)).toBe("/u/mila");
    expect(creatorRewrite("/mila/", true)).toBe("/u/mila");
    expect(creatorRewrite("/mila-aurel", true)).toBe("/u/mila-aurel");
  });

  it("leaves languages, product routes, invalid names and deeper paths alone", () => {
    for (const path of ["/de", "/en", "/ar", "/templates", "/checkout", "/impressum", "/widerruf", "/u", "/a-", "/ab", "/mila/x", "/api", "/", "/Mila"]) {
      expect(creatorRewrite(path, true), path).toBeNull();
    }
  });

  it("does nothing in a demo build", () => {
    expect(creatorRewrite("/mila", false)).toBeNull();
  });

  it("sends capital letters to the lowercase address", () => {
    expect(creatorRedirect("/Mila")).toBe("/mila");
    expect(creatorRedirect("/MILA-Aurel/")).toBe("/mila-aurel");
    expect(creatorRedirect("/mila")).toBeNull();
    expect(creatorRedirect("/De")).toBeNull();
    expect(creatorRedirect("/Templates")).toBeNull();
    expect(creatorRedirect("/Mi")).toBeNull();
    expect(creatorRedirect("/Mila/x")).toBeNull();
  });
});
