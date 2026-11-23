import { isUsernameFormat } from "@linkyo/blocks/rules";
import { revalidatePath } from "next/cache";

import type { Db } from "@/lib/supabase/server";

/**
 * Creator pages are cached (app/u/[username], refreshed at most once a minute), and a cached page is
 * still served once after it went stale, however much later that visit comes. So whatever takes a
 * page off the web or moves it (the account is deleted or suspended, the address changes) drops the
 * cached copy here, from the server route that did it: the very next visit is rendered from the
 * database. Saves keep the one-minute window.
 */

/** The internal paths of a creator address (proxy.ts rewrites `/<name>` to `/u/<name>`): the page and its link preview. */
export function creatorPaths(username: string): string[] {
  return [`/u/${username}`, `/u/${username}/opengraph-image`];
}

/**
 * Drops the cached page and link preview of each address. Values that are not an address (null for a
 * profile that could not be read, anything a client sent that is not a username) are skipped, and
 * each address is dropped once. Answers the addresses it dropped.
 */
export function revalidateCreatorPages(...usernames: (string | null | undefined)[]): string[] {
  const names = [...new Set(usernames.flatMap((name) => (typeof name === "string" ? [name.trim().toLowerCase()] : [])))].filter(isUsernameFormat);
  for (const name of names) for (const path of creatorPaths(name)) revalidatePath(path);
  return names;
}

/** An account's current address, or null when it cannot be read (no such profile, no access). */
export async function usernameOf(db: Db, id: string): Promise<string | null> {
  try {
    const { data } = await db.from("profiles").select("username").eq("id", id).maybeSingle();
    return data?.username ?? null;
  } catch {
    return null;
  }
}
