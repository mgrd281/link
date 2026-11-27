import { describe, expect, it } from "vitest";

import { previewPage } from "./registry";

describe("previewPage", () => {
  it("knows only its own prepared pages: names an object inherits are no page", () => {
    for (const slug of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf", "isPrototypeOf"]) {
      expect(() => previewPage(slug, "de"), slug).not.toThrow();
      expect(previewPage(slug, "de"), slug).toBeNull();
    }
    // A page's languages likewise: "constructor" is no language.
    expect(previewPage("jonas-brandt", "constructor")).toBeNull();
    expect(previewPage("jonas-brandt", "de")?.page.profile.displayName).toBe("Jonas Brandt");
  });
});
