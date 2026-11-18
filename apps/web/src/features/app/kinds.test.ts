import { blockSchema, type Block } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { KINDS, socialUrl, STARTERS, starterBlocks, type StarterInput } from "./kinds";

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

  it("pasted links still become the right blocks", () => {
    const blocks = build({ kind: "youtube", links: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" });
    expect(blocks.map((block) => block.type)).toEqual(["video"]);
  });
});
