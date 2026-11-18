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
    const found = previewPage("nizar-m3e8dw", "de", new Date("2026-11-18T09:00:00Z"));
    const lives = found?.page.blocks.filter((block): block is BlockOf<"live"> => block.type === "live") ?? [];
    expect(lives.map((block) => [block.platform, block.isLive, block.startsAt])).toEqual([
      ["tiktok", true, undefined],
      ["youtube", false, "2026-11-18T20:00:00.000Z"],
    ]);
    expect(previewPage("nizar-m3e8dw", "en")).toBeNull();
  });
});

describe("describeStart", () => {
  const start = "2026-11-18T20:00:00.000Z";
  it("says today / tomorrow and how long until it starts", () => {
    const today = describeStart(start, new Date("2026-11-18T17:00:00Z").getTime(), "en");
    expect(today.state).toBe("upcoming");
    expect(today.label).toMatch(/^Today, /);
    expect(today.relative).toBe("in 3 hours");
    expect(describeStart(start, new Date("2026-11-17T17:00:00Z").getTime(), "de").label).toMatch(/^Morgen, /);
    expect(describeStart(start, new Date("2026-11-18T20:30:00Z").getTime(), "en").state).toBe("started");
    expect(describeStart(start, new Date("2026-11-19T01:00:00Z").getTime(), "en").state).toBe("past");
  });

  it("shows the creator's time on the server", () => {
    expect(describeStart(start, null, "de").label).toMatch(/21:00$/);
  });
});
