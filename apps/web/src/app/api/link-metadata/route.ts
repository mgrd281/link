import { NextResponse, type NextRequest } from "next/server";

import { LinkMetadataUnavailable, LinkMetadataUnsupported, lookupLinkMetadata } from "@/lib/link-metadata";
import { addressKey, MINUTE, rateLimit, retryHeaders } from "@/lib/rate-limit";
import { requestPlace } from "@/lib/request-context";

export type { LinkMetadataResponse } from "@/lib/link-metadata";

const DAY = 86_400;

/**
 * Each answer may cost a platform request (and the shared GitHub quota of 60 an hour without a token):
 * 60 per address a minute. The editor asks once per added block with a platform link, so importing a
 * whole list of links at once stays well inside it; answers are cached for an hour in the browser and
 * a day at the CDN, which never reach this count.
 */
const METADATA_LIMIT = rateLimit({ name: "link-metadata", max: 60, windowMs: MINUTE });

/**
 * Details for a pasted link (title, picture, app or repository facts), from the platform's own public
 * endpoint (see `lookupLinkMetadata`). The creator's browser asks us, never the platform.
 */
export async function GET(request: NextRequest) {
  const verdict = METADATA_LIMIT.take(addressKey(requestPlace(request.headers).ip));
  // The editor treats every non-200 as "no details" and keeps its placeholder.
  if (!verdict.ok) return NextResponse.json({}, { status: 429, headers: retryHeaders(verdict) });
  const url = request.nextUrl.searchParams.get("url") ?? "";
  try {
    const result = await lookupLinkMetadata(url);
    return NextResponse.json(result, { headers: { "cache-control": `public, max-age=3600, s-maxage=${DAY}` } });
  } catch (problem) {
    if (problem instanceof LinkMetadataUnsupported) return NextResponse.json({}, { status: 422 });
    return NextResponse.json({}, { status: problem instanceof LinkMetadataUnavailable ? 404 : 504 });
  }
}
