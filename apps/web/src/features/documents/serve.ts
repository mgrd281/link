import "server-only";

import { createHash } from "node:crypto";

import type { Page } from "@linkyo/blocks";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";

import { loadPublicPage, type PublicPage } from "@/features/creator/public-page";
import { previewPage } from "@/features/previews/registry";
import { pageAddress } from "@/lib/page-url";

import { onlineLine, renderDocument } from "./build";
import { documentEligibility, documentFilename, type DocumentKind } from "./offer";
import type { Jpeg } from "./pdf/jpeg";
import { fetchPhoto } from "./photo";

/**
 * The PDF routes' answers (ADR draft-laufbahn-pdfs). A document exists only where the page offers it
 * (offer.ts, the predicate the page shares); everything else is an empty 404. Every answer is kept
 * out of search engines. Prepared pages (/p) are private: never stored in a shared cache. Public pages
 * (/u) revalidate with an ETag. Nothing here logs: page text and contact data never reach a log.
 */

const NO_INDEX = "noindex, nofollow";

export interface ServeDeps {
  now?: () => Date;
  /** The public page's loader (tests inject one; demo builds have no public pages). */
  load?: (username: string) => Promise<PublicPage | null>;
  /** The prepared page's lookup. */
  find?: (slug: string, locale: string, now: Date) => { page: Page; preview: { theme: CreatorThemeConfig } } | null;
  /** The owner's uploaded portrait as a JPEG (tests inject bytes). */
  photo?: (page: Page) => Promise<Jpeg | null>;
}

const notFound = (): Response => new Response(null, { status: 404, headers: { "X-Robots-Tag": NO_INDEX, "Cache-Control": "no-store" } });

/** The download's name: plain ASCII in `filename`, the name's own letters in `filename*` (RFC 6266). */
export function contentDisposition(kind: DocumentKind, displayName: string, locale: "de" | "en"): string {
  const { ascii, utf8 } = documentFilename(kind, displayName, locale);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`;
}

const offered = (kind: DocumentKind, page: Page, theme: CreatorThemeConfig, now: Date): boolean => {
  const locale = page.profile.locale;
  const signposted = resolveCreatorTheme(theme, { rtlScript: locale === "ar" }).layout.headings === "signpost";
  const offer = documentEligibility(page, { signposted, now });
  return kind === "application" ? offer.cv && offer.letter : offer[kind];
};

function pdfHeaders(kind: DocumentKind, page: Page, cache: Record<string, string>): Headers {
  const locale = page.profile.locale === "en" ? "en" : "de";
  return new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": contentDisposition(kind, page.profile.displayName, locale),
    "X-Robots-Tag": NO_INDEX,
    "X-Content-Type-Options": "nosniff",
    ...cache,
  });
}

const body = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** A prepared page's document: /<locale>/p/<slug>/<kind>. Private: no shared cache, no ETag, no public address on paper. */
export async function servePreviewDocument(kind: DocumentKind, locale: string, slug: string, deps: ServeDeps = {}): Promise<Response> {
  const now = deps.now?.() ?? new Date();
  const found = (deps.find ?? previewPage)(slug, locale, now);
  if (found?.page.profile.locale !== locale || !offered(kind, found.page, found.preview.theme, now)) return notFound();
  try {
    const photo = await (deps.photo ?? fetchPhoto)(found.page);
    const bytes = await renderDocument(kind, found.page, found.preview.theme, { now, asOf: null, online: null, photo });
    return new Response(body(bytes), { status: 200, headers: pdfHeaders(kind, found.page, { "Cache-Control": "private, no-store" }) });
  } catch {
    return new Response(null, { status: 500, headers: { "X-Robots-Tag": NO_INDEX, "Cache-Control": "no-store" } });
  }
}

/** A public page's document: /<username>/<kind> (the proxy rewrites it to /u/<username>/<kind>). Revalidated with an ETag. */
export async function servePublicDocument(kind: DocumentKind, username: string, request: Request, deps: ServeDeps = {}): Promise<Response> {
  const now = deps.now?.() ?? new Date();
  const found = await (deps.load ?? loadPublicPage)(username);
  if (!found || !offered(kind, found.page, found.theme, now)) return notFound();
  try {
    const photo = await (deps.photo ?? fetchPhoto)(found.page);
    const asOf = new Date(found.updatedAt);
    const bytes = await renderDocument(kind, found.page, found.theme, {
      now,
      asOf: Number.isNaN(asOf.getTime()) ? null : asOf,
      online: onlineLine(pageAddress(found.page.profile.username)),
      photo,
    });
    const etag = `"${createHash("sha256").update(bytes).digest("hex")}"`;
    const headers = pdfHeaders(kind, found.page, { "Cache-Control": "public, max-age=0, must-revalidate", ETag: etag });
    const match = request.headers.get("if-none-match");
    if (match?.split(",").some((tag) => tag.trim().replace(/^W\//u, "") === etag)) return new Response(null, { status: 304, headers });
    return new Response(body(bytes), { status: 200, headers });
  } catch {
    return new Response(null, { status: 500, headers: { "X-Robots-Tag": NO_INDEX, "Cache-Control": "no-store" } });
  }
}
