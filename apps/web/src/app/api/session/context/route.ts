import type { NextRequest } from "next/server";

/**
 * The address and rough location of the request, for the caller's own sign-in log. Read from the
 * request headers the host sets (Vercel: x-forwarded-for and x-vercel-ip-*); nothing is stored
 * here and no third party is asked.
 */
export function GET(request: NextRequest) {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (forwarded === undefined || forwarded === "" ? (headers.get("x-real-ip") ?? "") : forwarded).replace(/^::ffff:/, "");
  const decode = (value: string | null) => {
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const country = headers.get("x-vercel-ip-country") ?? undefined;
  const city = decode(headers.get("x-vercel-ip-city"));
  return Response.json({ ip, ...(country ? { country } : {}), ...(city ? { city } : {}) }, { headers: { "cache-control": "no-store" } });
}
