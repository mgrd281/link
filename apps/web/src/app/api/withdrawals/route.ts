import { submitWithdrawal, withdrawalFormSchema } from "@/features/payments/server/contracts";
import { contractsDeps, json, paymentsOff, readJson } from "@/features/payments/server/get-payments";
import { ipForLog, requestPlace } from "@/lib/request-context";
import { ipHash } from "@/lib/server/ip-hash";

export const runtime = "nodejs";

/**
 * The online withdrawal function (§ 356a BGB). No sign-in, no reason. Every declaration is stored
 * with the server's time and answered with it; the browser learns only when it arrived and whether
 * the receipt went out, never whether a contract matched.
 */
export async function POST(request: Request) {
  const off = paymentsOff();
  if (off) return off;
  const parsed = withdrawalFormSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid", fields: parsed.error.issues.map((issue) => issue.path.join(".")) }, 400);
  const answer = await submitWithdrawal(parsed.data, ipHash(ipForLog(requestPlace(request.headers))), contractsDeps());
  return json(answer);
}
