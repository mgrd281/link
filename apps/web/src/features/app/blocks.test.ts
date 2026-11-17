import { blockSchema, detectLink, hasImage, NO_IMAGE } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { ADDABLE, blankBlock, blockFromLink } from "./blocks";
import { sampleStats, totals } from "./sample-stats";
import { validateBlock } from "./validate";

const defaults = { artist: "Mila Aurel", newsletter: "Get my newsletter" };
const labels = { video: "Video", music: "Music", event: "Events" };

describe("blank blocks", () => {
  it("exist for every addable type and need the creator's input before they are valid", () => {
    for (const type of ADDABLE) {
      const block = blankBlock(type, defaults);
      expect(block.type).toBe(type);
      const valid = validateBlock(block) === null;
      // Only blocks without required content are valid right away.
      expect(valid, type).toBe(type === "divider" || type === "newsletter");
    }
  });

  it("ask for a picture where the block is the picture", () => {
    expect(validateBlock(blankBlock("image", defaults))).toEqual({ "image.src": "imageRequired" });
    expect(validateBlock(blankBlock("gallery", defaults))).toMatchObject({ images: "atLeastOne" });
  });

  it("get unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => blankBlock("link", defaults).id));
    expect(ids.size).toBe(50);
  });
});

describe("pasted links", () => {
  it("never carry sample pictures onto a creator's page", () => {
    for (const url of ["https://www.youtube.com/watch?v=aqz-KE-bpKQ", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "https://shop.example.com/products/vinyl"]) {
      const detection = detectLink(url);
      expect(detection).not.toBeNull();
      if (!detection) continue;
      const block = blockFromLink(detection, labels, "Mila Aurel");
      expect(JSON.stringify(block)).not.toContain("sample:");
      expect(blockSchema.safeParse(block).success).toBe(true);
      if (block.type === "music") {
        expect(block.artist).toBe("Mila Aurel");
        expect(block.cover.src).toBe(NO_IMAGE);
        expect(hasImage(block.cover)).toBe(false);
      }
    }
  });
});

describe("sample analytics", () => {
  const blocks = [blankBlock("link", defaults), { ...blankBlock("music", defaults), highlight: true }];
  it("are stable per page and range", () => {
    const today = new Date("2026-11-17T12:00:00Z");
    expect(sampleStats("mila", blocks, 30, today)).toEqual(sampleStats("mila", blocks, 30, today));
    expect(sampleStats("mila", blocks, 7, today).days).toHaveLength(7);
  });

  it("add up: clicks never exceed views, shares sum to one", () => {
    const stats = sampleStats("mila", blocks, 90);
    const sum = totals(stats.days);
    expect(sum.clicks).toBeLessThan(sum.views);
    expect(stats.sources.reduce((total, source) => total + source.share, 0)).toBeCloseTo(1);
    expect(stats.sources.map((source) => source.share)).toEqual([...stats.sources.map((source) => source.share)].sort((a, b) => b - a));
  });
});

describe("import", () => {
  const page = {
    profile: { username: "someone", displayName: "Nizar", bio: "", avatar: { src: NO_IMAGE, alt: "" }, verified: false, locale: "ar" },
    blocks: [{ id: "a", type: "link", visible: true, highlight: false, title: "Booking", url: "mailto:hello@example.com" }],
  };

  it("reads an export file and a bare page, keeping only known theme settings", async () => {
    const { parseImport } = await import("./import");
    const fromExport = parseImport(JSON.stringify({ exportedAt: "x", site: { page, theme: { template: "nocturne", evil: "<script>", tint: 3 }, legal: { name: "N" } } }));
    expect(fromExport?.page.profile.displayName).toBe("Nizar");
    expect(fromExport?.theme).toEqual({ template: "nocturne" });
    expect(fromExport?.legal).toEqual({ name: "N", address: "", email: "", phone: "" });
    expect(parseImport(JSON.stringify({ page, theme: {} }))?.page.blocks).toHaveLength(1);
  });

  it("refuses anything that isn't a valid page", async () => {
    const { parseImport } = await import("./import");
    expect(parseImport("not json")).toBeNull();
    expect(parseImport(JSON.stringify({ page: { profile: {}, blocks: [] } }))).toBeNull();
    expect(parseImport(JSON.stringify([1, 2]))).toBeNull();
  });
});
