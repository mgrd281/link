import type { AiSourceReason, AiSourceStatus } from "../../events";
import type { SourceResult } from "../bundle";
import { readPage } from "../html";
import { safeFetch, type SafeFetch, type SafeFetchReason } from "../safe-fetch";

import type { ClassifiedSource } from "./classify";

/**
 * A personal website: one page, through the SSRF-safe fetcher, only when its robots.txt lets
 * `LinkyoImport` in. We keep its title, description, the person in its JSON-LD and its links to
 * profiles and other sites. Nothing is stored and no picture is downloaded.
 */

export interface SourceReadOptions {
  id: string;
  locale: "de" | "en" | "ar";
  fetch?: SafeFetch;
}

/** How a fetch failure shows in the progress line. */
export function failureStatus(reason: SafeFetchReason): { status: AiSourceStatus; reason?: AiSourceReason } {
  switch (reason) {
    case "robots":
      return { status: "skipped", reason: "robots" };
    case "blocked":
      return { status: "failed", reason: "blocked" };
    case "notFound":
      return { status: "failed", reason: "notFound" };
    case "timeout":
      return { status: "failed", reason: "timeout" };
    case "tooLarge":
      return { status: "failed", reason: "tooLarge" };
    case "type":
    case "failed":
      return { status: "failed" };
  }
}

export async function readWebsite(source: ClassifiedSource, options: SourceReadOptions): Promise<SourceResult> {
  const base = { id: options.id, kind: source.kind, label: source.label };
  const result = await (options.fetch ?? safeFetch)(source.url, { accept: "text/html", robots: true, locale: options.locale });
  if (!result.ok) {
    const failure = failureStatus(result.reason);
    // The owner's own site stays a link on the page unless the address does not exist or is refused.
    const keep = result.reason !== "notFound" && result.reason !== "blocked";
    return { ...base, ...failure, ...(keep ? { self: { url: source.url } } : {}), links: [] };
  }
  const page = readPage(result.body, new URL(result.url));
  const links = [...page.sameAs.map((url) => ({ url })), ...page.relMe.map((url) => ({ url })), ...page.links];
  return {
    ...base,
    status: "read",
    self: { url: result.url, ...(page.title ? { title: page.title } : {}) },
    links,
    profile: { displayName: page.name, bio: page.bio, siteTitle: page.title, siteDescription: page.description },
  };
}
