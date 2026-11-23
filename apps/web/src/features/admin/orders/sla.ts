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

export type SlaUnit = "day" | "hour" | "minute";

/**
 * A short, rounded-down duration: days from two days on, hours from one hour on, otherwise minutes
 * (at least one).
 */
export function slaAmount(ms: number): { count: number; unit: SlaUnit } {
  const abs = Math.abs(ms);
  if (abs >= 2 * DAY) return { count: Math.floor(abs / DAY), unit: "day" };
  if (abs >= HOUR) return { count: Math.floor(abs / HOUR), unit: "hour" };
  return { count: Math.max(1, Math.floor(abs / MINUTE)), unit: "minute" };
}

/**
 * The words of `admin.orders.sla.*`: a translator over that namespace. `time.<unit>` is the duration
 * as it reads inside the three sentences, after their preposition, as an ICU plural in each
 * language. `Intl.NumberFormat`'s unit style cannot write it: it only knows the base form ("3 Tage",
 * Arabic "يومان"), while German needs the dative here ("seit 3 Tagen", "in 1 Tag") and Arabic the
 * genitive with its dual and plural classes ("منذ يومين", "منذ 3 أيام", "منذ 11 يومًا").
 */
export type SlaT = (key: SlaState | `time.${SlaUnit}`, values: { time: string } | { count: number }) => string;

export interface SlaChip {
  state: SlaState;
  tone: "neutral" | "warning" | "danger";
  text: string;
}

const TONE: Record<SlaState, SlaChip["tone"]> = { ok: "neutral", soon: "warning", overdue: "danger" };

/** The chip for a deadline: its state, its tone and its text ("in 3 Std.", "überfällig seit 2 Tagen"). */
export function slaChip(due: Date, now: Date, t: SlaT): SlaChip {
  const state = slaState(due, now);
  const { count, unit } = slaAmount(due.getTime() - now.getTime());
  return { state, tone: TONE[state], text: t(state, { time: t(`time.${unit}`, { count }) }) };
}

/** The refund deadline of a withdrawal: 14 days after it arrived. */
export function refundDueAt(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + 14 * DAY);
}
