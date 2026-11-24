import { blockSchema, detectLink, hasImage, NO_IMAGE } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { ADD_GROUPS, ADD_PRESETS, ADDABLE, addGroups, blankBlock, blockFromLink, insertAt, presetBlock } from "./blocks";
import { KINDS } from "./kinds";
import { sampleStats, totals } from "./sample-stats";
import { validateBlock } from "./validate";

const defaults = { artist: "Mila Aurel", newsletter: "Get my newsletter" };
const labels = { video: "Video", music: "Music", event: "Events" };

describe("blank blocks", () => {
  it("start a show without a date: no day is made up for the owner", () => {
    const block = blankBlock("events", defaults);
    expect(block.type === "events" ? block.items.map((item) => item.date) : null).toEqual([""]);
  });

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

describe("the Add sheet's groups", () => {
  const sorted = (types: readonly string[]) => [...types].sort();

  it("put every addable type in exactly one fixed group", () => {
    expect(sorted(Object.values(ADD_GROUPS).flat())).toEqual(sorted(ADDABLE));
    expect(ADDABLE).toHaveLength(24);
    expect(new Set(ADDABLE).size).toBe(24);
  });

  it("have a portfolio group: the project first, the way to get in touch last", () => {
    expect(ADD_GROUPS.portfolio).toEqual(["project", "about", "tools", "timeline", "quotes", "contact"]);
    expect(Object.keys(ADD_GROUPS)).toEqual(["links", "media", "sell", "portfolio", "layout"]);
    expect(addGroups("music").map((group) => group.key)).toEqual(["suggested", "links", "media", "sell", "portfolio", "layout"]);
    expect(addGroups("music").find((group) => group.key === "portfolio")?.types).toEqual(["project", "about", "tools", "timeline", "quotes", "contact"]);
  });

  it("offer clients as a preset of the portfolio group: a brands block that starts as names", () => {
    expect(ADD_PRESETS).toEqual({ portfolio: ["clients"] });
    // A preset is no type: the groups above stay a partition of the addable types.
    expect(ADDABLE as string[]).not.toContain("clients");
    const block = presetBlock("clients", { clients: "Kunden" });
    expect(block).toMatchObject({ type: "brands", title: "Kunden", columns: 3, items: [{ name: "" }], visible: true, highlight: false });
    expect(block.type === "brands" && block.items[0] && "logo" in block.items[0]).toBe(false);
    expect(validateBlock(block)).toEqual({ "items.0.name": "required" });
    expect(validateBlock({ ...block, items: [{ name: "A regional utility" }] } as typeof block)).toBeNull();
  });

  it("list every type exactly once for every page kind, and without one", () => {
    for (const kind of [...KINDS, undefined, "constructor", "unknown"]) {
      const groups = addGroups(kind);
      expect(sorted(groups.flatMap((group) => group.types)), String(kind)).toEqual(sorted(ADDABLE));
      expect(groups.every((group) => group.types.length > 0), String(kind)).toBe(true);
    }
  });

  it("start with what the page kind adds most, else with the popular types", () => {
    expect(addGroups("music")[0]).toEqual({ key: "suggested", types: ["music", "video", "events", "socials"] });
    expect(addGroups("other")[0]?.key).toBe("popular");
    expect(addGroups(undefined)[0]?.key).toBe("popular");
  });

  it.each([
    [["designer", "photographer"], ["project", "gallery", "quotes", "contact"]],
    [["developer", "engineer"], ["project", "repo", "tools", "contact"]],
    [["freelancer", "writer", "journalist", "coach", "lawyer", "student"], ["project", "about", "quotes", "contact"]],
  ])("pages that show work start with the project: %s", (kinds, types) => {
    for (const kind of kinds) expect(addGroups(kind)[0], kind).toEqual({ key: "suggested", types });
  });
});

describe("new blocks", () => {
  it("go to the top, or under the social icons when the page starts with them", () => {
    expect(insertAt([])).toBe(0);
    expect(insertAt([blankBlock("link", defaults)])).toBe(0);
    expect(insertAt([blankBlock("socials", defaults), blankBlock("link", defaults)])).toBe(1);
  });
});

describe("adding several blocks at once", () => {
  it("is one step in the history, and one undo takes them all back", async () => {
    const { siteReducer } = await import("./site-context");
    const profile = { username: "mila", displayName: "Mila Aurel", bio: "", avatar: { src: NO_IMAGE, alt: "" }, verified: false, locale: "en" as const };
    const before = { past: [], future: [], selectedId: null, present: { profile, blocks: [blankBlock("socials", defaults)], sizes: {}, theme: { template: "nocturne" as const } } };
    const added = [blankBlock("link", defaults), blankBlock("video", defaults)];
    const after = siteReducer(before, { type: "addMany", blocks: added, index: 1 });
    expect(after.present.blocks.map((block) => block.type)).toEqual(["socials", "link", "video"]);
    expect(after.past).toHaveLength(1);
    expect(after.selectedId).toBe(added[0]?.id);
    expect(siteReducer(after, { type: "undo" }).present.blocks).toHaveLength(1);
    const removed = siteReducer(after, { type: "removeIds", ids: added.map((block) => block.id) });
    expect(removed.present.blocks.map((block) => block.type)).toEqual(["socials"]);
    expect(removed.past).toHaveLength(2);
    // Nothing to remove: no empty step.
    expect(siteReducer(removed, { type: "removeIds", ids: ["gone"] })).toBe(removed);
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

  it("keeps the owner's work layout, the one layout choice stored in the theme, and drops an unknown one", async () => {
    const { parseImport } = await import("./import");
    const { resolveCreatorTheme } = await import("@linkyo/tokens/creator");
    const imported = (theme: Record<string, unknown>) => parseImport(JSON.stringify({ site: { page, theme } }))?.theme ?? {};
    expect(imported({ template: "tiefdruck", projects: "bento", buttonShape: "pill" })).toEqual({ template: "tiefdruck", projects: "bento", buttonShape: "pill" });
    expect(imported({ template: "tiefdruck", projects: "masonry" })).toEqual({ template: "tiefdruck" });
    expect(imported({ projects: 3 })).toEqual({});
    // What comes back resolves to the layout the owner chose, not to the template's own.
    expect(resolveCreatorTheme(imported({ template: "tiefdruck", projects: "bento" })).layout.projects).toBe("bento");
    expect(resolveCreatorTheme({ template: "tiefdruck" }).layout.projects).toBe("list");
  });

  it("refuses anything that isn't a valid page", async () => {
    const { parseImport } = await import("./import");
    expect(parseImport("not json")).toBeNull();
    expect(parseImport(JSON.stringify({ page: { profile: {}, blocks: [] } }))).toBeNull();
    expect(parseImport(JSON.stringify([1, 2]))).toBeNull();
  });
});
