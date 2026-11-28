/**
 * Notice and action (DSA Art. 16 and 17; docs/DECISIONS/draft-notice-and-action.md): the contract the
 * public form at /melden, its route, the team console and the database share. The numbers mirror
 * supabase/migrations/20261128100000_reports.sql (types.test.ts reads it and compares):
 *
 *   reports_accepting() returns boolean                                  -- anon: is the migration in?
 *   submit_report(page, category, explanation, good_faith, url?, reporter_name?, reporter_email?, locale?)
 *     returns {id, receivedAt, duplicate}                                -- service role only
 *   admin_reports(state 'open' | 'decided', max_rows?) returns Report[]  -- reports.manage
 *   admin_moderation_target(customer) returns ModerationTarget           -- reports.manage
 *   admin_moderate(customer, decision, why, legal_ground?, target_block?, for_report?)
 *     returns DecisionDone                                               -- reports.manage (+ customers.manage to suspend)
 *   admin_lift_moderation(decision, why) returns {customer, username, action}
 *   admin_moderation_counts(year?) returns YearCounts                    -- reports.manage
 *   my_moderation() returns InForce[]                                    -- the creator's own
 *   moderation_digest() / moderation_purge()                             -- service role (digest, nightly purge)
 */

/** What a report is about (the form's choice). "minors" may be filed without a name (Art. 16(2)(c)). */
export const REPORT_CATEGORIES = ["hate", "violence", "minors", "sexual", "fraud", "rights", "privacy", "impersonation", "other"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** The categories whose report may come without a name and an e-mail address. */
export const ANONYMOUS_CATEGORIES: readonly ReportCategory[] = ["minors"];

/** The team's decisions. Three restrict the creator; a dismissal leaves the page as it is. */
export const DECISIONS = ["hide_block", "unpublish", "suspend", "dismiss"] as const;
export type Decision = (typeof DECISIONS)[number];
export type Restriction = Exclude<Decision, "dismiss">;

/** Art. 17(3)(d)/(e): the content is illegal, or it breaks the terms. */
export const GROUNDS = ["illegal", "terms"] as const;
export type Ground = (typeof GROUNDS)[number];

/** The lengths the database checks (characters, after trimming). */
export const LIMITS = {
  explanation: { min: 20, max: 4000 },
  name: { min: 2, max: 120 },
  email: { max: 254 },
  url: { max: 500 },
  page: { max: 60 },
  reason: { min: 10, max: 2000 },
} as const;

/** The reporter's name, address, words and link are removed this many days after the decision. */
export const PURGE_DAYS = 180;

/**
 * The team's own target for a first decision, in hours from the report (the queue's "due" and the
 * badge's "overdue"): a day for what can hurt people at once, three days for the rest. A target, not a
 * promise to the reporter; no text outside the console names it.
 */
export const REPORT_SLA_HOURS: Record<ReportCategory, number> = {
  hate: 24,
  violence: 24,
  minors: 24,
  sexual: 24,
  fraud: 72,
  rights: 72,
  privacy: 72,
  impersonation: 72,
  other: 72,
};

const HOUR = 3_600_000;

/** When a report is due by the team's target. */
export const dueAt = (report: { category: ReportCategory; receivedAt: string }): number => Date.parse(report.receivedAt) + REPORT_SLA_HOURS[report.category] * HOUR;

/** Whether an open report has passed its target. */
export const overdue = (report: { category: ReportCategory; receivedAt: string }, now: number): boolean => dueAt(report) <= now;

export const isCategory = (value: unknown): value is ReportCategory => typeof value === "string" && (REPORT_CATEGORIES as readonly string[]).includes(value);
export const isDecision = (value: unknown): value is Decision => typeof value === "string" && (DECISIONS as readonly string[]).includes(value);

/** The account a report names, as it is now. */
export interface ReportAccount {
  id: string;
  username: string;
  status: "active" | "suspended";
  /** The team took the page offline. */
  offline: boolean;
}

/** The decision taken on a report. */
export interface ReportDecision {
  id: string;
  action: Decision;
  ground: Ground | null;
  reason: string;
  blockLabel: string | null;
  at: string;
  /** The team member's e-mail address ("" once they left). */
  by: string;
  liftedAt: string | null;
}

/** One report, as the queue shows it (`admin_reports`). */
export interface Report {
  id: string;
  receivedAt: string;
  /** The page's address as reported. */
  page: string;
  url: string | null;
  category: ReportCategory;
  /** Null once purged. */
  explanation: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  locale: "de" | "en" | "ar";
  state: "open" | "decided";
  decidedAt: string | null;
  purged: boolean;
  /** Null: no such page when it was reported, or the account was deleted since. */
  account: ReportAccount | null;
  decision: ReportDecision | null;
}

/** One block of the reported page (`admin_moderation_target`). */
export interface TargetBlock {
  id: string;
  type: string;
  label: string;
  /** The owner's own switch. */
  visible: boolean;
  /** The team hid it. */
  hidden: boolean;
}

/** A restriction in force on an account. */
export interface InForce {
  id: string;
  action: Restriction;
  blockId: string | null;
  blockLabel: string | null;
  ground: Ground;
  reason: string;
  at: string;
  report: string | null;
}

export interface ModerationTarget {
  id: string;
  username: string;
  status: "active" | "suspended";
  locale: "de" | "en" | "ar";
  blocks: TargetBlock[];
  inForce: InForce[];
}

/** What `admin_moderate` answers to the server (the e-mails and the page cache need it). */
export interface DecisionDone {
  decision: string;
  customer: string | null;
  username: string;
  locale: "de" | "en" | "ar";
  blockLabel: string | null;
  decidedAt: string;
  report: { id: string; email: string | null; name: string | null; locale: "de" | "en" | "ar"; receivedAt: string; page: string; category: ReportCategory } | null;
}

/** The figures for one calendar year (`admin_moderation_counts`). */
export interface YearCounts {
  year: number;
  received: number;
  byCategory: Partial<Record<ReportCategory, number>>;
  byAction: Partial<Record<Decision, number>>;
  byGround: Partial<Record<Ground, number>>;
  fromReports: number;
  lifted: number;
  /** Null while nothing was decided this year. */
  medianHours: number | null;
  openNow: number;
}

/** What a team decision answers to the console. `mailed` is true only when a delivering transport took the e-mail. */
export type DecideAnswer =
  | { ok: true; creatorMailed: boolean; reporterMailed: boolean }
  | { ok: false; error: DecideError };

export type DecideError =
  | "invalid"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "alreadyDecided"
  | "alreadyDone"
  | "blockNotFound"
  | "mismatch"
  | "notYourself"
  | "unavailable"
  | "server";
