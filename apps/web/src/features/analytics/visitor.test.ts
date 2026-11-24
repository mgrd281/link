import { describe, expect, it } from "vitest";

import { addDays, berlinDay, daysBetween } from "./days";
import { visitorHash } from "./visitor";

const MONDAY = "a".repeat(64);
const TUESDAY = "b".repeat(64);
const ADDRESS = "203.0.113.7";
const BROWSER = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1";

describe("the daily visitor hash", () => {
  it("is the same for one person on one page all day", () => {
    expect(visitorHash(MONDAY, "mila", ADDRESS, BROWSER)).toBe(visitorHash(MONDAY, "Mila ", ADDRESS, BROWSER));
    expect(visitorHash(MONDAY, "mila", ADDRESS, BROWSER)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rotates with the salt: the next day the same person is someone else", () => {
    expect(visitorHash(MONDAY, "mila", ADDRESS, BROWSER)).not.toBe(visitorHash(TUESDAY, "mila", ADDRESS, BROWSER));
  });

  it("tells pages, networks and browsers apart", () => {
    const base = visitorHash(MONDAY, "mila", ADDRESS, BROWSER);
    expect(visitorHash(MONDAY, "noor", ADDRESS, BROWSER)).not.toBe(base);
    expect(visitorHash(MONDAY, "mila", "203.0.113.8", BROWSER)).not.toBe(base);
    expect(visitorHash(MONDAY, "mila", ADDRESS, `${BROWSER} Instagram`)).not.toBe(base);
  });

  it("carries neither the address nor the browser string", () => {
    const hash = visitorHash(MONDAY, "mila", ADDRESS, BROWSER);
    expect(hash).not.toContain("203");
    expect(hash).not.toContain("Mozilla");
  });
});

describe("Berlin days", () => {
  it("turn at midnight in Berlin, not in UTC", () => {
    expect(berlinDay(new Date("2026-11-24T22:59:00Z"))).toBe("2026-11-24");
    expect(berlinDay(new Date("2026-11-24T23:01:00Z"))).toBe("2026-11-25");
    // Summer time: two hours ahead.
    expect(berlinDay(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
    expect(berlinDay(new Date("2026-07-01T22:01:00Z"))).toBe("2026-07-02");
  });

  it("count forward and back across months and years", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-24", -29)).toBe("2026-10-26");
    expect(daysBetween("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(daysBetween("2026-01-02", "2026-01-01")).toEqual([]);
  });
});
