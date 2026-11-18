import { z } from "zod";

import { checkCode, teamToken } from "@/features/admin/server";

/** Checks the team code; on success hands out the team token the team area sends with its requests. */
export async function POST(request: Request) {
  const parsed = z.object({ code: z.string().min(1).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  // A little friction against guessing; real accounts get rate limits in Phase 1.
  await new Promise((resolve) => setTimeout(resolve, 400));
  const ok = checkCode(parsed.data.code);
  return Response.json(ok ? { ok, token: teamToken() } : { ok }, { status: ok ? 200 : 403, headers: { "Cache-Control": "no-store" } });
}
