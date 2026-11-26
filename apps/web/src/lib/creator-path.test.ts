import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { RESERVED_USERNAMES, USERNAME_MIN, USERNAME_PATTERN } from "@linkyo/blocks/rules";
import { describe, expect, it, vi } from "vitest";

import { config } from "../proxy";

import { creatorRedirect, creatorRewrite, twoSegments } from "./creator-path";

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

  it("serves /<name>/<project> from the project route when both parts are valid", () => {
    expect(creatorRewrite("/mats/tidewatch", true)).toBe("/u/mats/tidewatch");
    expect(creatorRewrite("/mats/tidewatch/", true)).toBe("/u/mats/tidewatch");
    expect(creatorRewrite("/mila-aurel/web-2", true)).toBe("/u/mila-aurel/web-2");
    expect(twoSegments("/mats/tidewatch")).toEqual(["mats", "tidewatch"]);
    expect(twoSegments("/mats")).toBeNull();
    expect(twoSegments("/mats/x/y")).toBeNull();
  });

  it("never takes a product route, a reserved word or a deeper path for a project", () => {
    for (const path of [
      "/de/pricing",
      "/en/templates",
      "/ar/p",
      "/templates/x",
      "/templates/werkbogen",
      "/p/ronja-feldkamp",
      "/i/abc",
      "/u/mats",
      "/api/people",
      "/checkout/pro",
      "/mats/cv",
      "/mats/opengraph-image",
      "/mats/kontakt",
      "/mats/a",
      "/mats/x/y",
      "/mats/Tidewatch",
      "/mats/tide_watch",
      "/mats/-tide",
      "/ma/tidewatch",
    ]) {
      expect(creatorRewrite(path, true), path).toBeNull();
    }
  });

  it("rewrites no project address in a demo build", () => {
    expect(creatorRewrite("/mats/tidewatch", false)).toBeNull();
  });

  it("keeps every first-level route of the app out of the names people can take", () => {
    // A route folder that is not a reserved name could be shadowed by someone's page (or a project
    // address under it): a new route must be added to RESERVED_USERNAMES (and the database's list).
    const app = join(dirname(fileURLToPath(import.meta.url)), "../app/[locale]");
    const routes = readdirSync(app, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => (/^\(.+\)$/.test(entry.name) ? readdirSync(join(app, entry.name), { withFileTypes: true }).filter((inner) => inner.isDirectory()).map((inner) => inner.name) : [entry.name]))
      .filter((name) => !name.startsWith("[") && !name.startsWith("_"));
    expect(routes.length).toBeGreaterThan(10);
    for (const route of routes) {
      // Shorter than a username can be ("p", "i"): nobody can take it anyway.
      if (route.length < USERNAME_MIN) continue;
      // A file-like route ("manifest.webmanifest") has a dot, which no username can have.
      if (!USERNAME_PATTERN.test(route)) continue;
      expect(RESERVED_USERNAMES.has(route), route).toBe(true);
    }
  });

  it("sends capital letters in a project address to the lowercase address", () => {
    expect(creatorRedirect("/Mats/Tidewatch")).toBe("/mats/tidewatch");
    expect(creatorRedirect("/mats/Tidewatch/")).toBe("/mats/tidewatch");
    expect(creatorRedirect("/mats/tidewatch")).toBeNull();
    expect(creatorRedirect("/De/Pricing")).toBeNull();
    expect(creatorRedirect("/Templates/X")).toBeNull();
    expect(creatorRedirect("/Mats/CV")).toBeNull();
    expect(creatorRedirect("/Mats/A/B")).toBeNull();
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
