import type { SourceResult } from "../bundle";

import type { ClassifiedSource } from "./classify";

/**
 * A TikTok profile: TikTok's public oEmbed for the profile (a fixed host, no key) gives the name the
 * creator shows. The profile itself always stays a social link on the page.
 */

export const TIKTOK_TIMEOUT_MS = 3_000;

export async function readTikTok(source: ClassifiedSource, options: { id: string; fetch?: typeof fetch; timeoutMs?: number }): Promise<SourceResult> {
  const base = { id: options.id, kind: source.kind, label: source.label, self: { url: source.url } };
  const handle = /^\/@([\w.]{1,64})\/?$/.exec(new URL(source.url).pathname)?.[1];
  if (!handle) return { ...base, status: "handleOnly", links: [] };
  const profile = `https://www.tiktok.com/@${handle}`;
  try {
    const response = await (options.fetch ?? fetch)(`https://www.tiktok.com/oembed?url=${encodeURIComponent(profile)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? TIKTOK_TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 400 || response.status === 404) return { ...base, status: "failed", reason: "notFound", links: [] };
    if (!response.ok) return { ...base, status: "failed", links: [] };
    const data = (await response.json()) as { author_name?: unknown };
    const name = typeof data.author_name === "string" ? data.author_name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    return { ...base, status: "read", links: [], ...(name ? { profile: { displayName: name } } : {}) };
  } catch (error) {
    const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
    return { ...base, status: "failed", ...(timedOut ? { reason: "timeout" as const } : {}), links: [] };
  }
}
