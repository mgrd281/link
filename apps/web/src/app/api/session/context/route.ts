import type { NextRequest } from "next/server";

import { requestPlace } from "@/lib/request-context";

/**
 * The address and rough location of the request, for the caller's own sign-in log (demo mode).
 * Read from the request headers the host sets; nothing is stored here and no third party is asked.
 */
export function GET(request: NextRequest) {
  return Response.json(requestPlace(request.headers), { headers: { "cache-control": "no-store" } });
}
