import { describe, expect, it } from "vitest";

import { missingStats, parseConsoleStats, parseOwnerStats } from "./answer";
import { measured, viewsPerDay, withPageStats } from "./console";

describe("a database without the statistics", () => {
  it("is recognised by PostgREST's and Postgres' 'not found' answers", () => {
    expect(missingStats({ code: "PGRST202", message: "Could not find the function public.admin_page_stats(days) in the schema cache" })).toBe(true);
    expect(missingStats({ code: "PGRST205", message: "Could not find the table 'public.page_stats' in the schema cache" })).toBe(true);
    expect(missingStats({ code: "42883", message: "function public.my_page_stats(date, date) does not exist" })).toBe(true);
    expect(missingStats({ code: "42P01", message: 'relation "public.page_stats" does not exist' })).toBe(true);
  });

  it("is not confused with a refusal or a failure", () => {
    expect(missingStats({ code: "42501", message: "linkyo:forbidden" })).toBe(false);
    expect(missingStats({ code: "57014", message: "canceling statement due to statement timeout" })).toBe(false);
    expect(missingStats({ message: "Failed to fetch" })).toBe(false);
  });
});

describe("the owner's answer", () => {
  it("is read field by field; anything odd is dropped, not trusted", () => {
    const value = parseOwnerStats({
      counting: true,
      from: "2026-11-19",
      to: "2026-11-25",
      since: "not a day",
      days: [{ day: "2026-11-20", views: 3, visitors: -1, clicks: "2" }, { day: "yesterday", views: 9 }, null],
      previous: null,
      blocks: [{ key: "shop", clicks: 2 }, { key: "", clicks: 1 }],
      referrers: [{ key: "instagram", views: 3.7 }],
      countries: "DE",
      devices: [{ key: "mobile", views: Number.NaN }],
    });
    expect(value).toEqual({
      counting: true,
      from: "2026-11-19",
      to: "2026-11-25",
      since: null,
      days: [{ day: "2026-11-20", views: 3, visitors: 0, clicks: 0 }],
      previous: { views: 0, visitors: 0, clicks: 0 },
      blocks: [{ key: "shop", count: 2 }],
      referrers: [{ key: "instagram", count: 3 }],
      countries: [],
      devices: [{ key: "mobile", count: 0 }],
    });
  });

  it("keeps every count on its way through the route (read from the database, then again in the browser)", () => {
    const database = {
      counting: true,
      from: "2026-11-19",
      to: "2026-11-25",
      since: "2026-11-20",
      days: [{ day: "2026-11-20", views: 2, visitors: 1, clicks: 1 }],
      previous: { views: 0, visitors: 0, clicks: 0 },
      blocks: [{ key: "shop", clicks: 1 }],
      referrers: [{ key: "direct", views: 2 }],
      countries: [{ key: "DE", views: 2 }],
      devices: [{ key: "desktop", views: 2 }],
    };
    const route = parseOwnerStats(database);
    const browser = parseOwnerStats(JSON.parse(JSON.stringify(route)));
    expect(browser).toEqual(route);
    expect(browser).toMatchObject({ blocks: [{ key: "shop", count: 1 }], referrers: [{ key: "direct", count: 2 }], devices: [{ key: "desktop", count: 2 }] });
  });

  it("says plainly when nothing is counted, and refuses what is not an answer", () => {
    expect(parseOwnerStats({ counting: false })).toEqual({ counting: false });
    expect(parseOwnerStats({ counting: true })).toBeNull();
    expect(parseOwnerStats(null)).toBeNull();
    expect(parseOwnerStats([])).toBeNull();
  });
});

describe("the console's totals", () => {
  const stats = parseConsoleStats({
    from: "2026-11-23",
    to: "2026-11-25",
    since: "2026-11-24",
    days: [{ day: "2026-11-24", views: 5, visitors: 4, clicks: 2 }],
    pages: [{ id: "a", views: 5, clicks: 2 }],
  });

  it("feed views30 and clicks30; a page without a row had none (a measured 0)", () => {
    if (!stats) throw new Error("no stats");
    const customers = [
      { id: "a", usage: { views30: 0, clicks30: 0, kind: "music" } },
      { id: "b", usage: { views30: 0, clicks30: 0, kind: "coach" } },
    ];
    expect(withPageStats(customers, stats)).toEqual([
      { id: "a", usage: { views30: 5, clicks30: 2, kind: "music" } },
      { id: "b", usage: { views30: 0, clicks30: 0, kind: "coach" } },
    ]);
  });

  it("count as measured only once something was counted somewhere", () => {
    expect(measured(stats)).toBe(true);
    expect(measured(null)).toBe(false);
    expect(measured(parseConsoleStats({ from: "2026-11-23", to: "2026-11-25", since: null, days: [], pages: [] }))).toBe(false);
  });

  it("chart days before counting as gaps, not zeros", () => {
    if (!stats) throw new Error("no stats");
    expect(viewsPerDay(stats)).toEqual([
      { date: "2026-11-23", value: null },
      { date: "2026-11-24", value: 5 },
      { date: "2026-11-25", value: 0 },
    ]);
  });
});
