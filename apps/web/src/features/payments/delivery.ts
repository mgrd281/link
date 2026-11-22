/**
 * When a page-service order is ready. Pure: the same code shows the date before the order, fixes it
 * at consent, and recomputes it for a late briefing. Every day and hour is Europe/Berlin; offsets come
 * from `Intl.DateTimeFormat` (no date library), so summer time is handled by the platform.
 *
 * The promise: ordered **and briefed** Monday to Friday by 12:00 → ready the next working day at
 * 18:00. A working day is Monday to Friday except nationwide German public holidays ("Arbeitstag
 * (Mo–Fr)", never "Werktag", which in German law usually includes Saturday). A day that already has
 * `capacity` orders due is full; the date then moves to the next working day.
 */

export const TIME_ZONE = "Europe/Berlin";
export const CUTOFF_HOUR = 12;
export const DUE_HOUR = 18;
/** The statutory withdrawal period (§ 355 Abs. 2 BGB), in days. */
export const WITHDRAWAL_DAYS = 14;
/** Days off beyond the nationwide holidays (a regional holiday at the company seat). None yet. */
export const EXTRA_HOLIDAYS: readonly string[] = [];

const DAY_MS = 86_400_000;
const SEARCH_DAYS = 400;

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The wall clock in Berlin at an instant. */
function berlinClock(at: Date) {
  const parts = formatter.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

const pad = (value: number) => String(value).padStart(2, "0");
const isoDay = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const splitDay = (day: string) => {
  const [year = NaN, month = NaN, date = NaN] = day.split("-").map(Number);
  return { year, month, date };
};

/** The Berlin calendar day (YYYY-MM-DD) of an instant. */
export function berlinDay(at: Date): string {
  const clock = berlinClock(at);
  return isoDay(clock.year, clock.month, clock.day);
}

/** Minutes Berlin is ahead of UTC at an instant (60 in winter, 120 in summer). */
function offsetMinutes(at: Date): number {
  const clock = berlinClock(at);
  const wall = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second);
  return Math.round((wall - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** The instant a Berlin wall clock shows `hour:minute` on `day`. */
export function berlinTime(day: string, hour: number, minute = 0): Date {
  const { year, month, date } = splitDay(day);
  const wall = Date.UTC(year, month - 1, date, hour, minute);
  const first = wall - offsetMinutes(new Date(wall)) * 60_000;
  // Near a clock change the first guess can sit on the other side of it; one more pass settles it.
  return new Date(wall - offsetMinutes(new Date(first)) * 60_000);
}

/** A calendar day plus `days` (negative goes back). */
export function addDays(day: string, days: number): string {
  const { year, month, date } = splitDay(day);
  return new Date(Date.UTC(year, month - 1, date) + days * DAY_MS).toISOString().slice(0, 10);
}

const weekday = (day: string) => {
  const { year, month, date } = splitDay(day);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
};

/** Easter Sunday (anonymous Gregorian algorithm, Meeus/Jones/Butcher). */
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDay(year, month, day);
}

const holidayCache = new Map<number, string[]>();

/**
 * Nationwide German public holidays of a year (YYYY-MM-DD, sorted): New Year, Good Friday, Easter
 * Monday, Labour Day, Ascension, Whit Monday, German Unity Day, Christmas Day and Boxing Day.
 */
export function germanHolidays(year: number): string[] {
  const cached = holidayCache.get(year);
  if (cached) return [...cached];
  const sunday = easter(year);
  const days = [
    `${year}-01-01`,
    addDays(sunday, -2),
    addDays(sunday, 1),
    `${year}-05-01`,
    addDays(sunday, 39),
    addDays(sunday, 50),
    `${year}-10-03`,
    `${year}-12-25`,
    `${year}-12-26`,
  ].sort();
  holidayCache.set(year, days);
  return [...days];
}

/** Monday to Friday, and not a nationwide holiday (24 and 31 December are working days). */
export function isWorkingDay(day: string): boolean {
  const dayOfWeek = weekday(day);
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return !germanHolidays(splitDay(day).year).includes(day) && !EXTRA_HOLIDAYS.includes(day);
}

/** The first working day after `day`. */
export function nextWorkingDay(day: string): string {
  let next = addDays(day, 1);
  while (!isWorkingDay(next)) next = addDays(next, 1);
  return next;
}

function previousWorkingDay(day: string): string {
  let previous = addDays(day, -1);
  while (!isWorkingDay(previous)) previous = addDays(previous, -1);
  return previous;
}

export interface DeliveryInput {
  /** When the order is placed (or, for a late briefing, when the work can start). */
  from: Date;
  /** The customer asked us to start before the withdrawal period ends. */
  earlyStart: boolean;
  /** Orders that may be due on one day. */
  capacity: number;
  /** Orders already due per Berlin day (YYYY-MM-DD). */
  booked: ReadonlyMap<string, number>;
}

export interface DeliveryPlan {
  /** When the work may start. */
  startAt: Date;
  /** Ready by: 18:00 Berlin. */
  dueAt: Date;
  /** The briefing must be complete by then (12:00 Berlin of the working day before `dueAt`). */
  briefingBy: Date;
}

/**
 * Without an early-start request we start once the withdrawal period is over: it ends at the end of
 * the 14th day after the order's day (§ 355 Abs. 2, §§ 187, 188 BGB), so work starts at 00:00 on the
 * day after.
 */
function startAfterWithdrawal(from: Date): Date {
  return berlinTime(addDays(berlinDay(from), WITHDRAWAL_DAYS + 1), 0);
}

export function deliveryPlan(input: DeliveryInput): DeliveryPlan {
  const startAt = input.earlyStart ? input.from : startAfterWithdrawal(input.from);
  const startDay = berlinDay(startAt);
  const onTime = isWorkingDay(startDay) && startAt.getTime() <= berlinTime(startDay, CUTOFF_HOUR).getTime();
  let due = nextWorkingDay(startDay);
  if (!onTime) due = nextWorkingDay(due);
  for (let tries = 0; (input.booked.get(due) ?? 0) >= input.capacity; tries++) {
    if (tries > SEARCH_DAYS) throw new Error("linkyo:noCapacity");
    due = nextWorkingDay(due);
  }
  const dueAt = berlinTime(due, DUE_HOUR);
  return { startAt, dueAt, briefingBy: briefingByFor(dueAt) };
}

/** 12:00 Berlin of the working day before the due day. */
export function briefingByFor(due: Date): Date {
  return berlinTime(previousWorkingDay(berlinDay(due)), CUTOFF_HOUR);
}

/**
 * The due date once the briefing arrives: on time (by `briefingByFor(promisedDue)`) keeps the
 * promised date, even when that day has filled up since; a late one gets the next free working day
 * as if ordered now with an early start (the order itself is not in `bookedWithoutThis`).
 */
export function dueOnBriefing(input: { now: Date; promisedDue: Date; startAfter: Date; capacity: number; bookedWithoutThis: ReadonlyMap<string, number> }): Date {
  if (input.now.getTime() <= briefingByFor(input.promisedDue).getTime()) return input.promisedDue;
  const from = input.now.getTime() >= input.startAfter.getTime() ? input.now : input.startAfter;
  return deliveryPlan({ from, earlyStart: true, capacity: input.capacity, booked: input.bookedWithoutThis }).dueAt;
}

/** A revision round is delivered within 2 working days: the second working day after `from`, 18:00 Berlin. */
export function revisionDue(from: Date): Date {
  return berlinTime(nextWorkingDay(nextWorkingDay(berlinDay(from))), DUE_HOUR);
}

/** The Berlin day of month Pro renews on; from the 29th on, shorter months renew on their last day. */
export function billingDay(anchor: Date): { day: number; shortMonths: boolean } {
  const { day } = berlinClock(anchor);
  return { day, shortMonths: day >= 29 };
}

/**
 * The end of the billing period that contains the Berlin day `wanted` (YYYY-MM-DD), for a cancellation
 * "as of" a date: `periodEnd` itself when `wanted` falls on or before its day, otherwise the first
 * later monthly boundary on or after `wanted`. Boundaries follow Stripe's rule: the anchor's day of the
 * month (UTC) at the anchor's time, or the month's last day when the month is shorter. `anchor`
 * defaults to `periodEnd`; pass the subscription's billing cycle anchor when the period end already
 * fell on a short month's last day (an anchor on the 29th–31st).
 */
export function periodEndContaining(periodEnd: Date, wanted: string, anchor: Date = periodEnd): Date {
  if (wanted <= berlinDay(periodEnd)) return periodEnd;
  const anchorDay = anchor.getUTCDate();
  let year = periodEnd.getUTCFullYear();
  let month = periodEnd.getUTCMonth();
  for (let step = 0; step < 1200; step++) {
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const boundary = new Date(
      Date.UTC(year, month, Math.min(anchorDay, lastDay), periodEnd.getUTCHours(), periodEnd.getUTCMinutes(), periodEnd.getUTCSeconds(), periodEnd.getUTCMilliseconds()),
    );
    if (berlinDay(boundary) >= wanted) return boundary;
  }
  throw new Error("periodEndContaining: wanted date out of range");
}
