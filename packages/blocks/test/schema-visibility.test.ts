import { describe, expect, it } from "vitest";

import { pageSchema, profileSchema, SEARCH_DESCRIPTION_MAX, SEARCH_TITLE_MAX, visibilitySchema } from "../src/schema";

const avatar = { src: "/a.jpg", alt: "" };
const profile = { username: "mila", displayName: "Mila", bio: "Hi", avatar, locale: "de" as const };

/** D-09: the visibility settings live in the page document, on the profile. */
describe("the page's visibility settings", () => {
  it("are optional: every page saved before keeps its meaning (on, shown to search engines, default texts)", () => {
    const parsed = pageSchema.parse({ profile, blocks: [] });
    expect(parsed.profile.visibility).toBeUndefined();
  });

  it("keep a pause, the search switch, a title and a description", () => {
    const visibility = { paused: true, search: false, title: "Mila – Fotografie in Köln", description: "Hochzeiten, Porträts und Reportagen." };
    expect(profileSchema.parse({ ...profile, visibility }).visibility).toEqual(visibility);
  });

  it("allow a search title of 60 and a description of 160 characters, not more", () => {
    expect(SEARCH_TITLE_MAX).toBe(60);
    expect(SEARCH_DESCRIPTION_MAX).toBe(160);
    expect(visibilitySchema.parse({ title: "t".repeat(60), description: "d".repeat(160) })).toEqual({ title: "t".repeat(60), description: "d".repeat(160) });
    // Too long: that field alone is dropped, the default text shows instead.
    expect(visibilitySchema.parse({ title: "t".repeat(61), description: "d".repeat(161), paused: true })).toEqual({ paused: true });
  });

  it("drop a bad field on its own and never fail the profile, so a page cannot go down over a setting", () => {
    const parsed = profileSchema.safeParse({ ...profile, visibility: { paused: "yes", search: 0, title: 12, description: null } });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.visibility).toEqual({});
    const odd = profileSchema.safeParse({ ...profile, visibility: "paused" });
    expect(odd.success).toBe(true);
    expect(odd.data?.visibility).toBeUndefined();
    expect(odd.data?.displayName).toBe("Mila");
  });
});
