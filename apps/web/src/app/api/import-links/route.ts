import { z } from "zod";

import { safeFetch } from "@/features/ai/server/safe-fetch";
import { extractLinks, importTarget, isImportHost, pasteOnlyHost } from "@/features/app/import-links";

export const runtime = "nodejs";

const body = z.object({ url: z.string().max(300) });

const answer = (data: object, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Reads someone's existing link-in-bio page (Beacons, bio.link, carrd, …) and returns its links, so
 * moving to Linkyo takes one paste. Only the listed services are fetched (also after redirects), only
 * when their robots.txt allows it, through the SSRF-safe fetcher (the body is streamed and cut at
 * 1 MiB). Linktree forbids reading its pages: those links are pasted instead. Nothing is stored; the
 * browser never talks to those services itself.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return answer({ ok: false, error: "unsupported" }, 400);
  if (pasteOnlyHost(parsed.data.url)) return answer({ ok: false, error: "paste" });
  const target = importTarget(parsed.data.url);
  if (!target) return answer({ ok: false, error: "unsupported" });

  const result = await safeFetch(target.toString(), { accept: "text/html", allowHost: isImportHost, robots: true });
  if (!result.ok) {
    if (result.reason === "robots") return answer({ ok: false, error: "robots" });
    if (result.reason === "notFound") return answer({ ok: false, error: "notFound" });
    return answer({ ok: false, error: "failed" });
  }
  const links = extractLinks(result.body, new URL(result.url));
  return answer(links.length ? { ok: true, links } : { ok: false, error: "empty" });
}
