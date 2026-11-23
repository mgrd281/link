import type { BlockOf } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { describeStart } from "../directions/poster/live";
import { nextBerlinTime, previewPage } from "./registry";

describe("nextBerlinTime", () => {
  it("is tonight before the hour and tomorrow after it, in winter and in summer", () => {
    // 18 Nov 2026, 10:00 Berlin (UTC+1) → 21:00 Berlin = 20:00 UTC the same day.
    expect(nextBerlinTime(21, new Date("2026-11-18T09:00:00Z"))).toBe("2026-11-18T20:00:00.000Z");
    // 18 Nov 2026, 22:30 Berlin → tomorrow.
    expect(nextBerlinTime(21, new Date("2026-11-18T21:30:00Z"))).toBe("2026-11-19T20:00:00.000Z");
    // 1 Jul 2026, 12:00 Berlin (UTC+2) → 19:00 UTC.
    expect(nextBerlinTime(21, new Date("2026-07-01T10:00:00Z"))).toBe("2026-07-01T19:00:00.000Z");
  });

  it("gives Nizar's YouTube live tonight's time; the TikTok live stays live", () => {
    const found = previewPage("nizar", "de", new Date("2026-11-18T09:00:00Z"));
    const lives = found?.page.blocks.filter((block): block is BlockOf<"live"> => block.type === "live") ?? [];
    expect(lives.map((block) => [block.platform, block.isLive, block.startsAt])).toEqual([
      ["tiktok", true, undefined],
      ["youtube", false, "2026-11-18T20:00:00.000Z"],
    ]);
    expect(previewPage("nizar", "en")).toBeNull();
  });
});

describe("describeStart", () => {
  const start = "2026-11-18T20:00:00.000Z";
  it("says today / tomorrow and how long until it starts", () => {
    const today = describeStart(start, new Date("2026-11-18T17:00:00Z").getTime(), "en");
    expect(today.state).toBe("upcoming");
    expect(today.label).toMatch(/^Today, /);
    expect(today.relative).toBe("in 3 hr.");
    expect(describeStart(start, new Date("2026-11-17T17:00:00Z").getTime(), "de").label).toMatch(/^Morgen, /);
    expect(describeStart(start, new Date("2026-11-18T20:30:00Z").getTime(), "en").state).toBe("started");
    expect(describeStart(start, new Date("2026-11-19T01:00:00Z").getTime(), "en").state).toBe("past");
  });

  it("shows the creator's time on the server", () => {
    expect(describeStart(start, null, "de").label).toMatch(/21:00$/);
  });
});

describe("renamed addresses", () => {
  it("sends the old Arabic perfume shop address to its new one, which exists", async () => {
    const { PREVIEW_ALIASES } = await import("./registry");
    const { EXAMPLES } = await import("../examples/catalog");
    expect(PREVIEW_ALIASES["rihana-store"]).toBe("oud-boutique");
    expect(EXAMPLES["oud-boutique"]).toBeDefined();
    expect(EXAMPLES["rihana-store"]).toBeUndefined();
  });
});

describe("Sevag's application page", () => {
  it("is valid, German only, labelled as made from his own details, and reserves no address", async () => {
    const { pageSchema } = await import("@linkyo/blocks");
    const { SEVAG_SLUG } = await import("./sevag");
    const found = previewPage(SEVAG_SLUG, "de");
    expect(found).not.toBeNull();
    expect(pageSchema.safeParse(found?.page).success).toBe(true);
    expect(previewPage(SEVAG_SLUG, "en")).toBeNull();
    expect(found?.preview.fromOwner).toBe(true);
    // No e-mail yet: nobody can take the page over, and his address stays free for him.
    expect(found?.preview.invite).toBeUndefined();
    expect(found?.page.profile.hero?.src).toBe(`/prepared/${SEVAG_SLUG}/schubmast.jpg`);
    // The motion graphic is served from our own origin, like every sample clip (no third party).
    expect(found?.page.profile.motion?.src).toBe("sample:motion-sevag-lagerarbeit");
  });
});
