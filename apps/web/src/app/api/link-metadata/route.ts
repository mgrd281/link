import { NextResponse, type NextRequest } from "next/server";

import { LinkMetadataUnavailable, LinkMetadataUnsupported, lookupLinkMetadata } from "@/lib/link-metadata";

export type { LinkMetadataResponse } from "@/lib/link-metadata";

const DAY = 86_400;

/**
 * Details for a pasted link (title, picture, app or repository facts), from the platform's own public
 * endpoint (see `lookupLinkMetadata`). The creator's browser asks us, never the platform.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  try {
    const result = await lookupLinkMetadata(url);
    return NextResponse.json(result, { headers: { "cache-control": `public, max-age=3600, s-maxage=${DAY}` } });
  } catch (problem) {
    if (problem instanceof LinkMetadataUnsupported) return NextResponse.json({}, { status: 422 });
    return NextResponse.json({}, { status: problem instanceof LinkMetadataUnavailable ? 404 : 504 });
  }
}
