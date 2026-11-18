import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The team code that opens the team area. Set LINKYO_ADMIN_CODE_SHA256 (the SHA-256 of your own
 * code) in the hosting environment; the built-in hash is the demo code. Only route handlers import
 * this file: neither the code nor its hash ever reaches the browser.
 */
const DEMO_CODE_SHA256 = "5db53b740697a0a500b76249b4913043ed9a9460c143dab9e3881ba5ab6a89bd";

// Unset or empty: the demo code. Set but malformed: nobody gets in (fails closed).
const expected = () => {
  const configured = process.env.LINKYO_ADMIN_CODE_SHA256?.trim();
  return Buffer.from(configured === undefined || configured === "" ? DEMO_CODE_SHA256 : configured, "hex");
};

const same = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export const checkCode = (code: string) => same(expected(), createHash("sha256").update(code.trim()).digest());

/** What the browser keeps after the code was entered: derived from the configured hash, so changing the code signs everyone out. */
export const teamToken = () => createHmac("sha256", expected()).update("linkyo-team-v1").digest("hex");

export const checkToken = (header: string | null) => {
  const token = header?.replace(/^Bearer\s+/i, "") ?? "";
  return /^[0-9a-f]{64}$/.test(token) && same(Buffer.from(token, "hex"), Buffer.from(teamToken(), "hex"));
};
