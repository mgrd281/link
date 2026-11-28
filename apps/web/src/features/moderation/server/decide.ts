import "server-only";

import { reportDecision } from "@/features/email/templates/report-notices";
import type { EmailLocale, EmailT } from "@/features/email/templates/render";
import { statementOfReasons } from "@/features/email/templates/statement-of-reasons";
import type { EmailMessage } from "@/features/email/types";

import { GROUNDS, isCategory, isDecision, LIMITS, type DecideError, type Decision, type DecisionDone, type Ground } from "../types";

import { missingFunction } from "./submit";

/**
 * A team decision on the server: `admin_moderate` as the team member (the database checks the
 * permission, the report and the block, records the decision with its reason and writes the activity
 * log), then the cached public pages are dropped so a hidden block or an offline page is gone on the
 * very next visit, then the statement of reasons goes to the creator's own address (Art. 17 DSA) and
 * the decision to the reporter's (Art. 16(5)). Both e-mails report `mailed` honestly: false while the
 * deployment's transport does not deliver (F1).
 */

export interface DecideInput {
  decision: Decision;
  customer: string | null;
  reason: string;
  ground: Ground | null;
  block: string | null;
  report: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The body of a decision request, or null when it is not one. */
export function parseDecision(raw: unknown): DecideInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (!isDecision(body.decision)) return null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < LIMITS.reason.min || reason.length > LIMITS.reason.max) return null;
  const customer = typeof body.customer === "string" && UUID.test(body.customer) ? body.customer : null;
  const report = typeof body.report === "string" && UUID.test(body.report) ? body.report : null;
  const ground = typeof body.ground === "string" && (GROUNDS as readonly string[]).includes(body.ground) ? (body.ground as Ground) : null;
  const block = typeof body.block === "string" && body.block.length > 0 && body.block.length <= 120 ? body.block : null;
  if (body.decision === "dismiss") return report ? { decision: "dismiss", customer, reason, ground: null, block: null, report } : null;
  if (!customer || !ground) return null;
  if (body.decision === "hide_block" && !block) return null;
  return { decision: body.decision, customer, reason, ground, block: body.decision === "hide_block" ? block : null, report };
}

/** The HTTP status and error for a refusal of the database. */
export function refusal(error: { code?: string | undefined; message?: string | undefined }): { status: number; error: DecideError } {
  const message = error.message ?? "";
  if (missingFunction(error)) return { status: 409, error: "unavailable" };
  if (error.code === "42501" || message.includes("linkyo:forbidden")) return { status: 403, error: "forbidden" };
  const known: [string, DecideError, number][] = [
    ["linkyo:notFound", "notFound", 404],
    ["linkyo:alreadyDecided", "alreadyDecided", 409],
    ["linkyo:alreadyDone", "alreadyDone", 409],
    ["linkyo:blockNotFound", "blockNotFound", 409],
    ["linkyo:mismatch", "mismatch", 409],
    ["linkyo:notYourself", "notYourself", 409],
    ["linkyo:reasonRequired", "invalid", 400],
    ["linkyo:groundRequired", "invalid", 400],
    ["linkyo:reportRequired", "invalid", 400],
    ["linkyo:invalidAction", "invalid", 400],
  ];
  const found = known.find(([code]) => message.includes(code));
  return found ? { status: found[2], error: found[1] } : { status: 500, error: "server" };
}

const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];
const localeOf = (value: unknown): EmailLocale => LOCALES.find((locale) => locale === value) ?? "de";

/** `admin_moderate`'s answer, read defensively. */
export function readDone(data: unknown): DecisionDone | null {
  if (typeof data !== "object" || data === null) return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.decision !== "string" || typeof raw.decidedAt !== "string") return null;
  const report = typeof raw.report === "object" && raw.report !== null ? (raw.report as Record<string, unknown>) : null;
  return {
    decision: raw.decision,
    customer: typeof raw.customer === "string" ? raw.customer : null,
    username: typeof raw.username === "string" ? raw.username : "",
    locale: localeOf(raw.locale),
    blockLabel: typeof raw.blockLabel === "string" ? raw.blockLabel : null,
    decidedAt: raw.decidedAt,
    report:
      report && typeof report.id === "string"
        ? {
            id: report.id,
            email: typeof report.email === "string" ? report.email : null,
            name: typeof report.name === "string" ? report.name : null,
            locale: localeOf(report.locale),
            receivedAt: typeof report.receivedAt === "string" ? report.receivedAt : raw.decidedAt,
            page: typeof report.page === "string" ? report.page : "",
            category: isCategory(report.category) ? report.category : "other",
          }
        : null,
  };
}

export interface DecideDeps {
  /** `admin_moderate` as the team member. */
  moderate: (input: DecideInput) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  /** Before the decision: the page's addresses, read while the account can still be found (the cache to drop). */
  address: (customer: string) => Promise<{ username: string | null; slugs: string[] }>;
  /** Drops the cached public page and project pages. */
  revalidate: (usernames: (string | null)[], slugs: string[]) => void;
  /** The account's own e-mail address (service role), or null. */
  accountEmail: (customer: string) => Promise<string | null>;
  deliver: (message: () => Promise<EmailMessage | null>) => Promise<boolean>;
  translator: (locale: EmailLocale) => Promise<EmailT>;
  /** The page's address for people ("linkyo.app/mila"). */
  pageAddress: (username: string) => string;
  site: string;
  contact: string;
}

export type DecideResult =
  | { status: 200; body: { ok: true; creatorMailed: boolean; reporterMailed: boolean } }
  | { status: number; body: { ok: false; error: DecideError } };

export async function decide(input: DecideInput, deps: DecideDeps): Promise<DecideResult> {
  // The addresses first: a suspended or offline page no longer answers its own reads.
  const address = input.customer && input.decision !== "dismiss" ? await deps.address(input.customer) : { username: null, slugs: [] };
  const { data, error } = await deps.moderate(input);
  if (error) {
    const refused = refusal(error);
    return { status: refused.status, body: { ok: false, error: refused.error } };
  }
  const done = readDone(data);
  if (!done) return { status: 500, body: { ok: false, error: "server" } };
  if (input.decision !== "dismiss") deps.revalidate([address.username, done.username], address.slugs);

  const page = deps.pageAddress(done.username === "" ? (done.report?.page ?? "") : done.username);
  let creatorMailed = false;
  if (input.decision !== "dismiss" && done.customer && input.ground) {
    const customer = done.customer;
    const ground = input.ground;
    const action = input.decision;
    creatorMailed = await deps.deliver(async () => {
      const to = await deps.accountEmail(customer);
      if (!to) return null;
      return statementOfReasons(
        {
          to,
          locale: done.locale,
          page,
          action,
          blockLabel: done.blockLabel,
          ground,
          reason: input.reason,
          decidedAt: new Date(done.decidedAt),
          reportedAt: done.report ? new Date(done.report.receivedAt) : null,
          site: deps.site,
          contact: deps.contact,
        },
        await deps.translator(done.locale),
      );
    });
  }
  const report = done.report;
  const reporterMailed =
    report?.email
      ? await deps.deliver(async () =>
          reportDecision(
            {
              to: report.email ?? "",
              locale: report.locale,
              name: report.name,
              page: deps.pageAddress(report.page),
              id: report.id,
              receivedAt: new Date(report.receivedAt),
              decision: input.decision,
              reason: input.decision === "dismiss" ? input.reason : null,
              contact: deps.contact,
            },
            await deps.translator(report.locale),
          ),
        )
      : false;
  return { status: 200, body: { ok: true, creatorMailed, reporterMailed } };
}
