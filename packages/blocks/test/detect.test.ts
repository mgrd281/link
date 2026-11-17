import { describe, expect, it } from "vitest";

import { detectLink, detectMany, normalizeUrl } from "../src/detect";
import { blockSchema, isBlockActive } from "../src/schema";

describe("detectLink", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc", "video", "youtube", "dQw4w9WgXcQ"],
    ["youtu.be/dQw4w9WgXcQ", "video", "youtube", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/abc123", "video", "youtube", "abc123"],
    ["https://www.youtube.com/@milaaurel", "shorts", "youtube", "@milaaurel"],
    ["https://music.youtube.com/watch?v=x", "music", "youtubemusic", undefined],
    ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "music", "spotify", "4uLU6hMCjMI75M1A2tKUQC"],
    ["https://music.apple.com/de/album/x/123", "music", "applemusic", undefined],
    ["https://soundcloud.com/mila/nachtstrom", "music", "soundcloud", undefined],
    ["https://milaaurel.bandcamp.com/album/nachtstrom", "music", "bandcamp", undefined],
    ["https://www.tiktok.com/@mila/video/7234", "video", "tiktok", "7234"],
    ["https://www.instagram.com/reel/Cx12/", "video", "instagram", "Cx12"],
    ["https://instagram.com/milaaurel", "link", "instagram", undefined],
    ["https://www.twitch.tv/milaaurel", "live", "twitch", "milaaurel"],
    ["https://www.eventim.de/event/mila-aurel-123", "events", "eventim", undefined],
    ["https://shop.example.com/products/nachtstrom-vinyl", "product", "shopify", undefined],
    ["https://cdn.example.com/press/photo.jpg", "image", "image", undefined],
    ["https://example.com/presskit.pdf", "link", "pdf", undefined],
    ["https://wa.me/4915112345678", "link", "whatsapp", undefined],
    ["hello@milaaurel.com", "link", "email", undefined],
    ["+49 151 1234 5678", "link", "phone", undefined],
    ["https://milaaurel.com/about", "card", "website", undefined],
  ])("%s → %s (%s)", (input, type, platform, id) => {
    const detection = detectLink(input);
    expect(detection?.type).toBe(type);
    expect(detection?.platform).toBe(platform);
    if (id) expect(detection?.id).toBe(id);
  });

  it("strips tracking parameters and upgrades to https", () => {
    expect(normalizeUrl("http://example.com/a?utm_source=ig&x=1&fbclid=2")?.toString()).toBe("https://example.com/a?x=1");
  });

  it("rejects things that are not links", () => {
    expect(detectLink("just some words")).toBeNull();
    expect(detectLink("javascript:alert(1)")).toBeNull();
    expect(detectLink("")).toBeNull();
  });

  it("bulk-detects pasted lists without duplicates", () => {
    const text = "https://youtu.be/a1\nhttps://open.spotify.com/track/b2, https://youtu.be/a1 milaaurel.com";
    expect(detectMany(text).map((d) => d.type)).toEqual(["video", "music", "card"]);
  });
});

describe("block schema", () => {
  it("validates a link block and applies defaults", () => {
    const block = blockSchema.parse({ id: "1", type: "link", title: "Tickets", url: "https://example.com" });
    expect(block.visible).toBe(true);
    expect(block.highlight).toBe(false);
  });

  it("treats a missing affiliate flag as not an ad and keeps it when set (ad label)", () => {
    const plain = blockSchema.parse({ id: "1", type: "link", title: "Shop", url: "https://example.com" });
    const ad = blockSchema.parse({ id: "2", type: "link", title: "Gear", url: "https://example.com", affiliate: true });
    expect(plain.type === "link" && plain.affiliate === true).toBe(false);
    expect(ad.type === "link" && ad.affiliate).toBe(true);
  });

  it("validates brand tiles (2 or 3 columns) and event show names with a 24 h time", () => {
    const brands = blockSchema.parse({ id: "b", type: "brands", items: [{ name: "Werk 9", logo: { src: "logo.png", alt: "Werk 9" } }] });
    expect(brands.type === "brands" && brands.columns).toBe(3);
    expect(() => blockSchema.parse({ id: "b", type: "brands", columns: 4, items: [{ name: "x", logo: { src: "l", alt: "" } }] })).toThrow();
    const event = { date: "2026-12-05", city: "Berlin", venue: "Club", url: "https://t.example.com", status: "onsale" };
    expect(() => blockSchema.parse({ id: "e", type: "events", items: [{ ...event, name: "Release night", time: "20:30" }] })).not.toThrow();
    expect(() => blockSchema.parse({ id: "e", type: "events", items: [{ ...event, time: "8pm" }] })).toThrow();
  });

  it("rejects unsafe URLs", () => {
    expect(() => blockSchema.parse({ id: "1", type: "link", title: "x", url: "javascript:alert(1)" })).toThrow();
  });

  it("respects visibility and schedule", () => {
    const base = { id: "1", type: "header" as const, title: "Tour", highlight: false };
    expect(isBlockActive({ ...base, visible: false })).toBe(false);
    expect(isBlockActive({ ...base, visible: true, schedule: { until: "2020-01-01T00:00:00Z" } })).toBe(false);
    expect(isBlockActive({ ...base, visible: true, schedule: { from: "2020-01-01T00:00:00Z" } })).toBe(true);
  });
});
