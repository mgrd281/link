import type { Detection } from "@linkyo/blocks";

import type { LinkMetadata } from "@/features/app/metadata";
import { lookupLinkMetadata } from "@/lib/link-metadata";

/**
 * Real titles, artists and pictures for the media links the code found (songs, videos, apps,
 * repositories), from the platforms' public endpoints, the same as when a link is pasted in the
 * editor: at most 10 links, all at once, 3 s each. A link without an answer simply has none.
 */

export const ENRICH_MAX = 10;
export const ENRICH_TIMEOUT_MS = 3_000;

const MEDIA = new Set(["video", "music", "app", "repo"]);

/** The links worth asking about, in bundle order. */
export const mediaLinks = <T extends { url: string; detection: Detection }>(links: readonly T[], max = ENRICH_MAX): T[] => links.filter((link) => MEDIA.has(link.detection.type)).slice(0, max);

export async function enrichLinks(
  links: readonly { url: string; detection: Detection }[],
  options: { lookup?: (url: string) => Promise<LinkMetadata>; max?: number; timeoutMs?: number } = {},
): Promise<Map<string, LinkMetadata>> {
  const lookup = options.lookup ?? lookupLinkMetadata;
  const timeoutMs = options.timeoutMs ?? ENRICH_TIMEOUT_MS;
  const picked = mediaLinks(links, options.max ?? ENRICH_MAX);
  const answers = await Promise.allSettled(
    picked.map(async (link) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("timeout"));
        }, timeoutMs);
      });
      try {
        return await Promise.race([lookup(link.url), timeout]);
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  const found = new Map<string, LinkMetadata>();
  answers.forEach((answer, index) => {
    const link = picked[index];
    if (link && answer.status === "fulfilled" && Object.keys(answer.value).length > 0) found.set(link.url, answer.value);
  });
  return found;
}
