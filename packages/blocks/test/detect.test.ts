import { describe, expect, it } from "vitest";

import { detectLink, detectMany, normalizeUrl } from "../src/detect";
import { blockSchema, isBlockActive, profileSchema } from "../src/schema";

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
    ["https://www.linkedin.com/in/lukas-weber", "link", "linkedin", undefined],
    ["https://github.com/leonpark", "link", "github", undefined],
    ["https://github.com/vercel-labs/agent-skills", "repo", "github", "vercel-labs/agent-skills"],
    ["https://github.com/anthropics/skills/tree/main/skills/pdf", "repo", "github", "anthropics/skills/skills/pdf"],
    ["https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md", "repo", "github", "anthropics/skills/skills/pdf"],
    ["https://github.com/orgs/linkyo/repositories", "link", "github", undefined],
    ["https://apps.apple.com/de/app/fokus-timer/id1234567890", "app", "appstore", "1234567890"],
    ["https://play.google.com/store/apps/details?id=com.example.fokus&hl=de", "app", "googleplay", "com.example.fokus"],
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
    // A profile address with "@" and a dot in the handle is a link, not an e-mail.
    expect(normalizeUrl("https://www.tiktok.com/@lio.vance")?.toString()).toBe("https://www.tiktok.com/@lio.vance");
    expect(normalizeUrl("tiktok.com/@name.x")?.protocol).toBe("https:");
    expect(normalizeUrl("hello@milaaurel.com")?.protocol).toBe("mailto:");
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
  it("validates an app with its stores and a skill with its install command", () => {
    const app = blockSchema.parse({
      id: "a1",
      type: "app",
      title: "Fokus",
      icon: { src: "sample:app-fokus", alt: "" },
      rating: 4.7,
      pricing: "freemium",
      stores: [
        { store: "appstore", url: "https://apps.apple.com/de/app/fokus/id1" },
        { store: "googleplay", url: "https://play.google.com/store/apps/details?id=a.b" },
      ],
      code: "NORA20",
    });
    expect(app.type).toBe("app");
    expect(blockSchema.safeParse({ ...app, stores: [] }).success).toBe(false);
    expect(blockSchema.safeParse({ ...app, rating: 6 }).success).toBe(false);
    const skill = blockSchema.parse({
      id: "r1",
      type: "repo",
      title: "brand-voice",
      url: "https://github.com/theo/skills/tree/main/brand-voice",
      owner: "theo",
      repo: "skills",
      path: "brand-voice",
      kind: "skill",
      stars: 1280,
      install: "npx skills add theo/skills --skill brand-voice",
    });
    expect(skill.type).toBe("repo");
  });

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

  it("links take an optional icon from the curated set and a short second line", () => {
    const link = { id: "l1", type: "link", title: "Book a call", url: "https://cal.com/hanna" };
    expect(blockSchema.safeParse({ ...link, icon: "calendar", subtitle: "20 min · free" }).success).toBe(true);
    expect(blockSchema.safeParse({ ...link, icon: "skull" }).success).toBe(false);
    expect(blockSchema.safeParse({ ...link, subtitle: "x".repeat(81) }).success).toBe(false);
  });

  it("videos play on the page, as a short preview, or on the platform", () => {
    const video = { id: "v1", type: "video", title: "Clip", provider: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", poster: { src: "x.jpg", alt: "" } };
    for (const playback of ["inline", "preview", "external"]) expect(blockSchema.safeParse({ ...video, playback }).success, playback).toBe(true);
    expect(blockSchema.safeParse({ ...video, playback: "loop" }).success).toBe(false);
  });

  it("a profile can carry a moving picture next to its photo", () => {
    const profile = { username: "mila", displayName: "Mila", bio: "", avatar: { src: "a.jpg", alt: "" }, locale: "de" };
    expect(profileSchema.safeParse({ ...profile, motion: { src: "https://cdn.example.com/mila.mp4" } }).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, motion: { src: "" } }).success).toBe(false);
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
