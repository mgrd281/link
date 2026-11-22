import { createHash, createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { checkCode, checkToken, expected, teamToken } from "./server";

/** The demo code's hash is in server.ts; the demo code itself is the one e2e/admin.spec.ts types. */
const DEMO_HASH = "5db53b740697a0a500b76249b4913043ed9a9460c143dab9e3881ba5ab6a89bd";
const OWN_CODE = "correct horse battery staple";
const OWN_HASH = createHash("sha256").update(OWN_CODE).digest("hex");
/** What `teamToken()` used to hand out with an empty key: a constant anyone can compute. */
const EMPTY_KEY_TOKEN = createHmac("sha256", Buffer.alloc(0)).update("linkyo-team-v1").digest("hex");

const demo = { configured: undefined, accounts: false };
const realUnset = { configured: undefined, accounts: true };
const realEmpty = { configured: "  ", accounts: true };
const malformed = { configured: "not-a-hash", accounts: false };
const short = { configured: "abcd", accounts: true };
const own = { configured: OWN_HASH, accounts: true };

describe("team code", () => {
  it("knows the demo hash only in a demo build", () => {
    expect(expected(demo).toString("hex")).toBe(DEMO_HASH);
    expect(expected(realUnset).length).toBe(0);
    expect(expected(realEmpty).length).toBe(0);
  });

  it("refuses everything with Supabase on and the variable unset", () => {
    for (const env of [realUnset, realEmpty]) {
      expect(checkCode("anything", env)).toBe(false);
      expect(checkCode("", env)).toBe(false);
      expect(checkToken(`Bearer ${EMPTY_KEY_TOKEN}`, env)).toBe(false);
      expect(() => teamToken(env)).toThrow();
    }
  });

  it("fails closed with a malformed or short hash", () => {
    for (const env of [malformed, short]) {
      expect(checkCode("anything", env)).toBe(false);
      expect(checkToken(`Bearer ${EMPTY_KEY_TOKEN}`, env)).toBe(false);
      expect(() => teamToken(env)).toThrow();
    }
  });

  it("opens with the configured code and accepts only its token", () => {
    expect(checkCode(OWN_CODE, own)).toBe(true);
    expect(checkCode(` ${OWN_CODE} `, own)).toBe(true);
    expect(checkCode("wrong", own)).toBe(false);
    const token = teamToken(own);
    expect(checkToken(`Bearer ${token}`, own)).toBe(true);
    expect(checkToken(token, own)).toBe(true);
    expect(checkToken(`Bearer ${EMPTY_KEY_TOKEN}`, own)).toBe(false);
    expect(checkToken(null, own)).toBe(false);
    // Changing the code signs everyone out.
    expect(checkToken(`Bearer ${token}`, { configured: DEMO_HASH, accounts: true })).toBe(false);
  });

  it("still works with the demo hash in a demo build", () => {
    const token = teamToken(demo);
    expect(checkToken(`Bearer ${token}`, demo)).toBe(true);
    expect(checkCode("wrong", demo)).toBe(false);
  });
});
