import { deliver } from "@/features/admin/mail";
import { reportInputSchema } from "@/features/moderation/form";
import { loadTranslator, submitReport } from "@/features/moderation/server/submit";
import { addressKey, MINUTE, rateLimit, retryHeaders, valueKey } from "@/lib/rate-limit";
import { requestPlace } from "@/lib/request-context";
import { readBody } from "@/lib/server/read-body";
import { supabaseEnabled } from "@/lib/supabase/config";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * A person reports a page or a few things on it, maybe after a correction: 10 per address an hour
 * leaves room for many people behind one shared address; 5 per e-mail address an hour is the tight one
 * (ADR 0092-notice-and-action, beside ADR 0090's table).
 */
const ADDRESS_LIMIT = rateLimit({ name: "reports", max: 10, windowMs: 60 * MINUTE });
const EMAIL_LIMIT = rateLimit({ name: "reports-email", max: 5, windowMs: 60 * MINUTE });

/** A report is a few kilobytes (4000 characters of Arabic are 8 KB): 32 KB is plenty. */
const MAX_BODY = 32 * 1024;

const answer = (status: number, body: unknown, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { ...noStore, ...headers } });

/**
 * The public report form (/melden, DSA Art. 16). No sign-in, no cookie, nothing stored about the
 * sender's address (the limit keys are in-memory HMACs, ADR 0090). The report is stored through
 * `submit_report` as the server, the receipt goes to the address the reporter typed. 201 with the
 * report's number and time; 400 with the fields to correct; 409 `unavailable` where reports cannot be
 * taken yet (no database, no server key, or a database without the function); 413 for a body over
 * 32 KB; 429 past the limit.
 */
export async function POST(request: Request) {
  const verdict = ADDRESS_LIMIT.take(addressKey(requestPlace(request.headers).ip));
  if (!verdict.ok) return answer(429, { ok: false, error: "tooManyRequests" }, retryHeaders(verdict));
  const text = await readBody(request, MAX_BODY);
  if (text === null) return answer(413, { ok: false, error: "tooLarge" });
  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  const parsed = reportInputSchema.safeParse(raw);
  if (!parsed.success) return answer(400, { ok: false, error: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "page")))] });
  const input = parsed.data;
  if (input.email !== "") {
    const byEmail = EMAIL_LIMIT.take(valueKey("email", input.email.toLowerCase()));
    if (!byEmail.ok) return answer(429, { ok: false, error: "tooManyRequests" }, retryHeaders(byEmail));
  }
  if (!supabaseEnabled) return answer(409, { ok: false, error: "unavailable" });
  const result = await submitReport(input, {
    file: async (report) =>
      serviceSupabase().rpc("submit_report", {
        page: report.page,
        category: report.category,
        explanation: report.explanation,
        good_faith: true,
        locale: report.locale,
        ...(report.url ? { url: report.url } : {}),
        ...(report.name ? { reporter_name: report.name } : {}),
        ...(report.email ? { reporter_email: report.email } : {}),
      }),
    deliver: (message) => deliver(message, "report_receipt_failed"),
    translator: loadTranslator,
    log: (line) => console.error(JSON.stringify(line)),
  });
  return answer(result.status, result.body);
}
