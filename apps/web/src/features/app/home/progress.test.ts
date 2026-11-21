import { hasImage } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import type { Legal } from "@/features/account/types";

import { legalStatus } from "../legal";
import type { SiteDoc } from "../site-context";
import { ESSENTIALS, HOME_TASKS, homeProgress, homeTasksDone } from "./progress";

type Doc = Pick<SiteDoc, "blocks" | "profile" | "theme">;
type Blocks = SiteDoc["blocks"];

/** HomeScreen's inline logic before it moved to progress.ts, copied verbatim as the reference. */
function before(doc: Doc, site: { legal: Legal }) {
  const essentials = new Set(["links", "photo", "bio"]);
  const contentBlocks = doc.blocks.filter((block) => block.type !== "header" && block.type !== "divider");
  const tasks = [
    { key: "links", done: contentBlocks.length >= 3 },
    { key: "photo", done: hasImage(doc.profile.avatar) || hasImage(doc.profile.hero) },
    { key: "bio", done: doc.profile.bio.trim().length > 0 },
    { key: "socials", done: doc.blocks.some((block) => block.type === "socials" && block.items.some((item) => item.url)) },
    { key: "look", done: Object.keys(doc.theme).some((key) => key !== "template") || doc.theme.template !== "nocturne" },
    { key: "legal", done: legalStatus(site.legal) === "complete" },
  ];
  const done = tasks.filter((task) => task.done).length;
  return { ready: tasks.every((task) => task.done || !essentials.has(task.key)), complete: done === tasks.length, done, total: tasks.length };
}

const link = (id: string) => ({ id, type: "link", title: `Link ${id}`, url: "https://example.com", visible: true, highlight: false });
const header = (id: string) => ({ id, type: "header", title: "Tour", visible: true, highlight: false });
const divider = (id: string) => ({ id, type: "divider", visible: true, highlight: false });
const socials = (url: string) => ({ id: "s", type: "socials", items: [{ platform: "instagram", url }], visible: true, highlight: false });

const noLegal: Legal = { name: "", address: "", email: "", phone: "" };
const fullLegal: Legal = { name: "Mila Aurel", address: "Musterstraße 1\n10115 Berlin", email: "hallo@mila.de", phone: "" };

function doc({ blocks = [], avatar = "", hero = "", bio = "", theme = { template: "nocturne" } }: { blocks?: unknown[]; avatar?: string; hero?: string; bio?: string; theme?: Record<string, unknown> } = {}): Doc {
  return {
    blocks: blocks as Blocks,
    profile: { displayName: "Mila", bio, avatar: avatar ? { src: avatar, alt: "" } : undefined, hero: hero ? { src: hero, alt: "" } : undefined } as unknown as Doc["profile"],
    theme,
  };
}

describe("home progress", () => {
  it("a fresh page is neither ready nor complete", () => {
    expect(homeProgress(doc(), { legal: noLegal })).toEqual({ ready: false, complete: false, done: 0, total: 6 });
  });

  it("is ready once the three essentials are there: three content blocks, a photo and a bio", () => {
    const essentials = doc({ blocks: [link("a"), link("b"), link("c")], avatar: "/a.jpg", bio: "Hi" });
    expect(homeProgress(essentials, { legal: noLegal })).toMatchObject({ ready: true, complete: false, done: 3 });
    // Headers and dividers are not content: two links and a header are not enough.
    const short = doc({ blocks: [link("a"), link("b"), header("h"), divider("d")], avatar: "/a.jpg", bio: "Hi" });
    expect(homeProgress(short, { legal: noLegal }).ready).toBe(false);
    // A cover photo counts as the photo; a blank bio does not count.
    expect(homeProgress(doc({ blocks: [link("a"), link("b"), link("c")], hero: "/h.jpg", bio: "Hi" }), { legal: noLegal }).ready).toBe(true);
    expect(homeProgress(doc({ blocks: [link("a"), link("b"), link("c")], avatar: "/a.jpg", bio: "  " }), { legal: noLegal }).ready).toBe(false);
  });

  it("is complete only with every step: socials with an address, an own look and a complete legal notice", () => {
    const all = doc({ blocks: [link("a"), link("b"), link("c"), socials("https://instagram.com/mila")], avatar: "/a.jpg", bio: "Hi", theme: { template: "daylight" } });
    expect(homeProgress(all, { legal: fullLegal })).toEqual({ ready: true, complete: true, done: 6, total: 6 });
    expect(homeProgress(all, { legal: noLegal }).complete).toBe(false);
    const emptySocials = doc({ blocks: [link("a"), link("b"), link("c"), socials("")], avatar: "/a.jpg", bio: "Hi", theme: { template: "daylight" } });
    expect(homeTasksDone(emptySocials, { legal: fullLegal }).socials).toBe(false);
  });

  it("the look counts as done with any choice besides the default template", () => {
    expect(homeTasksDone(doc(), { legal: noLegal }).look).toBe(false);
    expect(homeTasksDone(doc({ theme: { template: "nocturne", accent: "#112233" } }), { legal: noLegal }).look).toBe(true);
    expect(homeTasksDone(doc({ theme: { template: "marquee" } }), { legal: noLegal }).look).toBe(true);
  });

  it("matches the old inline logic for every combination of steps", () => {
    const options = {
      blocks: [[], [link("a"), link("b")], [link("a"), header("h"), link("b"), link("c")], [link("a"), link("b"), link("c"), socials("https://x.com/m")], [socials("https://x.com/m")]],
      avatar: ["", "/a.jpg"],
      hero: ["", "/h.jpg"],
      bio: ["", "Hello"],
      theme: [{ template: "nocturne" }, { template: "pulse" }, { template: "nocturne", mode: "dark" }],
      legal: [noLegal, fullLegal],
    };
    let cases = 0;
    for (const blocks of options.blocks)
      for (const avatar of options.avatar)
        for (const hero of options.hero)
          for (const bio of options.bio)
            for (const theme of options.theme)
              for (const legal of options.legal) {
                const page = doc({ blocks, avatar, hero, bio, theme });
                expect(homeProgress(page, { legal })).toEqual(before(page, { legal }));
                cases += 1;
              }
    expect(cases).toBe(240);
  });

  it("keeps the steps in their order, with links, photo and bio as the essentials", () => {
    expect(HOME_TASKS).toEqual(["links", "photo", "bio", "socials", "look", "legal"]);
    expect([...ESSENTIALS]).toEqual(["links", "photo", "bio"]);
  });
});
