import { describe, expect, it } from "vitest";

import { creatorRedirect, creatorRewrite } from "./creator-path";

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
