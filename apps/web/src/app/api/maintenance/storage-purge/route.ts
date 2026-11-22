import { createHash, timingSafeEqual } from "node:crypto";

import { bearer } from "@/lib/server/user";
import { drainStoragePurge } from "@/lib/server/storage-purge";
import { supabaseEnabled } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const notFound = () => new Response(null, { status: 404, headers: noStore });

/** Compares two secrets in constant time (their digests have the same length whatever was sent). */
const sameSecret = (given: string, wanted: string) =>
  timingSafeEqual(createHash("sha256").update(given).digest(), createHash("sha256").update(wanted).digest());

/**
 * Works through the Storage deletion queue (`storage_purge`). Called by a scheduled job with the
 * MAINTENANCE_SECRET as bearer token; without that secret configured, or with any other token, the
 * route does not exist (404).
 */
export async function POST(request: Request) {
  const secret = process.env.MAINTENANCE_SECRET ?? "";
  const token = bearer(request);
  if (!supabaseEnabled || secret === "" || !token || !sameSecret(token, secret)) return notFound();
  try {
    const result = await drainStoragePurge(100);
    return Response.json({ ok: true, ...result }, { headers: noStore });
  } catch {
    return Response.json({ ok: false }, { status: 500, headers: noStore });
  }
}
