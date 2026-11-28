import "server-only";

import { reportReceipt, reportReference } from "@/features/email/templates/report-notices";
import { emailTranslator, type EmailLocale, type EmailT } from "@/features/email/templates/render";
import type { EmailMessage } from "@/features/email/types";

import { pageFromInput, reportProblems, urlFromInput, type ReportField } from "../form";
import type { ReportCategory } from "../types";

/** A database function this database does not have yet (PostgREST's "not found", Postgres' "undefined function"). */
export const missingFunction = (error: { code?: string | undefined; message?: string | undefined }): boolean =>
  error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");

/** next-intl's translator over one locale's messages, for an e-mail (server only). */
export async function loadTranslator(locale: EmailLocale): Promise<EmailT> {
  const messages = (await import(`../../../messages/${locale}.json`)) as { default: Record<string, unknown> };
  return emailTranslator(locale, messages.default);
}

export interface CleanReport {
  page: string;
  url: string | null;
  category: ReportCategory;
  explanation: string;
  name: string | null;
  email: string | null;
  locale: EmailLocale;
}

/** The answer of `POST /api/reports` (and its HTTP status). */
export type SubmitAnswer =
  | { status: 201; body: { ok: true; id: string; reference: string; receivedAt: string; duplicate: boolean; mailed: boolean } }
  | { status: 400; body: { ok: false; error: "invalid"; fields: ReportField[] } }
  | { status: 409; body: { ok: false; error: "unavailable" } }
  | { status: 500; body: { ok: false; error: "server" } };

export interface SubmitDeps {
  /** `submit_report` as the server (service role); throws when there is no server key. */
  file: (report: CleanReport) => Promise<{ data: unknown; error: { code?: string; message?: string; hint?: string } | null }>;
  /** Sends the receipt; answers whether a delivering transport took it (`deliver`). */
  deliver: (message: () => Promise<EmailMessage | null>) => Promise<boolean>;
  translator: (locale: EmailLocale) => Promise<EmailT>;
  log?: (line: Record<string, unknown>) => void;
}

const FIELDS = new Set<ReportField>(["page", "category", "explanation", "name", "email", "goodFaith"]);

/**
 * Files one report from the form: checks it as the database will, stores it through `submit_report`
 * (as the server), then sends the receipt to the address the reporter typed (Art. 16(4) DSA), when
 * they gave one. A database without the function, or a deployment without the server key, answers
 * 409 `unavailable` (the form then says reports cannot be taken here yet), never a 500. Logs carry
 * no name, address or words.
 */
export async function submitReport(
  input: { page: string; category: ReportCategory; explanation: string; name: string; email: string; goodFaith: boolean; locale: EmailLocale },
  deps: SubmitDeps,
): Promise<SubmitAnswer> {
  const fields = reportProblems(input);
  const page = pageFromInput(input.page);
  if (fields.length > 0 || page === null) return { status: 400, body: { ok: false, error: "invalid", fields: fields.length > 0 ? fields : ["page"] } };
  const clean: CleanReport = {
    page,
    url: urlFromInput(input.page),
    category: input.category,
    explanation: input.explanation.trim(),
    name: input.name.trim() || null,
    email: input.email.trim().toLowerCase() || null,
    locale: input.locale,
  };
  let result: Awaited<ReturnType<SubmitDeps["file"]>>;
  try {
    result = await deps.file(clean);
  } catch {
    return { status: 409, body: { ok: false, error: "unavailable" } };
  }
  const { data, error } = result;
  if (error) {
    if (missingFunction(error)) return { status: 409, body: { ok: false, error: "unavailable" } };
    if ((error.message ?? "").includes("linkyo:invalid")) {
      const field = error.hint as ReportField | undefined;
      return { status: 400, body: { ok: false, error: "invalid", fields: field && FIELDS.has(field) ? [field] : ["explanation"] } };
    }
    deps.log?.({ evt: "report_failed", code: error.code ?? "unknown" });
    return { status: 500, body: { ok: false, error: "server" } };
  }
  const stored = (typeof data === "object" && data !== null ? data : {}) as { id?: unknown; receivedAt?: unknown; duplicate?: unknown };
  if (typeof stored.id !== "string" || typeof stored.receivedAt !== "string") {
    deps.log?.({ evt: "report_failed", code: "shape" });
    return { status: 500, body: { ok: false, error: "server" } };
  }
  const id = stored.id;
  const receivedAt = stored.receivedAt;
  const duplicate = stored.duplicate === true;
  // A duplicate got its receipt the first time.
  const mailed =
    clean.email && !duplicate
      ? await deps.deliver(async () => reportReceipt({ to: clean.email ?? "", locale: clean.locale, name: clean.name, page: clean.page, id, receivedAt: new Date(receivedAt) }, await deps.translator(clean.locale)))
      : false;
  return { status: 201, body: { ok: true, id, reference: reportReference(id), receivedAt, duplicate, mailed } };
}
