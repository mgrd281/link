import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { supabaseEnabled } from "@/lib/supabase/config";

import { ROLES } from "./types";

/**
 * The team code that opens the team area. Set LINKYO_ADMIN_CODE_SHA256 (the SHA-256 of your own
 * code) in the hosting environment; the built-in hash is the demo code, and only a demo build (no
 * real accounts) accepts it. Only route handlers import this file: neither the code nor its hash ever
 * reaches the browser.
 */
const DEMO_CODE_SHA256 = "5db53b740697a0a500b76249b4913043ed9a9460c143dab9e3881ba5ab6a89bd";

/** A SHA-256 is 32 bytes; any other key (unset with real accounts, malformed) opens nothing. */
const KEY_BYTES = 32;

/**
 * The configured hash as bytes. Unset or empty: the demo hash in a demo build, nothing with real
 * accounts. Set but malformed: whatever it decodes to, which `usable` then refuses (fails closed).
 */
export function expected({ configured = process.env.LINKYO_ADMIN_CODE_SHA256, accounts = supabaseEnabled }: { configured?: string | undefined; accounts?: boolean } = {}): Buffer {
  const value = configured?.trim() ?? "";
  if (value === "") return accounts ? Buffer.alloc(0) : Buffer.from(DEMO_CODE_SHA256, "hex");
  return /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.alloc(0);
}

const usable = (key: Buffer) => key.length === KEY_BYTES;

const same = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

type Env = Parameters<typeof expected>[0];

/** The code someone typed matches the configured hash (never with an unusable key). */
export const checkCode = (code: string, env?: Env): boolean => {
  const key = expected(env);
  return usable(key) && same(key, createHash("sha256").update(code.trim()).digest());
};

/**
 * What the browser keeps after the code was entered: derived from the configured hash, so changing
 * the code signs everyone out. Throws without a usable key: a token from an empty or short key would
 * be a constant anyone can compute.
 */
export const teamToken = (env?: Env): string => {
  const key = expected(env);
  if (!usable(key)) throw new Error("LINKYO_ADMIN_CODE_SHA256 is not set to a SHA-256");
  return createHmac("sha256", key).update("linkyo-team-v1").digest("hex");
};

/**
 * With real accounts: whether `admin_me()`, called as the signed-in account, names a team role (it
 * answers null for everyone else). Every role sees the Creators screen, so every role may list the
 * prepared pages.
 */
export const isTeamMember = (me: unknown): boolean => {
  if (typeof me !== "object" || me === null || !("role" in me)) return false;
  const { role } = me;
  return ROLES.some((known) => known === role);
};

export const checkToken = (header: string | null, env?: Env): boolean => {
  const key = expected(env);
  if (!usable(key)) return false;
  const token = header?.replace(/^Bearer\s+/i, "") ?? "";
  return /^[0-9a-f]{64}$/.test(token) && same(Buffer.from(token, "hex"), Buffer.from(teamToken(env), "hex"));
};
