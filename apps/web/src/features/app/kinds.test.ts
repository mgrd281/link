import { blockSchema, type Block } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { isPortfolioKind, KINDS, PORTFOLIO_KINDS, socialUrl, STARTERS, starterBlocks, titleKeys, type CreatorKind, type StarterInput } from "./kinds";

const labels = {
  directions: (address: string) => `Directions: ${address}`,
  call: "Call",
  hours: "Opening hours",
  shop: "Visit the store",
  website: "Website",
  booking: "Book an appointment",
  contact: "Contact",
  book: "My book",
  cv: "My CV",
  newsletter: "Subscribe",
  liveTitle: "Live on TikTok",
  detection: { video: "Video", music: "Music", event: "Event" },
  artist: "Mila",
};

const build = (input: Partial<StarterInput> & Pick<StarterInput, "kind">): Block[] =>
  starterBlocks({ handles: {}, values: {}, switches: {}, links: "", ...input }, labels);

/** The default section titles by kind: the kind, then the variant of its work, tools and quotes title. */
const TITLES: [CreatorKind, string, string, string][] = [
  ["designer", "designer", "designer", "default"],
  ["photographer", "designer", "designer", "default"],
  ["developer", "developer", "developer", "developer"],
  ["engineer", "developer", "developer", "developer"],
  ["student", "developer", "default", "default"],
  ["writer", "writer", "writer", "default"],
  ["journalist", "writer", "writer", "default"],
  ["coach", "coach", "default", "default"],
  ["lawyer", "lawyer", "lawyer", "default"],
  ["freelancer", "default", "default", "default"],
  ["tiktok", "default", "default", "default"],
  ["instagram", "default", "default", "default"],
  ["youtube", "default", "default", "default"],
  ["apps", "default", "default", "default"],
  ["streamer", "default", "default", "default"],
  ["podcast", "default", "default", "default"],
  ["music", "default", "default", "default"],
  ["affiliate", "default", "default", "default"],
  ["store", "default", "default", "default"],
  ["marketing", "default", "default", "default"],
  ["shop", "default", "default", "default"],
  ["business", "default", "default", "default"],
  ["warehouse", "default", "default", "default"],
  ["other", "default", "default", "default"],
];

describe("page kinds in the welcome flow", () => {
  it("gives every kind a template and its own first questions", () => {
    const templates = new Set(KINDS.map((kind) => STARTERS[kind].theme.template));
    expect(templates.size).toBeGreaterThanOrEqual(5);
    expect(STARTERS.shop.fields).toEqual(["address", "phone", "hours"]);
    expect(STARTERS.tiktok.socials[0]).toBe("tiktok");
    expect(STARTERS.youtube.socials[0]).toBe("youtube");
    expect(STARTERS.journalist.socials).toContain("linkedin");
    expect(STARTERS.lawyer.fields).toEqual(["booking", "phone", "email", "address"]);
    expect(STARTERS.student.fields).toContain("cv");
  });

  it("photographers and freelancers start on Werkbogen; designers and developers keep their looks", () => {
    expect(KINDS).toHaveLength(24);
    expect(KINDS.indexOf("photographer")).toBe(KINDS.indexOf("designer") + 1);
    expect(KINDS.indexOf("freelancer")).toBe(KINDS.indexOf("student") - 1);
    expect(STARTERS.photographer).toEqual({ theme: { template: "werkbogen" }, socials: ["instagram", "linkedin", "youtube"], fields: ["website", "booking", "email"], logoFirst: false });
    expect(STARTERS.freelancer).toEqual({ theme: { template: "werkbogen" }, socials: ["linkedin", "instagram", "whatsapp"], fields: ["website", "booking", "email"], logoFirst: false });
    expect(STARTERS.designer.theme).toEqual({ template: "atelier", pairing: "editorial" });
    expect(STARTERS.designer.fields).toEqual(["website", "booking", "email"]);
    expect(STARTERS.developer.theme).toEqual({ template: "nocturne", pairing: "tech", buttonStyle: "outline" });
    expect(STARTERS.developer.fields).toEqual(["website", "cv", "email"]);
    expect(STARTERS.engineer.fields).toEqual(["website", "cv", "email"]);
    expect(PORTFOLIO_KINDS).toEqual(["designer", "photographer", "developer", "engineer", "freelancer"]);
    expect(KINDS.filter((kind) => isPortfolioKind(kind))).toHaveLength(5);
    expect(isPortfolioKind(undefined)).toBe(false);
    // Until the welcome flow asks for work, the new kinds answer today's questions: all valid blocks.
    for (const kind of ["photographer", "freelancer"] as const) {
      const blocks = build({ kind, handles: { instagram: "ronja.feldkamp", linkedin: "ronja-feldkamp" }, values: { website: "example.com", booking: "example.com/termin", email: "hallo@example.com" } });
      expect(blocks.map((block) => block.type), kind).toEqual(["socials", "link", "link", "link"]);
      for (const block of blocks) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    }
  });

  it.each(TITLES)("section titles of %s: work.%s, tools.%s, quotes.%s", (kind, work, tools, quotes) => {
    expect(titleKeys(kind)).toEqual({
      work: `titles.work.${work}`,
      tools: `titles.tools.${tools}`,
      quotes: `titles.quotes.${quotes}`,
      timeline: "titles.timeline.default",
      about: "titles.about.default",
      clients: "titles.clients.default",
    });
  });

  it("section titles: the table above names every kind, every key is a message in all three languages", async () => {
    expect(titleKeys(undefined).work).toBe("titles.work.default");
    expect(TITLES.map(([kind]) => kind).sort()).toEqual([...KINDS].sort());
    for (const locale of ["de", "en", "ar"]) {
      const messages = ((await import(`../../messages/${locale}.json`)) as { default: { app: { portfolio: { titles: Record<string, Record<string, string>> } } } }).default.app.portfolio.titles;
      for (const kind of KINDS) {
        for (const key of Object.values<string>({ ...titleKeys(kind) })) {
          const [, section = "", variant = ""] = key.split(".");
          expect(messages[section]?.[variant], `${locale} ${key}`).toEqual(expect.any(String));
        }
      }
    }
  });

  it("a shop gets directions, a call button and opening hours — all valid blocks", () => {
    const blocks = build({
      kind: "shop",
      handles: { instagram: "@cafe.rosa", whatsapp: "+49 170 1234567" },
      values: { address: "Hauptstraße 5, Berlin", phone: "+49 30 123 456", hours: "Mo–Fr 8–18" },
    });
    expect(blocks.map((block) => block.type)).toEqual(["socials", "link", "link", "header", "text"]);
    for (const block of blocks) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    const [socials, directions, call] = blocks;
    expect(socials?.type === "socials" && socials.items.map((item) => item.url)).toEqual(["https://instagram.com/cafe.rosa", "https://wa.me/491701234567"]);
    expect(directions?.type === "link" && [directions.title, directions.url, directions.highlight]).toEqual([
      "Directions: Hauptstraße 5, Berlin",
      "https://www.google.com/maps/search/?api=1&query=Hauptstra%C3%9Fe%205%2C%20Berlin",
      true,
    ]);
    expect(call?.type === "link" && call.url).toBe("tel:+4930123456");
  });

  it("affiliate links are labelled as ads when the creator says so, and only then", () => {
    const links = "https://shop.example.com/products/headphones\nhttps://partner.example.com/deal";
    const labelled = build({ kind: "affiliate", links, switches: { affiliate: true } });
    const ads = labelled.filter((block) => block.type === "product" || block.type === "card" || block.type === "link");
    expect(ads.length).toBe(2);
    for (const block of ads) {
      expect("affiliate" in block && block.affiliate, block.type).toBe(true);
      expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    }
    expect(build({ kind: "affiliate", links }).some((block) => "affiliate" in block && block.affiliate === true)).toBe(false);
    // Other kinds have no affiliate switch, so it cannot label their links by accident.
    expect(build({ kind: "store", links, switches: { affiliate: true } }).some((block) => "affiliate" in block && block.affiliate === true)).toBe(false);
  });

  it("developers start with GitHub, streamers with Twitch and Discord", () => {
    expect(STARTERS.developer.socials[0]).toBe("github");
    expect(socialUrl("github", "@leonpark")).toBe("https://github.com/leonpark");
    expect(STARTERS.streamer.socials.slice(0, 2)).toEqual(["twitch", "discord"]);
    expect(socialUrl("twitch", "novaplays")).toBe("https://twitch.tv/novaplays");
    const blocks = build({ kind: "developer", handles: { github: "leonpark" }, values: { cv: "example.com/cv.pdf" } });
    for (const block of blocks) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
  });

  it("a TikToker who goes live gets a live card for their channel", () => {
    const blocks = build({ kind: "tiktok", handles: { tiktok: "https://www.tiktok.com/@nizarals9?_r=1" }, switches: { tiktokLive: true } });
    const live = blocks.find((block) => block.type === "live");
    expect(live?.type === "live" && [live.platform, live.channel, live.url, live.isLive]).toEqual(["tiktok", "nizarals9", "https://www.tiktok.com/@nizarals9/live", false]);
    expect(build({ kind: "tiktok", switches: { tiktokLive: true } }).some((block) => block.type === "live")).toBe(false);
  });

  it("skips what was left empty or is not usable", () => {
    expect(build({ kind: "business", values: { email: "not-an-email", website: " " } })).toEqual([]);
    expect(build({ kind: "writer", switches: { newsletter: true } }).map((block) => block.type)).toEqual(["newsletter"]);
    expect(socialUrl("whatsapp", "12")).toBeNull();
  });

  it("app explainers start in Aura; store links become app cards and GitHub links skills, all valid", () => {
    expect(STARTERS.apps.theme.template).toBe("aura");
    expect(STARTERS.apps.socials[0]).toBe("tiktok");
    const blocks = build({
      kind: "apps",
      links: "https://apps.apple.com/de/app/fokus-timer/id1234567890\nhttps://play.google.com/store/apps/details?id=com.example.schlafwelle\nhttps://github.com/acme/agent-skills/tree/main/skills/brand-voice",
    });
    expect(blocks.map((block) => block.type)).toEqual(["app", "app", "repo"]);
    for (const block of blocks) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    const [apple, google, skill] = blocks;
    expect(apple?.type === "app" && [apple.title, apple.stores]).toEqual(["Fokus Timer", [{ store: "appstore", url: "https://apps.apple.com/de/app/fokus-timer/id1234567890" }]]);
    expect(google?.type === "app" && [google.title, google.stores[0]?.store]).toEqual(["Schlafwelle", "googleplay"]);
    expect(skill?.type === "repo" && [skill.owner, skill.repo, skill.path, skill.kind, skill.install]).toEqual([
      "acme",
      "agent-skills",
      "skills/brand-voice",
      "skill",
      "npx skills add acme/agent-skills --skill brand-voice",
    ]);
  });

  it("pasted links still become the right blocks", () => {
    const blocks = build({ kind: "youtube", links: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" });
    expect(blocks.map((block) => block.type)).toEqual(["video"]);
  });
});
