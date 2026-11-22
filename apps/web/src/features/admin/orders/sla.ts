/**
 * How close a deadline is, for the team's queue: a ready date, a revision's due date, or the 14-day
 * refund deadline of a withdrawal (§ 357 Abs. 1 BGB). Pure, so the queue, the contracts panel and the
 * tests read the same thresholds. The chip always carries text; its tone is never the only signal.
 */

export type SlaState = "ok" | "soon" | "overdue";

/** "Soon" starts four hours before the deadline. */
export const SOON_MS = 4 * 3_600_000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** ok (more than 4 h left), soon (4 h or less), overdue (past the deadline). */
export function slaState(due: Date, now: Date): SlaState {
  const left = due.getTime() - now.getTime();
  if (left < 0) return "overdue";
  return left <= SOON_MS ? "soon" : "ok";
}

/**
 * A short, rounded duration in the locale's words: "2 Tage", "3 Std.", "25 Min." (Western digits in
 * every language). Days from two days on, hours from one hour on, otherwise minutes (at least one).
 */
export function slaDuration(ms: number, locale: string): string {
  const abs = Math.abs(ms);
  const [value, unit] = abs >= 2 * DAY ? [Math.floor(abs / DAY), "day"] : abs >= HOUR ? [Math.floor(abs / HOUR), "hour"] : [Math.max(1, Math.floor(abs / MINUTE)), "minute"];
  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: unit === "day" ? "long" : "short", numberingSystem: "latn" }).format(value);
}

/** The words of `admin.orders.sla.*`: a translator over that namespace. */
export type SlaT = (key: "ok" | "soon" | "overdue", values: { time: string }) => string;

export interface SlaChip {
  state: SlaState;
  tone: "neutral" | "warning" | "danger";
  text: string;
}

const TONE: Record<SlaState, SlaChip["tone"]> = { ok: "neutral", soon: "warning", overdue: "danger" };

/** The chip for a deadline: its state, its tone and its text ("in 3 Std.", "überfällig seit 2 Tage"). */
export function slaChip(due: Date, now: Date, locale: string, t: SlaT): SlaChip {
  const state = slaState(due, now);
  return { state, tone: TONE[state], text: t(state, { time: slaDuration(due.getTime() - now.getTime(), locale) }) };
}

/** The refund deadline of a withdrawal: 14 days after it arrived. */
export function refundDueAt(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + 14 * DAY);
}
