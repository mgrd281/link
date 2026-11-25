import type { BlockOf } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

import { EXAMPLES } from "./catalog";
import { RENAMED_EXAMPLES, renamedExampleRedirects } from "./renamed";

const projectSlugs = (slug: string): string[] =>
  (EXAMPLES[slug]?.blocks ?? []).filter((block): block is BlockOf<"project"> => block.type === "project").map((project) => project.slug);

describe("renamed example pages", () => {
  it("lead from an address no page uses any more to a page that exists, in its own language, in one step", () => {
    for (const [old, next] of Object.entries(RENAMED_EXAMPLES)) {
      expect(Object.hasOwn(EXAMPLES, old), old).toBe(false);
      expect(EXAMPLES[next.slug]?.profile.locale, next.slug).toBe(next.locale);
      expect(Object.hasOwn(RENAMED_EXAMPLES, next.slug), next.slug).toBe(false);
    }
  });

  it("are permanent redirects for the page and each project page, from every language", () => {
    expect(renamedExampleRedirects(routing.locales)).toEqual([
      { source: "/:locale(de|en|ar)/p/rana-al-khatib/:rest*", destination: "/ar/p/freya-nilsen/:rest*", permanent: true },
      { source: "/:locale(de|en|ar)/p/naya-aldabbas/:rest*", destination: "/ar/p/elena-novak/:rest*", permanent: true },
    ]);
  });

  it("land on projects that exist: the new pages kept the old project addresses", () => {
    expect(projectSlugs("freya-nilsen")).toEqual(["school-extension", "stairwell-retrofit", "housing-study", "library-competition"]);
    expect(projectSlugs("elena-novak")).toEqual(["accountant-to-analyst", "first-90-days", "cv-is-not-your-story"]);
  });
});
