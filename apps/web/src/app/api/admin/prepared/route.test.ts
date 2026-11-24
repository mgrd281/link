import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PRE-3: with real accounts the team console asked for the prepared pages without a team token and
 * got 401 on every Overview and Creators screen. The route now also takes the signed-in member's
 * own session and checks the role on the server (admin_me, as that member); the demo's team token
 * works as before.
 */

interface State {
  accounts: boolean;
  me: unknown;
  meError: unknown;
  calls: string[];
}

const state = vi.hoisted((): State => ({ accounts: true, me: null, meError: null, calls: [] }));

vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return state.accounts;
  },
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
}));

vi.mock("@/lib/server/user", () => ({
  requireUser: (request: Request) => {
    if (!state.accounts || request.headers.get("authorization") !== "Bearer member-session") {
      return Promise.resolve(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
    }
    return Promise.resolve({
      user: { id: "member-1", email: "mara@example.com" },
      db: {
        rpc: (name: string) => {
          state.calls.push(name);
          return Promise.resolve({ data: state.me, error: state.meError });
        },
      },
    });
  },
}));

// A fictional prepared page and an example page (examples are never listed).
vi.mock("@/features/previews/registry", () => ({
  PREVIEWS: {
    "juna-test": { name: { de: "Juna Test" }, username: "juna-test", theme: { template: "nocturne" }, pages: {}, invite: { emailSha256: ["a", "b"] }, verified: true },
    "example-kind": { name: { de: "Beispiel" }, username: "example-kind", theme: { template: "daylight" }, pages: {}, sample: { kind: "coach" } },
  },
}));

const { GET } = await import("./route");
const { teamToken } = await import("@/features/admin/server");

const get = (authorization?: string) => GET(new Request("http://localhost/api/admin/prepared", authorization ? { headers: { authorization } } : {}));

beforeEach(() => {
  state.accounts = true;
  state.me = null;
  state.meError = null;
  state.calls = [];
});

describe("GET /api/admin/prepared", () => {
  it("answers 401 without a team token or a session", async () => {
    const response = await get();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ pages: [] });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("lists the prepared pages for a signed-in team member, checked as that member", async () => {
    for (const role of ["owner", "admin", "editor", "viewer"]) {
      state.me = { role, email: "mara@example.com", permissions: [] };
      const response = await get("Bearer member-session");
      expect(response.status, role).toBe(200);
      const body = (await response.json()) as { pages: { slug: string; invites: number }[] };
      expect(body.pages.map((page) => page.slug)).toEqual(["juna-test"]);
      // Only how many invites, never the hashes.
      expect(body.pages[0]?.invites).toBe(2);
      expect(JSON.stringify(body)).not.toContain("emailSha256");
    }
    expect(state.calls.every((name) => name === "admin_me")).toBe(true);
  });

  it("answers 403 for a signed-in account that is not on the team, or when the role cannot be read", async () => {
    for (const [me, error] of [
      [null, null],
      [{ role: "guest" }, null],
      [{ role: "owner" }, { message: "boom" }],
    ] as const) {
      state.me = me;
      state.meError = error;
      const response = await get("Bearer member-session");
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ pages: [] });
    }
  });

  it("answers 401 for a session the server does not accept", async () => {
    expect((await get("Bearer forged")).status).toBe(401);
  });

  it("keeps the demo's team token working (no real accounts)", async () => {
    state.accounts = false;
    const token = teamToken();
    const response = await get(`Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(state.calls).toEqual([]);
    expect((await get("Bearer member-session")).status).toBe(401);
  });
});
