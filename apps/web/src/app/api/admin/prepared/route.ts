import { checkToken, isTeamMember } from "@/features/admin/server";
import { PREVIEWS } from "@/features/previews/registry";
import { requireUser } from "@/lib/server/user";

const noStore = { "Cache-Control": "no-store" };

/**
 * Who may list the prepared pages: the demo's team token (the code entered in this browser), or a
 * signed-in member of the team with real accounts. The role is checked on the server, as the member
 * (`admin_me()`): every team role sees the Creators screen. 401 without either, 403 for an account
 * that is not on the team.
 */
async function access(request: Request): Promise<200 | 401 | 403> {
  if (checkToken(request.headers.get("authorization"))) return 200;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return 401;
  const { data, error } = await signedIn.db.rpc("admin_me");
  return !error && isTeamMember(data) ? 200 : 403;
}

/**
 * Published prepared pages for the team area: everything needed to show and copy them, never the
 * invite hashes (only how many invites there are).
 */
export async function GET(request: Request) {
  const allowed = await access(request);
  if (allowed !== 200) return Response.json({ pages: [] }, { status: allowed, headers: noStore });
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
  return Response.json({ pages }, { headers: noStore });
}
