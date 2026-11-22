import { cancellationFormSchema, submitCancellation } from "@/features/payments/server/contracts";
import { contractsDeps, json, paymentsOff, readJson } from "@/features/payments/server/get-payments";
import { ipForLog, requestPlace } from "@/lib/request-context";
import { ipHash } from "@/lib/server/ip-hash";

export const runtime = "nodejs";

/**
 * The cancellation button (§ 312k BGB). No sign-in. Every cancellation is stored and answered with
 * only `{ receivedAt, mailed }`, the same whether or not an account matched; the exact end date goes
 * to the account's own address.
 */
export async function POST(request: Request) {
  const off = paymentsOff();
  if (off) return off;
  const parsed = cancellationFormSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid", fields: parsed.error.issues.map((issue) => issue.path.join(".")) }, 400);
  const answer = await submitCancellation(parsed.data, ipHash(ipForLog(requestPlace(request.headers))), contractsDeps());
  return json(answer);
}
