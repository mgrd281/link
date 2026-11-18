import { z } from "zod";

import { findPrepared } from "@/features/previews/claim";

const body = z.object({
  email: z.email().max(254),
  username: z.string().max(30),
  invite: z.string().max(64).optional(),
  locale: z.enum(["de", "en", "ar"]),
});

/** Sign-up asks here whether the Linkyo team prepared a page for this email (see claim.ts). */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ kind: "none" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  return Response.json(findPrepared(parsed.data), { headers: { "Cache-Control": "no-store" } });
}
