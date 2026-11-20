import { pageSchema, type Block } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { EXAMPLES } from "./catalog";
import { LOOKS } from "./looks";

const urls = (block: Block): string[] => {
  switch (block.type) {
    case "link":
    case "card":
    case "video":
    case "product":
      return [block.url];
    case "socials":
    case "events":
      return block.items.map((item) => item.url);
    case "music":
      return block.links.map((item) => item.url);
    case "live":
    case "repo":
      return [block.url];
    case "app":
      return block.stores.map((store) => store.url);
    default:
      return [];
  }
};

describe("example gallery", () => {
  it("has about forty examples, each with a page in its own language", () => {
    const slugs = Object.keys(LOOKS).filter((slug) => slug !== "journalist");
    expect(slugs.length).toBeGreaterThanOrEqual(40);
    for (const slug of slugs) {
      const page = EXAMPLES[slug];
      expect(page, slug).toBeDefined();
      expect(page?.profile.locale, slug).toBe(LOOKS[slug as keyof typeof LOOKS].locale);
    }
  });

  it("every page is valid and links only to example addresses (the people are fictional)", () => {
    for (const [slug, page] of Object.entries(EXAMPLES)) {
      expect(pageSchema.safeParse(page).success, slug).toBe(true);
      expect(page.profile.verified, slug).toBe(false);
      for (const url of page.blocks.flatMap(urls)) {
        expect(url, `${slug}: ${url}`).toMatch(/^(https:\/\/example\.com\/|mailto:[a-z]+@example\.com$|tel:\+49300000000$)/);
      }
      // Install commands too: a fictional page must never install someone's real code.
      for (const block of page.blocks) {
        if (block.type === "repo" && block.install) expect(block.install, slug).toMatch(/^npx skills add https:\/\/example\.com\//);
      }
    }
  });

  it("no two examples share the same look", () => {
    const looks = Object.values(LOOKS).map((look) => JSON.stringify(look.theme));
    expect(new Set(looks).size).toBe(looks.length);
  });
});
