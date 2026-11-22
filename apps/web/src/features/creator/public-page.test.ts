import type { Block, Page } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { filterPublic, loadPublicPage, parseBlocks, parseLegal, parseTheme, toPublicPage } from "./public-page";

const NOW = new Date("2026-11-22T12:00:00Z");
const link = (id: string, extra: Partial<Block> = {}): Block => ({ id, type: "link", title: id, url: `https://example.com/${id}`, visible: true, highlight: false, ...extra }) as Block;

const page = (blocks: Block[]): Page => ({
  profile: { username: "mila", displayName: "Mila", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" },
  blocks,
});

describe("what visitors see", () => {
  it("drops hidden, out-of-schedule and newsletter blocks and keeps the order", () => {
    const blocks: Block[] = [
      link("first"),
      link("hidden", { visible: false }),
      link("later", { schedule: { from: "2026-12-01T00:00:00Z" } }),
      link("over", { schedule: { until: "2026-11-01T00:00:00Z" } }),
      link("running", { schedule: { from: "2026-11-01T00:00:00Z", until: "2026-12-01T00:00:00Z" } }),
      { id: "news", type: "newsletter", title: "Newsletter", visible: true, highlight: false },
      link("last"),
    ];
    expect(filterPublic(page(blocks), NOW).blocks.map((block) => block.id)).toEqual(["first", "running", "last"]);
  });

  it("leaves out a block that does not parse, one by one", () => {
    const raw = [
      { id: "ok", type: "link", title: "Fine", url: "https://example.com" },
      { id: "bad-url", type: "link", title: "Broken", url: "javascript:alert(1)" },
      { id: "unknown", type: "hologram" },
      "not even an object",
      { id: "text", type: "text", text: "Hello" },
    ];
    expect(parseBlocks(raw).map((block) => block.id)).toEqual(["ok", "text"]);
    expect(parseBlocks(null)).toEqual([]);
  });

  it("reads the answer of public_page() and filters it again", () => {
    const answer = {
      page: {
        profile: { username: "mila", displayName: "Mila", bio: "Hi", avatar: { src: "none:", alt: "" }, verified: false, locale: "ar" },
        blocks: [link("a"), link("b", { visible: false }), { id: "x", type: "nope" }],
      },
      theme: { template: "nocturne", accent: "not-a-color", buttonShape: "pill", mode: "dark", pairing: "unknown" },
      legal: { name: "Mila", address: 42 },
      updatedAt: "2026-11-22T10:00:00Z",
    };
    const found = toPublicPage(answer, NOW);
    expect(found?.page.profile.locale).toBe("ar");
    expect(found?.page.blocks.map((block) => block.id)).toEqual(["a"]);
    expect(found?.theme).toEqual({ template: "nocturne", buttonShape: "pill", mode: "dark" });
    expect(found?.legal).toEqual({ name: "Mila", address: "", email: "", phone: "" });
    expect(found?.updatedAt).toBe("2026-11-22T10:00:00Z");
  });

  it("knows no page without a profile it can show", () => {
    expect(toPublicPage(null)).toBeNull();
    expect(toPublicPage({ page: { profile: { username: "x" }, blocks: [] } })).toBeNull();
    expect(toPublicPage({ page: "nope" })).toBeNull();
  });

  it("keeps only theme values the engine knows", () => {
    expect(parseTheme({ accent: "#00454c", tint: 0.4, background: "gradient" })).toEqual({ accent: "#00454c", tint: 0.4, background: "gradient" });
    expect(parseTheme({ tint: 7, background: "lava", preset: "nope" })).toEqual({});
    expect(parseTheme("nope")).toEqual({});
    expect(parseLegal(undefined)).toEqual({ name: "", address: "", email: "", phone: "" });
  });

  it("finds nothing in a demo build (no database to ask)", async () => {
    await expect(loadPublicPage("mila")).resolves.toBeNull();
  });
});
