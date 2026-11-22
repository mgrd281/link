import { describe, expect, it } from "vitest";

import {
  berlinDay,
  berlinTime,
  billingDay,
  briefingByFor,
  deliveryPlan,
  dueOnBriefing,
  germanHolidays,
  isWorkingDay,
  nextWorkingDay,
  periodEndContaining,
  revisionDue,
} from "./delivery";

/** A Berlin wall-clock time as an instant: "2026-11-27 11:59". */
const at = (text: string) => {
  const [day = "", time = "00:00"] = text.split(" ");
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return berlinTime(day, hour, minute);
};
/** An instant as Berlin wall-clock text. */
const wall = (date: Date) =>
  `${berlinDay(date)} ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)}`;

const none = new Map<string, number>();
const plan = (from: string, options: { earlyStart?: boolean; capacity?: number; booked?: Map<string, number> } = {}) =>
  deliveryPlan({ from: at(from), earlyStart: options.earlyStart ?? true, capacity: options.capacity ?? 4, booked: options.booked ?? none });

describe("Berlin calendar", () => {
  it("converts wall-clock times in winter and summer", () => {
    expect(at("2026-11-27 11:59").toISOString()).toBe("2026-11-27T10:59:00.000Z");
    expect(at("2026-07-01 18:00").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(at("2026-03-29 00:00").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(at("2026-03-29 18:00").toISOString()).toBe("2026-03-29T16:00:00.000Z");
    expect(at("2026-10-25 18:00").toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });

  it("knows the nationwide holidays (Easter by the Gregorian algorithm)", () => {
    expect(germanHolidays(2026)).toEqual(["2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-05-14", "2026-05-25", "2026-10-03", "2026-12-25", "2026-12-26"]);
    expect(germanHolidays(2027)).toEqual(["2027-01-01", "2027-03-26", "2027-03-29", "2027-05-01", "2027-05-06", "2027-05-17", "2027-10-03", "2027-12-25", "2027-12-26"]);
  });

  it("counts Monday to Friday without holidays as working days", () => {
    expect(isWorkingDay("2026-11-27")).toBe(true); // Friday
    expect(isWorkingDay("2026-11-28")).toBe(false); // Saturday
    expect(isWorkingDay("2026-11-29")).toBe(false); // Sunday
    expect(isWorkingDay("2026-12-24")).toBe(true); // Christmas Eve is a working day
    expect(isWorkingDay("2026-12-25")).toBe(false);
    expect(nextWorkingDay("2026-11-27")).toBe("2026-11-30");
    expect(nextWorkingDay("2027-03-25")).toBe("2027-03-30");
  });
});

describe("deliveryPlan", () => {
  it("Friday before noon → Monday 18:00", () => {
    const result = plan("2026-11-27 11:59");
    expect(wall(result.dueAt)).toBe("2026-11-30 18:00");
    expect(wall(result.briefingBy)).toBe("2026-11-27 12:00");
    expect(result.startAt).toEqual(at("2026-11-27 11:59"));
  });

  it("Friday after noon → Tuesday 18:00", () => {
    expect(wall(plan("2026-11-27 12:01").dueAt)).toBe("2026-12-01 18:00");
  });

  it("noon itself is still on time", () => {
    expect(wall(plan("2026-11-27 12:00").dueAt)).toBe("2026-11-30 18:00");
  });

  it("a weekend order is due on Tuesday, like a Monday-morning order", () => {
    expect(wall(plan("2026-11-28 09:00").dueAt)).toBe("2026-12-01 18:00");
    expect(wall(plan("2026-11-30 09:00").dueAt)).toBe("2026-12-01 18:00");
  });

  it("skips Good Friday and Easter Monday", () => {
    expect(wall(plan("2027-03-25 11:00").dueAt)).toBe("2027-03-30 18:00");
  });

  it("skips Christmas; Christmas Eve counts as a working day", () => {
    expect(wall(plan("2026-12-23 13:00").dueAt)).toBe("2026-12-28 18:00");
    expect(wall(plan("2026-12-23 11:00").dueAt)).toBe("2026-12-24 18:00");
  });

  it("moves to the next working day while a day is full", () => {
    expect(wall(plan("2026-11-27 11:59", { capacity: 1, booked: new Map([["2026-11-30", 1]]) }).dueAt)).toBe("2026-12-01 18:00");
    expect(wall(plan("2026-11-27 11:59", { capacity: 2, booked: new Map([["2026-11-30", 1]]) }).dueAt)).toBe("2026-11-30 18:00");
    expect(wall(plan("2026-11-27 11:59", { capacity: 1, booked: new Map([["2026-11-30", 1], ["2026-12-01", 3]]) }).dueAt)).toBe("2026-12-02 18:00");
  });

  it("without an early start, starts after the 14-day withdrawal period", () => {
    // Ordered on 27 November: the period ends at the end of 11 December; work starts on 12 December.
    const late = plan("2026-11-27 11:59", { earlyStart: false });
    expect(wall(late.startAt)).toBe("2026-12-12 00:00");
    expect(berlinDay(late.startAt)).toBe(berlinDay(new Date(at("2026-11-27 11:59").getTime() + 15 * 86_400_000)));
    // 12 December is a Saturday: due like a Monday-morning order.
    expect(wall(late.dueAt)).toBe("2026-12-15 18:00");
    // Starting on a working day at midnight is before noon: due the next working day.
    expect(wall(plan("2026-11-24 15:00", { earlyStart: false }).dueAt)).toBe("2026-12-10 18:00");
  });

  it("keeps 18:00 local across the summer-time changes", () => {
    expect(wall(plan("2026-03-27 11:00").dueAt)).toBe("2026-03-30 18:00");
    expect(plan("2026-03-27 11:00").dueAt.toISOString()).toBe("2026-03-30T16:00:00.000Z");
    expect(wall(plan("2026-03-27 13:00").dueAt)).toBe("2026-03-31 18:00");
    expect(wall(plan("2026-10-23 11:00").dueAt)).toBe("2026-10-26 18:00");
    expect(plan("2026-10-23 11:00").dueAt.toISOString()).toBe("2026-10-26T17:00:00.000Z");
  });

  it("refuses to search forever when nothing can be booked", () => {
    expect(() => plan("2026-11-27 11:59", { capacity: 0 })).toThrow("linkyo:noCapacity");
  });
});

describe("briefing, revisions and billing", () => {
  it("wants the briefing by 12:00 of the working day before", () => {
    expect(wall(briefingByFor(at("2026-11-30 18:00")))).toBe("2026-11-27 12:00");
    expect(wall(briefingByFor(at("2027-03-30 18:00")))).toBe("2027-03-25 12:00");
  });

  it("an on-time briefing keeps the promised date, even on a full day", () => {
    const promisedDue = at("2026-11-30 18:00");
    const due = dueOnBriefing({ now: at("2026-11-27 11:30"), promisedDue, startAfter: at("2026-11-27 11:00"), capacity: 1, bookedWithoutThis: new Map([["2026-11-30", 1]]) });
    expect(due).toEqual(promisedDue);
  });

  it("a late briefing gets the next free working day (the order itself not counted)", () => {
    const promisedDue = at("2026-11-30 18:00");
    const late = { now: at("2026-11-27 15:00"), promisedDue, startAfter: at("2026-11-27 11:00"), capacity: 1 };
    expect(wall(dueOnBriefing({ ...late, bookedWithoutThis: new Map() }))).toBe("2026-12-01 18:00");
    expect(wall(dueOnBriefing({ ...late, bookedWithoutThis: new Map([["2026-12-01", 1]]) }))).toBe("2026-12-02 18:00");
  });

  it("a late briefing never starts before the withdrawal period ends", () => {
    const due = dueOnBriefing({ now: at("2026-12-01 10:00"), promisedDue: at("2026-11-30 18:00"), startAfter: at("2026-12-12 00:00"), capacity: 4, bookedWithoutThis: new Map() });
    expect(wall(due)).toBe("2026-12-15 18:00");
  });

  it("delivers a revision within 2 working days", () => {
    expect(wall(revisionDue(at("2026-11-30 10:00")))).toBe("2026-12-02 18:00");
    expect(wall(revisionDue(at("2026-11-27 16:00")))).toBe("2026-12-01 18:00");
    expect(wall(revisionDue(at("2026-12-23 10:00")))).toBe("2026-12-28 18:00");
  });

  it("renews Pro on the anchor's day, on the last day in shorter months", () => {
    expect(billingDay(new Date("2027-01-31T10:00:00Z"))).toEqual({ day: 31, shortMonths: true });
    expect(billingDay(new Date("2027-01-15T10:00:00Z"))).toEqual({ day: 15, shortMonths: false });
    expect(billingDay(new Date("2027-01-29T10:00:00Z"))).toEqual({ day: 29, shortMonths: true });
  });

  it("finds the end of the billing period that contains a wanted date", () => {
    const periodEnd = new Date("2027-01-31T10:00:00Z");
    expect(periodEndContaining(periodEnd, "2027-02-10")).toEqual(new Date("2027-02-28T10:00:00Z"));
    expect(periodEndContaining(periodEnd, "2027-01-15")).toEqual(periodEnd);
    expect(periodEndContaining(periodEnd, "2027-01-31")).toEqual(periodEnd);
    expect(periodEndContaining(periodEnd, "2027-02-28")).toEqual(new Date("2027-02-28T10:00:00Z"));
    expect(periodEndContaining(periodEnd, "2027-03-01")).toEqual(new Date("2027-03-31T10:00:00Z"));
    // After a short month, the anchor tells the true next boundary.
    expect(periodEndContaining(new Date("2027-02-28T10:00:00Z"), "2027-03-05", periodEnd)).toEqual(new Date("2027-03-31T10:00:00Z"));
    expect(periodEndContaining(new Date("2026-12-15T09:00:00Z"), "2027-01-20")).toEqual(new Date("2027-02-15T09:00:00Z"));
  });
});
