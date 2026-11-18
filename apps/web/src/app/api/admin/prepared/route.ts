import { checkToken } from "@/features/admin/server";
import { PREVIEWS } from "@/features/previews/registry";

/**
 * Published prepared pages for the team area: everything needed to show and copy them, never the
 * invite hashes (only how many invites there are). Team token required.
 */
export function GET(request: Request) {
  if (!checkToken(request.headers.get("authorization"))) return Response.json({ pages: [] }, { status: 401, headers: { "Cache-Control": "no-store" } });
  // Example pages (a fictional person per kind) are marketing, not a creator's page: not listed.
  const pages = Object.entries(PREVIEWS)
    .filter(([, preview]) => !preview.sample)
    .map(([slug, preview]) => ({
    slug,
    username: preview.username,
    name: preview.name,
    theme: preview.theme,
    pages: preview.pages,
    invites: preview.invite?.emailSha256.length ?? 0,
    verified: preview.verified === true,
    examples: preview.examples === true,
  }));
  return Response.json({ pages }, { headers: { "Cache-Control": "no-store" } });
}
