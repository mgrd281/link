import { importTarget, isImportHost } from "@/features/app/import-links";

import type { SourceResult } from "../bundle";
import { pageLinks, readPage } from "../html";
import { safeFetch } from "../safe-fetch";

import type { ClassifiedSource } from "./classify";
import { failureStatus, type SourceReadOptions } from "./website";

/**
 * Another link-in-bio page (Beacons, bio.link, carrd …): the importer's logic. Only the allowed
 * services are fetched, also after redirects, and only when their robots.txt allows it. The page's
 * own address is not kept as a link (visitors should not be sent to the old page).
 */
export async function readLinkInBio(source: ClassifiedSource, options: SourceReadOptions): Promise<SourceResult> {
  const base = { id: options.id, kind: source.kind, label: source.label };
  const target = importTarget(source.url);
  if (!target) return { ...base, status: "skipped", reason: "notAllowed", links: [] };
  const result = await (options.fetch ?? safeFetch)(target.toString(), { accept: "text/html", allowHost: isImportHost, robots: true, locale: options.locale });
  if (!result.ok) return { ...base, ...failureStatus(result.reason), links: [] };
  const final = new URL(result.url);
  const page = readPage(result.body, final);
  const links = pageLinks(result.body, final).filter((link) => /^(https:|mailto:)/i.test(link.url));
  return { ...base, status: "read", links, profile: { siteTitle: page.title, bio: page.description } };
}
