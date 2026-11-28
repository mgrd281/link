import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/prepared (E-06): with real accounts, whether the team prepared a page for an address is
 * no answer for strangers. Everyone but the team gets 404 (signed out, or signed in without a team
 * role); the team token or a team member's session gets the answer. A demo build answers as before.
 */

const state = vi.hoisted(() => ({ accounts: true, asked: 0 }));

vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return state.accounts;
  },
}));

vi.mock("@/lib/server/user", () => ({
  requireUser: (request: Request) => {
    const header = request.headers.get("authorization");
    if (header !== "Bearer member-session" && header !== "Bearer creator-session") return Promise.resolve(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
    return Promise.resolve({
      user: { id: "u1", email: "mara@example.com" },
      db: { rpc: () => Promise.resolve({ data: header === "Bearer member-session" ? { role: "owner" } : null, error: null }) },
    });
  },
}));

// The lookup itself (claim.ts) is not under test here: a match for one address, none for the rest.
vi.mock("@/features/previews/claim", () => ({
  findPrepared: (input: { email: string }) => {
    state.asked += 1;
    return input.email === "juna@example.com" ? { kind: "reserved" } : { kind: "none" };
  },
}));

const { POST } = await import("./route");
const { teamToken } = await import("@/features/admin/server");

const ask = (authorization?: string) =>
  POST(
    new Request("http://localhost/api/prepared", {
      method: "POST",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      body: JSON.stringify({ email: "juna@example.com", username: "juna", locale: "de" }),
    }),
  );

beforeEach(() => {
  state.accounts = true;
  state.asked = 0;
  vi.stubEnv("LINKYO_ADMIN_CODE_SHA256", createHash("sha256").update("local-test-team-code").digest("hex"));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/prepared", () => {
  it("answers 404 with real accounts to a visitor who is signed out, or signed in without a team role, and looks nothing up", async () => {
    for (const authorization of [undefined, "Bearer creator-session", "Bearer forged", `Bearer ${"0".repeat(64)}`]) {
      const response = await ask(authorization);
      expect(response.status, authorization).toBe(404);
      expect(await response.json()).toEqual({ kind: "none" });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(state.asked).toBe(0);
  });

  it("answers the team: a member's own session, or the team token", async () => {
    const member = await ask("Bearer member-session");
    expect(member.status).toBe(200);
    expect(await member.json()).toEqual({ kind: "reserved" });
    const token = await ask(`Bearer ${teamToken()}`);
    expect(token.status).toBe(200);
    expect(state.asked).toBe(2);
  });

  it("answers anyone in a demo build (no real accounts), as before", async () => {
    state.accounts = false;
    vi.stubEnv("LINKYO_ADMIN_CODE_SHA256", "");
    const response = await ask();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ kind: "reserved" });
  });
});
