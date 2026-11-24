import { collect, ownerStats } from "@/features/analytics/server/collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cookie-free statistics (ADR 0081). POST: the beacon of a creator page, a
 * view or a tap on one of its blocks; always 204, and with the server switch off (LINKYO_ANALYTICS
 * unset) nothing is stored. GET: the signed-in owner's own numbers for the dashboard.
 */
export function POST(request: Request): Promise<Response> {
  return collect(request);
}

export function GET(request: Request): Promise<Response> {
  return ownerStats(request);
}
