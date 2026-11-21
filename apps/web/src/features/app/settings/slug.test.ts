import { describe, expect, it } from "vitest";

import { toSlug } from "./slug";

describe("toSlug", () => {
  it("turns a name into an address", () => {
    expect(toSlug("Mila Aurel")).toBe("mila-aurel");
    expect(toSlug("Jürgen Weiß")).toBe("juergen-weiss");
  });

  it("spells out umlauts and drops other accents and signs", () => {
    expect(toSlug("Ünïcödé!")).toBe("uenicoede");
    expect(toSlug("ÄÖÜ ẞ")).toBe("aeoeue-ss");
    expect(toSlug("café_au.lait")).toBe("cafe-au-lait");
  });

  it("never starts with a dash or doubles one", () => {
    expect(toSlug("  a--b ", true)).toBe("a-b");
    expect(toSlug("--mila")).toBe("mila");
  });

  it("keeps a dash at the end while typing, not once the field is left", () => {
    expect(toSlug("mila ")).toBe("mila-");
    expect(toSlug("mila ", true)).toBe("mila");
  });

  it("leaves a valid address as it is", () => {
    expect(toSlug("mila-xyz-studio")).toBe("mila-xyz-studio");
    expect(toSlug("mila-xyz-studio", true)).toBe("mila-xyz-studio");
  });
});
