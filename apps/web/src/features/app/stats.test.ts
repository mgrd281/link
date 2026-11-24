import { describe, expect, it, vi } from "vitest";

// The dashboard's side of the cookie-free statistics: what an answer of GET /api/collect means for
// the screens, and above all that a database without the statistics keeps today's honest "coming
// soon" state (no error, no zeros presented as numbers).

vi.mock("@/features/account/store", () => ({ accountStore: { demo: false } }));
vi.mock("@/lib/supabase/access-token", () => ({ accessToken: () => Promise.resolve("token") }));

const { fetchLiveStats, liveStatsState, statsCsv, toLiveStats } = await import("./stats");
const { parseOwnerStats } = await import("@/features/analytics/answer");

const answer = (overrides: Record<string, unknown> = {}) => ({
  counting: true,
  from: "2026-11-19",
  to: "2026-11-25",
  since: "2026-11-21",
  days: [
    { day: "2026-11-21", views: 4, visitors: 3, clicks: 1 },
    { day: "2026-11-24", views: 2, visitors: 2, clicks: 0 },
  ],
  previous: { views: 0, visitors: 0, clicks: 0 },
  blocks: [{ key: "shop", clicks: 1 }],
  referrers: [{ key: "instagram", views: 4 }],
  countries: [],
  devices: [{ key: "mobile", views: 6 }],
  ...overrides,
});

/** An answer as the dashboard reads it (parsed), with the counts on. */
function parsed(overrides: Record<string, unknown> = {}) {
  const value = parseOwnerStats(answer(overrides));
  if (!value?.counting) throw new Error("not an answer");
  return value;
}

/** The browser's surroundings for one server answer. */
const server = (status: number, body: unknown) => ({
  token: () => Promise.resolve("token"),
  get: vi.fn(() => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })),
});

describe("the live statistics on the dashboard", () => {
  it("keep today's 'coming soon' state when the database has no statistics yet (the server says so)", async () => {
    // GET /api/collect answers { counting: false } for PGRST202 / 42883 (features/analytics/server/collect.ts).
    expect(await fetchLiveStats(30, server(200, { counting: false }))).toEqual({ status: "off" });
  });

  it("keep it while the switch is off, and in a build without real accounts", async () => {
    expect(await fetchLiveStats(7, server(200, { counting: false }))).toEqual({ status: "off" });
    expect(await fetchLiveStats(7, server(404, { ok: false, error: "notFound" }))).toEqual({ status: "off" });
  });

  it("show a failure as a failure, never as zeros", async () => {
    expect(await fetchLiveStats(30, server(500, { ok: false, error: "server" }))).toEqual({ status: "error" });
    expect(await fetchLiveStats(30, server(200, { counting: true }))).toEqual({ status: "error" });
    expect(await fetchLiveStats(30, server(200, "<html>"))).toEqual({ status: "error" });
    expect(await fetchLiveStats(30, { token: () => Promise.resolve(null), get: vi.fn() })).toEqual({ status: "error" });
    expect(await fetchLiveStats(30, { token: () => Promise.reject(new Error("offline")), get: vi.fn() })).toEqual({ status: "error" });
  });

  it("ask for the range with the owner's token", async () => {
    const deps = server(200, answer());
    await fetchLiveStats(90, deps);
    expect(deps.get).toHaveBeenCalledWith("/api/collect?days=90", { headers: { Authorization: "Bearer token" }, cache: "no-store" });
  });

  it("draw every day of the range: before counting began nothing, after it a measured 0", () => {
    const state = liveStatsState({ ok: true, status: 200 }, answer(), 7);
    if (state.status !== "ready") throw new Error(state.status);
    expect(state.stats.days.map((day) => day.views)).toEqual([null, null, 4, 0, 0, 2, 0]);
    expect(state.stats.days.map((day) => day.date)).toEqual(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(state.stats.totals).toEqual({ views: 6, visitors: 5, clicks: 1 });
  });

  it("compare with the period before only when it was counted from its first day", () => {
    const young = toLiveStats(parsed(), 7);
    expect(young.previous).toBeNull();
    const old = toLiveStats(parsed({ since: "2026-11-01", previous: { views: 9, visitors: 7, clicks: 2 } }), 7);
    expect(old.previous).toEqual({ views: 9, visitors: 7, clicks: 2 });
    // Counting began exactly on the first day of the period before.
    expect(toLiveStats(parsed({ since: "2026-11-12" }), 7).previous).not.toBeNull();
    expect(toLiveStats(parsed({ since: "2026-11-13" }), 7).previous).toBeNull();
  });

  it("know a page nobody has visited yet", () => {
    const state = liveStatsState({ ok: true, status: 200 }, answer({ since: null, days: [], blocks: [], referrers: [], devices: [] }), 30);
    if (state.status !== "ready") throw new Error(state.status);
    expect(state.stats.since).toBeNull();
    expect(state.stats.days.every((day) => day.views === null)).toBe(true);
  });
});

describe("the CSV of the visible range", () => {
  const header = { date: "Datum", views: "Aufrufe", visitors: "Besucher", clicks: "Klicks" };

  it("has a row per day, and empty cells (never 0) before counting began", () => {
    const csv = statsCsv(
      [
        { date: "2026-11-20", views: null, visitors: null, clicks: null },
        { date: "2026-11-21", views: 4, visitors: 3, clicks: 1 },
      ],
      header,
      true,
    );
    expect(csv.split("\n")).toEqual(['"Datum","Aufrufe","Besucher","Klicks"', '"2026-11-20","","",""', '"2026-11-21","4","3","1"']);
  });

  it("leaves visitors out for the demo's samples", () => {
    expect(statsCsv([{ date: "2026-11-21", views: 4, visitors: null, clicks: 1 }], header, false).split("\n")[0]).toBe('"Datum","Aufrufe","Klicks"');
  });

  it("keeps a heading that looks like a formula as text", () => {
    expect(statsCsv([], { ...header, date: "=HYPERLINK()" }, false)).toBe('"\'=HYPERLINK()","Aufrufe","Klicks"');
  });
});
