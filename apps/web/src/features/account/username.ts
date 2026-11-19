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
