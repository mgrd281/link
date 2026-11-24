import { hasImage } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import type { Legal } from "@/features/account/types";

import { legalStatus } from "../legal";
import type { SiteDoc } from "../site-context";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { KINDS, PORTFOLIO_KINDS } from "../kinds";
import { ESSENTIALS, HOME_TASKS, homeProgress, homeTasks, homeTasksDone, linkHint, PORTFOLIO_ESSENTIALS, PORTFOLIO_TASKS } from "./progress";

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

const project = (id: string) => ({ id, type: "project", slug: id, title: `Project ${id}`, summary: "A sentence.", visible: true, highlight: false });
const contact = () => ({ id: "c", type: "contact", title: "Let's talk", primary: { label: "E-mail", url: "mailto:hello@example.com" }, visible: true, highlight: false });

describe("home progress on a page that shows work", () => {
  it("offers its work first, then the way to reach its owner, and no '3 things'", () => {
    for (const kind of PORTFOLIO_KINDS) {
      expect(homeTasks({ legal: noLegal, kind })).toEqual(["projects", "contact", "photo", "bio", "look", "legal"]);
    }
    // Every other kind, and a page without one, keeps the link-in-bio steps.
    for (const kind of KINDS.filter((candidate) => !(PORTFOLIO_KINDS as readonly string[]).includes(candidate))) {
      expect(homeTasks({ legal: noLegal, kind })).toEqual(HOME_TASKS);
    }
    expect(homeTasks({ legal: noLegal })).toEqual(HOME_TASKS);
    expect(PORTFOLIO_TASKS).toEqual(["projects", "contact", "photo", "bio", "look", "legal"]);
  });

  it("a designer's fresh page has exactly one first step: three pieces of work", () => {
    const site = { legal: noLegal, kind: "designer" };
    const done = homeTasksDone(doc(), site);
    expect(homeTasks(site).find((key) => !done[key])).toBe("projects");
    expect(homeProgress(doc(), site)).toEqual({ ready: false, complete: false, done: 0, total: 6 });
  });

  it("counts three projects as the work and a contact block as the way in", () => {
    const site = { legal: noLegal, kind: "photographer" };
    expect(homeTasksDone(doc({ blocks: [project("a"), project("b")] }), site).projects).toBe(false);
    expect(homeTasksDone(doc({ blocks: [project("a"), project("b"), project("c")] }), site).projects).toBe(true);
    // Three links are not work.
    expect(homeTasksDone(doc({ blocks: [link("a"), link("b"), link("c")] }), site).projects).toBe(false);
    expect(homeTasksDone(doc({ blocks: [contact()] }), site).contact).toBe(true);
    // After the work, the next step is the contact.
    const done = homeTasksDone(doc({ blocks: [project("a"), project("b"), project("c")] }), site);
    expect(homeTasks(site).find((key) => !done[key])).toBe("contact");
  });

  it("is ready to share with work, a way in, a photo and a bio; complete with a look and a legal notice too", () => {
    const site = { legal: noLegal, kind: "developer" };
    const almost = doc({ blocks: [project("a"), project("b"), project("c")], avatar: "/a.jpg", bio: "Hi" });
    expect(homeProgress(almost, site).ready).toBe(false);
    const ready = doc({ blocks: [project("a"), project("b"), project("c"), contact()], avatar: "/a.jpg", bio: "Hi" });
    expect(homeProgress(ready, site)).toEqual({ ready: true, complete: false, done: 4, total: 6 });
    const all = doc({ blocks: [project("a"), project("b"), project("c"), contact()], avatar: "/a.jpg", bio: "Hi", theme: { template: "werkbogen" } });
    expect(homeProgress(all, { legal: fullLegal, kind: "developer" })).toEqual({ ready: true, complete: true, done: 6, total: 6 });
    expect([...PORTFOLIO_ESSENTIALS]).toEqual(["projects", "contact", "photo", "bio"]);
  });
});

describe("what '3 things' suggests", () => {
  it("fits the kind of page, and every hint has its words in de, en and ar", () => {
    expect(linkHint("music")).toBe("music");
    expect(linkHint("youtube")).toBe("video");
    expect(linkHint("shop")).toBe("sell");
    expect(linkHint("coach")).toBe("business");
    expect(linkHint("writer")).toBe("work");
    expect(linkHint("other")).toBe("other");
    expect(linkHint(undefined)).toBe("other");
    expect(linkHint("toString")).toBe("other");
    for (const messages of [de, en, ar]) {
      const hints = messages.app.home.checklist.linkHints as Record<string, string>;
      for (const kind of [...KINDS, undefined]) expect(hints[linkHint(kind)]).toMatch(/\S/);
    }
  });
});
