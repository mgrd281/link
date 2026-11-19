import { z } from "zod";

import { allowedRedirect, extractLinks, importTarget } from "@/features/app/import-links";

const body = z.object({ url: z.string().max(300) });
const MAX_BYTES = 1_500_000;
const MAX_HOPS = 3;

const answer = (data: object, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Reads someone's existing link-in-bio page (Linktree, Beacons, bio.link, …) and returns its links,
 * so moving to Linkyo takes one paste. Only the listed services are ever fetched (also after
 * redirects); nothing is stored. The browser never talks to those services itself.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return answer({ ok: false, error: "unsupported" }, 400);
  let target = importTarget(parsed.data.url);
  if (!target) return answer({ ok: false, error: "unsupported" });

  try {
    for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
      const response = await fetch(target, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; LinkyoImport/1.0)" },
      });
      if (response.status >= 300 && response.status < 400) {
        const next = allowedRedirect(response.headers.get("location") ?? "", target);
        if (!next) return answer({ ok: false, error: "failed" });
        target = next;
        continue;
      }
      if (response.status === 404) return answer({ ok: false, error: "notFound" });
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) return answer({ ok: false, error: "failed" });
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > MAX_BYTES) return answer({ ok: false, error: "failed" });
      const html = (await response.text()).slice(0, MAX_BYTES);
      const links = extractLinks(html, target);
      return answer(links.length ? { ok: true, links } : { ok: false, error: "empty" });
    }
    return answer({ ok: false, error: "failed" });
  } catch {
    return answer({ ok: false, error: "failed" });
  }
}
