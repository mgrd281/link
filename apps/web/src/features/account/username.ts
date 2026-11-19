import { profileSchema, RESERVED_USERNAMES } from "@linkyo/blocks";

import type { UsernameStatus } from "./types";

export const normalizeUsername = (username: string) => username.trim().toLowerCase();
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * What can be said about a username without asking the server: its format and the reserved names
 * (the database checks the same rules, see supabase/migrations). "ok" here can still be taken.
 */
export function localUsernameStatus(input: string): UsernameStatus {
  const username = normalizeUsername(input);
  if (!profileSchema.shape.username.safeParse(username).success) return "invalidUsername";
  if (RESERVED_USERNAMES.has(username)) return "reservedUsername";
  return "ok";
}

/** Until someone picks their address (in the welcome flow), a new page gets a neutral one. */
const PROVISIONAL = /^page-[a-z0-9]{6}$/;
export const isProvisionalUsername = (username: string) => PROVISIONAL.test(username);

/** A neutral, random address like "page-k3x9q2". Never derived from the email: that stays private. */
export function newProvisionalUsername(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `page-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

/** An address suggested from a name: "Mila Aurel" becomes "mila-aurel" ("" when nothing usable is left). */
export function suggestUsername(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  return localUsernameStatus(slug) === "ok" ? slug : "";
}
