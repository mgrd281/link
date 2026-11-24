import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route's logic with a fake database: what reaches page_stats_record, and when nothing does.

interface State {
  accounts: boolean;
  /** How often the route asked Supabase Auth who is signed in. */
  authCalls: number;
  rpc: { name: string; args: unknown }[];
  answer: { data: unknown; error: { code?: string; message?: string } | null };
}

const state = vi.hoisted((): State => ({ accounts: true, authCalls: 0, rpc: [], answer: { data: null, error: null } }));
const SALT = "5".repeat(64);

vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return state.accounts;
  },
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
}));

vi.mock("@/lib/supabase/server", async () => {
  const { berlinDay } = await import("../days");
  return {
    serviceSupabase: () => ({
      rpc: (name: string, args: unknown) => {
        state.rpc.push({ name, args });
        // The database answers today's salt (its own Berlin day).
        if (name === "page_stats_salt") return Promise.resolve({ data: { day: berlinDay(), salt: SALT }, error: null });
        return Promise.resolve({ data: "counted", error: null });
      },
    }),
  };
});

vi.mock("@/lib/server/user", () => ({
  requireUser: (request: Request) => {
    state.authCalls += 1;
    if (request.headers.get("authorization") !== "Bearer good-token") return Promise.resolve(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
    return Promise.resolve({
      user: { id: "user-1", email: "mila@example.com" },
      db: {
        rpc: (name: string, args: unknown) => {
          state.rpc.push({ name, args });
          return Promise.resolve(state.answer);
        },
      },
    });
  },
}));

const { collect, forgetSalt, ownerStats, parseBeacon } = await import("./collect");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ADDRESS = "203.0.113.7";

/** A beacon as a browser on linkyo.app sends it. */
const beacon = (body: object | string, extra: Record<string, string> = {}) =>
  new Request("https://linkyo.app/api/collect", {
    method: "POST",
    headers: {
      host: "linkyo.app",
      "content-type": "text/plain;charset=UTF-8",
      "sec-fetch-site": "same-origin",
      origin: "https://linkyo.app",
      "user-agent": IPHONE,
      "x-forwarded-for": ADDRESS,
      "x-vercel-ip-country": "de",
      ...extra,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const recorded = () => state.rpc.filter((call) => call.name === "page_stats_record");

beforeEach(() => {
  state.accounts = true;
  state.authCalls = 0;
  state.rpc = [];
  state.answer = { data: null, error: null };
  forgetSalt();
  vi.stubEnv("LINKYO_ANALYTICS", "on");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/collect", () => {
  it("counts a view with a hash, a referrer group, a country and a device class, and nothing that names a person", async () => {
    const response = await collect(beacon({ p: "mila", t: "v", r: "l.instagram.com" }));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    const [call] = recorded();
    expect(call?.args).toEqual({ handle: "mila", kind: "view", visitor: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown, referrer: "instagram", country: "DE", device: "mobile" });
    const sent = JSON.stringify(state.rpc);
    expect(sent).not.toContain(ADDRESS);
    expect(sent).not.toContain("iPhone");
  });

  it("counts a tap on a block by its id", async () => {
    await collect(beacon({ p: "mila", t: "c", b: "shop-1" }));
    expect(recorded()[0]?.args).toMatchObject({ handle: "mila", kind: "click", block: "shop-1" });
  });

  it("gives the same visitor the same hash all day, and asks for the salt once", async () => {
    await collect(beacon({ p: "mila", t: "v", r: "" }));
    await collect(beacon({ p: "mila", t: "c", b: "shop-1" }));
    const [view, tap] = recorded().map((call) => (call.args as { visitor: string }).visitor);
    expect(view).toBe(tap);
    expect(state.rpc.filter((call) => call.name === "page_stats_salt")).toHaveLength(1);
  });

  it("stores nothing while the switch is off", async () => {
    vi.stubEnv("LINKYO_ANALYTICS", undefined);
    const response = await collect(beacon({ p: "mila", t: "v", r: "" }));
    expect(response.status).toBe(204);
    expect(state.rpc).toEqual([]);
  });

  it("stores nothing in the demo (no database)", async () => {
    state.accounts = false;
    expect((await collect(beacon({ p: "mila", t: "v", r: "" }))).status).toBe(204);
    expect(state.rpc).toEqual([]);
  });

  it("does not count visitors who ask not to be tracked (GPC, DNT)", async () => {
    await collect(beacon({ p: "mila", t: "v", r: "" }, { "sec-gpc": "1" }));
    await collect(beacon({ p: "mila", t: "v", r: "" }, { dnt: "1" }));
    expect(state.rpc).toEqual([]);
  });

  it("does not count bots, prefetches or other sites", async () => {
    await collect(beacon({ p: "mila", t: "v", r: "" }, { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }));
    await collect(beacon({ p: "mila", t: "v", r: "" }, { "sec-purpose": "prefetch;prerender" }));
    await collect(beacon({ p: "mila", t: "v", r: "" }, { "sec-fetch-site": "cross-site", origin: "https://evil.example" }));
    await collect(beacon({ p: "mila", t: "v", r: "" }, { "sec-fetch-site": "", origin: "" }));
    expect(state.rpc).toEqual([]);
  });

  it("ignores anything that is not a beacon", async () => {
    for (const body of ["", "not json", "[]", JSON.stringify({ p: "x", t: "v" }), JSON.stringify({ p: "mila", t: "scroll" }), JSON.stringify({ p: "mila", t: "c" }), JSON.stringify({ p: "mila", t: "c", b: "<script>" })])
      await collect(beacon(body));
    await collect(beacon({ p: "mila", t: "v", r: "x".repeat(2000) }));
    expect(recorded()).toEqual([]);
  });
});

describe("the beacon's body", () => {
  it("keeps a QR marker and the referring host, nothing else", () => {
    expect(parseBeacon(JSON.stringify({ p: "mila", t: "v", r: "t.co", s: "qr", extra: "x" }))).toEqual({ page: "mila", kind: "view", referrer: "t.co", source: "qr" });
    expect(parseBeacon(JSON.stringify({ p: "mila", t: "v", s: "poster" }))).toEqual({ page: "mila", kind: "view", referrer: "" });
  });
});

describe("GET /api/collect (the owner's numbers)", () => {
  const ask = (days: string, token = "good-token") => ownerStats(new Request(`https://linkyo.app/api/collect?days=${days}`, { headers: { authorization: `Bearer ${token}` } }));

  it("needs a signed-in owner", async () => {
    expect((await ask("30", "bad")).status).toBe(401);
  });

  it("says nothing is counted while the switch is off, without asking the database", async () => {
    vi.stubEnv("LINKYO_ANALYTICS", undefined);
    const response = await ask("30");
    expect(await response.json()).toEqual({ counting: false });
    expect(state.rpc).toEqual([]);
  });

  it("while the switch is off, asks Supabase Auth nothing, so a failing sign-in check cannot turn 'coming soon' into an error", async () => {
    vi.stubEnv("LINKYO_ANALYTICS", undefined);
    const response = await ask("30", "bad");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ counting: false });
    expect(state.authCalls).toBe(0);
  });

  it("says nothing is counted on a database without the statistics (the hosted one today)", async () => {
    for (const error of [{ code: "PGRST202", message: "Could not find the function public.my_page_stats(from_day, to_day) in the schema cache" }, { code: "42883", message: "function public.my_page_stats(date, date) does not exist" }]) {
      state.answer = { data: null, error };
      const response = await ask("7");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ counting: false });
    }
  });

  it("reports any other failure as one, never as zeros", async () => {
    state.answer = { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
    const response = await ask("30");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "server" });
  });

  it("asks for the last 7, 30 or 90 Berlin days and hands the numbers on", async () => {
    state.answer = {
      data: { from: "2026-10-27", to: "2026-11-25", since: "2026-11-20", days: [{ day: "2026-11-24", views: 3, visitors: 2, clicks: 1 }], previous: { views: 0, visitors: 0, clicks: 0 }, blocks: [{ key: "shop-1", clicks: 1 }], referrers: [], countries: [], devices: [] },
      error: null,
    };
    const response = await ask("30");
    const body = (await response.json()) as { counting: boolean; days: unknown[]; blocks: unknown[] };
    expect(body.counting).toBe(true);
    expect(body.days).toEqual([{ day: "2026-11-24", views: 3, visitors: 2, clicks: 1 }]);
    expect(body.blocks).toEqual([{ key: "shop-1", count: 1 }]);
    const args = state.rpc[0]?.args as { from_day: string; to_day: string };
    expect(Date.parse(args.to_day) - Date.parse(args.from_day)).toBe(29 * 864e5);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("offers only the ranges the dashboard shows", async () => {
    expect((await ask("365")).status).toBe(400);
    expect((await ask("abc")).status).toBe(400);
  });
});
