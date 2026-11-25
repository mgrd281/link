import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

import { localePath } from "./locale-path";

describe("an address of ours in a language, as a plain link", () => {
  it("is prefixed as the router's localized link does it (localePrefix always: prefixPathname in next-intl)", () => {
    expect(routing.localePrefix).toBe("always");
    expect(localePath("/", "de")).toBe("/de");
    expect(localePath("/?from=dock", "en")).toBe("/en?from=dock");
    expect(localePath("/signup", "ar")).toBe("/ar/signup");
    expect(localePath("/signup?kind=music&look=nocturne", "de")).toBe("/de/signup?kind=music&look=nocturne");
    expect(localePath("/p/ronja-feldkamp/hafenlicht", "de")).toBe("/de/p/ronja-feldkamp/hafenlicht");
  });
});
