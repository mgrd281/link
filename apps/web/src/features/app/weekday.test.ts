import { describe, expect, it } from "vitest";

import { weekdayLong, weekdayName } from "./weekday";

/** One week, Monday 23 to Sunday 29 November 2026 (UTC, as the week chart reads its days). */
const WEEK = Array.from({ length: 7 }, (_, offset) => new Date(Date.UTC(2026, 10, 23 + offset)).toISOString());

describe("the day names under the week chart", () => {
  it("gives German two letters per day, and none twice (the single letters D F S S M D M read as a puzzle)", () => {
    const names = WEEK.map((day) => weekdayName(day, "de"));
    expect(names).toEqual(["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]);
    expect(new Set(names).size).toBe(7);
  });

  it("gives English its three-letter names", () => {
    expect(WEEK.map((day) => weekdayName(day, "en"))).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("gives Arabic the names of the days, one each", () => {
    const names = WEEK.map((day) => weekdayName(day, "ar"));
    expect(new Set(names).size).toBe(7);
    // Never a lone letter.
    for (const name of names) expect(name.length, name).toBeGreaterThan(2);
  });

  it("writes the Arabic days without their article, as calendars do, so seven fit at 360 px (leftover 2)", () => {
    expect(WEEK.map((day) => weekdayName(day, "ar"))).toEqual(["اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت", "أحد"]);
    // The whole name stays for screen readers.
    expect(weekdayLong(WEEK[0] ?? "", "ar")).toBe("الاثنين");
  });

  it("reads a day in UTC, whatever the machine's zone is", () => {
    const zone = process.env.TZ;
    // Midnight UTC is still the day before in New York (Sonntag there); the chart's days are UTC dates.
    process.env.TZ = "America/New_York";
    try {
      expect(weekdayName("2026-11-23T00:00:00.000Z", "de")).toBe("Mo");
      expect(weekdayLong("2026-11-23T00:00:00.000Z", "de")).toBe("Montag");
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("names the whole day for screen readers", () => {
    expect(weekdayLong(WEEK[1] ?? "", "de")).toBe("Dienstag");
    expect(weekdayLong(WEEK[1] ?? "", "en")).toBe("Tuesday");
  });
});
