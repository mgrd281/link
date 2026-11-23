import { isProjectSlug, isUsernameFormat } from "@linkyo/blocks/rules";
import { revalidatePath } from "next/cache";

import type { Db } from "@/lib/supabase/server";

/**
 * Creator pages are cached (app/u/[username] and its project pages, refreshed at most once a minute),
 * and a cached page is still served once after it went stale, however much later that visit comes. So
 * whatever takes a page off the web or moves it (the account is deleted or suspended, the address
 * changes) drops the cached copies here, from the server route that did it: the very next visit is
 * rendered from the database. Saves keep the one-minute window.
 *
 * Next.js tags a cached page with its own path only (`/u/mila/tidewatch` is not dropped with
 * `/u/mila`), so the routes read the page's project addresses before they act and each one is
 * dropped by name: the current ones, and the earlier ones, which answer with a cached redirect.
 */

/**
 * The internal paths of a creator address (proxy.ts rewrites `/<name>` to `/u/<name>`): the page and
 * its link preview, then each project page with its link preview.
 */
export function creatorPaths(username: string, slugs: readonly string[] = []): string[] {
  return [
    `/u/${username}`,
    `/u/${username}/opengraph-image`,
    ...slugs.flatMap((slug) => [`/u/${username}/${slug}`, `/u/${username}/${slug}/opengraph-image`]),
  ];
}

/**
 * Drops the cached page and link preview of each address, and the project pages `slugs` names under
 * each of them. Values that are not an address (null for a profile that could not be read, anything
 * a client sent that is not a username) and slugs that are not a project address are skipped, and
 * each is dropped once. Answers the addresses it dropped.
 */
export function revalidateCreatorPages(usernames: readonly (string | null | undefined)[], slugs: readonly string[] = []): string[] {
  const names = [...new Set(usernames.flatMap((name) => (typeof name === "string" ? [name.trim().toLowerCase()] : [])))].filter(isUsernameFormat);
  const projects = [...new Set(slugs)].filter(isProjectSlug);
  for (const name of names) for (const path of creatorPaths(name, projects)) revalidatePath(path);
  return names;
}

/**
 * Every project address a stored page answers at: each project block's `slug` and its earlier
 * addresses (`was`), hidden and scheduled projects included (their page may have been cached while
 * they were shown). Anything that is not a project address is left out.
 */
export function projectSlugs(page: unknown): string[] {
  const blocks = typeof page === "object" && page !== null && "blocks" in page && Array.isArray(page.blocks) ? (page.blocks as unknown[]) : [];
  const slugs = blocks.flatMap((block) => {
    if (typeof block !== "object" || block === null || !("type" in block) || block.type !== "project") return [];
    const own: unknown[] = "slug" in block ? [block.slug] : [];
    const was: unknown[] = "was" in block && Array.isArray(block.was) ? (block.was as unknown[]) : [];
    return [...own, ...was].filter((slug): slug is string => typeof slug === "string" && isProjectSlug(slug));
  });
  return [...new Set(slugs)];
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

/** The project addresses of an account's stored page (`projectSlugs`); [] when it cannot be read. */
export async function projectSlugsOf(db: Db, id: string): Promise<string[]> {
  try {
    const { data } = await db.from("sites").select("page").eq("profile_id", id).maybeSingle();
    return projectSlugs(data?.page);
  } catch {
    return [];
  }
}
