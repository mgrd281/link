import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import type * as NextServer from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { handle } from "../../../../../e2e/mocks/anthropic.handler.mjs";

// The route with the real pipeline, the real limits client (on a fake service database) and the
// real SDK against the local mock. Accounts and the signed-in user are faked.

interface State {
  accounts: boolean;
  reserve: Record<string, unknown>;
  rpc: { name: string; args: unknown }[];
  pending: Promise<unknown>[];
}

const state = vi.hoisted((): State => ({ accounts: false, reserve: {}, rpc: [], pending: [] }));

vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return state.accounts;
  },
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: (task: () => unknown) => {
    state.pending.push(Promise.resolve(task()));
  },
}));

const chain = (data: unknown) => {
  const query = { select: () => query, eq: () => query, maybeSingle: () => Promise.resolve({ data, error: null }) };
  return query;
};

vi.mock("@/lib/server/user", () => ({
  requireUser: (request: Request) => {
    if (request.headers.get("authorization") !== "Bearer good-token") return Promise.resolve(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
    return Promise.resolve({
      user: { id: "user-1", email: "lio@example.com" },
      db: { from: (table: string) => chain(table === "profiles" ? { username: "lio-vance" } : { page: { profile: { displayName: "Lio", avatar: { src: "no-image", alt: "" } } } }) },
    });
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  serviceSupabase: () => ({
    rpc: (name: string, args: unknown) => {
      state.rpc.push({ name, args });
      if (name === "ai_reserve_run") return Promise.resolve({ data: state.reserve, error: null });
      if (name === "ai_stop_requested") return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  }),
}));

const { POST } = await import("./route");

let server: Server;

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("ANTHROPIC_BASE_URL", `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`);
  vi.stubEnv("AI_IP_SALT_SECRET", "local-test");
  vi.stubEnv("AI_ENRICH_OFF", "1");
  vi.stubEnv("VERCEL", "");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  state.accounts = true;
  state.reserve = { ok: true, id: "run-route", plan: "free", allowance: 1, used: 0, left: 1 };
  state.rpc = [];
  state.pending = [];
  vi.stubEnv("AI_ENABLED", "1");
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-local-test");
});

const body = (tag: string, overrides: Record<string, unknown> = {}) => ({
  mode: "welcome",
  pageLocale: "de",
  ownerLocale: "de",
  about: `Ich bin Lio, ich mache elektronische Musik. [[fixture:de-music#${tag}]]`,
  kind: null,
  sources: ["https://instagram.com/lio.vance"],
  pasted: ["https://soundcloud.com/lio-vance", "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "https://www.eventim.de/artist/lio-vance/", "https://lio-vance.de/booking"],
  photo: null,
  ...overrides,
});

const post = (payload: unknown, token = "good-token") =>
  POST(new Request("http://localhost/api/ai/runs", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-forwarded-for": "203.0.113.7" }, body: JSON.stringify(payload) }));

/** The SSE frames of a response, as { type, data }. */
async function frames(response: Response): Promise<{ type: string; data: Record<string, unknown> }[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((frame) => frame.includes("event: "))
    .map((frame) => ({
      type: /^event: (.+)$/m.exec(frame)?.[1] ?? "",
      data: JSON.parse(/^data: (.+)$/m.exec(frame)?.[1] ?? "{}") as Record<string, unknown>,
    }));
}

describe("POST /api/ai/runs", { timeout: 20_000 }, () => {
  it("does not exist in the demo (no accounts)", async () => {
    state.accounts = false;
    expect((await post(body("r-demo"))).status).toBe(404);
  });

  it("does not exist without AI_ENABLED=1 or a key", async () => {
    vi.stubEnv("AI_ENABLED", "");
    expect((await post(body("r-off"))).status).toBe(404);
    vi.stubEnv("AI_ENABLED", "1");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await post(body("r-nokey"))).status).toBe(404);
  });

  it("needs a signed-in user", async () => {
    expect((await post(body("r-401"), "bad")).status).toBe(401);
  });

  it("refuses a bad body, and an empty sentence when nothing can be read (an Instagram link only)", async () => {
    expect((await post({ mode: "welcome" })).status).toBe(400);
    expect((await post(body("r-bad", { pasted: Array.from({ length: 41 }, () => "https://x.example") }))).status).toBe(400);
    expect((await post(body("r-empty", { about: "", pasted: [] }))).status).toBe(400);
    expect(state.rpc).toEqual([]);
  });

  it("streams the run as server-sent events and reserves exactly once", async () => {
    const response = await post(body("r-happy"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-store, no-transform");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    const events = await frames(response);
    await Promise.all(state.pending);
    expect(events[0]).toEqual({ type: "run", data: { type: "run", id: "run-route", plan: "free", left: 1 } });
    expect(events.at(-1)?.type).toBe("done");
    expect(events.find((event) => event.type === "step" && event.data.key === "details")?.data.state).toBe("skip");
    expect(state.rpc.filter((call) => call.name === "ai_reserve_run")).toHaveLength(1);
    expect(state.rpc.find((call) => call.name === "ai_reserve_run")?.args).toMatchObject({ account: "user-1", route: "welcome", worst_micros: 1_050_000, ip_hash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown });
    expect(state.rpc.filter((call) => call.name === "ai_settle_run")).toEqual([expect.objectContaining({ args: expect.objectContaining({ next_status: "succeeded", is_counted: true }) as unknown })]);
    const done = events.at(-1)?.data as { page: { profile: { username: string } } };
    expect(done.page.profile.username).toBe("lio-vance");
  });

  it("sends a refused reservation as one SSE error event on a 200 stream", async () => {
    state.reserve = { ok: false, reason: "quota" };
    const response = await post(body("r-quota"));
    expect(response.status).toBe(200);
    expect(await frames(response)).toEqual([{ type: "error", data: { type: "error", code: "quota", counted: false } }]);
    await Promise.all(state.pending);
    expect(state.rpc.map((call) => call.name)).toEqual(["ai_reserve_run"]);
  });
});
