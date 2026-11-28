import { z } from "zod";

import { checkCode, teamToken } from "@/features/admin/server";
import { addressKey, MINUTE, rateLimit, retryHeaders } from "@/lib/rate-limit";
import { requestPlace } from "@/lib/request-context";

/**
 * Someone types the team code once, maybe again after a typo: 5 tries per address in 10 minutes. Every
 * try counts, a right one too (the limit is about guessing, and nobody needs a sixth in that time).
 */
const CODE_LIMIT = rateLimit({ name: "admin-verify", max: 5, windowMs: 10 * MINUTE });

/** Checks the team code; on success hands out the team token the team area sends with its requests. */
export async function POST(request: Request) {
  const verdict = CODE_LIMIT.take(addressKey(requestPlace(request.headers).ip));
  if (!verdict.ok) return Response.json({ ok: false, error: "tooManyAttempts" }, { status: 429, headers: retryHeaders(verdict) });
  const parsed = z.object({ code: z.string().min(1).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  // A little friction against guessing, on top of the limit above.
  await new Promise((resolve) => setTimeout(resolve, 400));
  const ok = checkCode(parsed.data.code);
  return Response.json(ok ? { ok, token: teamToken() } : { ok }, { status: ok ? 200 : 403, headers: { "Cache-Control": "no-store" } });
}
