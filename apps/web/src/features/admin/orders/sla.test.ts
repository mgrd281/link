import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { refundDueAt, slaAmount, slaChip, slaState, SOON_MS, type SlaT } from "./sla";

const now = new Date("2026-11-23T10:00:00Z");
const at = (ms: number) => new Date(now.getTime() + ms);
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const translator = (locale: "de" | "en" | "ar", messages: typeof de): SlaT => {
  const t = createTranslator({ locale, messages, namespace: "admin.orders.sla" });
  return (key, values) => t(key, values);
};
const tDe = translator("de", de);
const tEn = translator("en", en);
const tAr = translator("ar", ar);
const text = (ms: number, t: SlaT) => slaChip(at(ms), now, t).text;

describe("slaState", () => {
  it("is ok above 4 hours, soon at 4 hours or less, overdue after the deadline", () => {
    expect(slaState(at(SOON_MS + 1), now)).toBe("ok");
    expect(slaState(at(SOON_MS), now)).toBe("soon");
    expect(slaState(at(60_000), now)).toBe("soon");
    expect(slaState(at(0), now)).toBe("soon");
    expect(slaState(at(-1), now)).toBe("overdue");
  });
});

describe("slaAmount", () => {
  it("rounds down to days, hours or minutes, never zero", () => {
    expect(slaAmount(3 * DAY + 5 * HOUR)).toEqual({ count: 3, unit: "day" });
    expect(slaAmount(2 * DAY)).toEqual({ count: 2, unit: "day" });
    expect(slaAmount(30 * HOUR)).toEqual({ count: 30, unit: "hour" });
    expect(slaAmount(3 * HOUR + 59 * MINUTE)).toEqual({ count: 3, unit: "hour" });
    expect(slaAmount(25 * MINUTE)).toEqual({ count: 25, unit: "minute" });
    expect(slaAmount(10_000)).toEqual({ count: 1, unit: "minute" });
    expect(slaAmount(-2 * HOUR)).toEqual({ count: 2, unit: "hour" });
  });
});

describe("slaChip", () => {
  it("has text for every state, with the tone as a second signal", () => {
    expect(slaChip(at(26 * HOUR), now, tDe)).toEqual({ state: "ok", tone: "neutral", text: "in 26 Std." });
    expect(slaChip(at(2 * HOUR), now, tDe)).toEqual({ state: "soon", tone: "warning", text: "bald fällig: in 2 Std." });
    expect(slaChip(at(-3 * DAY), now, tDe)).toEqual({ state: "overdue", tone: "danger", text: "überfällig seit 3 Tagen" });
  });

  it("puts German days in the dative after 'seit' and 'in'", () => {
    expect(text(-3 * DAY, tDe)).toBe("überfällig seit 3 Tagen");
    expect(text(-21 * DAY, tDe)).toBe("überfällig seit 21 Tagen");
    expect(text(5 * DAY, tDe)).toBe("in 5 Tagen");
    expect(text(-25 * MINUTE, tDe)).toBe("überfällig seit 25 Min.");
    expect(text(-MINUTE, tDe)).toBe("überfällig seit 1 Min.");
    // Days start at two, so "1 Tag" never shows on a chip; the form is still right when it is asked for.
    expect(tDe("overdue", { time: tDe("time.day", { count: 1 }) })).toBe("überfällig seit 1 Tag");
    expect(tDe("ok", { time: tDe("time.day", { count: 1 }) })).toBe("in 1 Tag");
    for (const ms of [-3 * DAY, 5 * DAY, -30 * HOUR, -MINUTE]) expect(text(ms, tDe)).not.toMatch(/\d+ Tage$/);
  });

  it("speaks English with singular and plural", () => {
    expect(text(-5 * HOUR, tEn)).toBe("overdue by 5 hr");
    expect(text(-HOUR, tEn)).toBe("overdue by 1 hr");
    expect(text(3 * DAY, tEn)).toBe("in 3 days");
    expect(text(2 * HOUR, tEn)).toBe("due soon: in 2 hr");
    expect(text(-40 * MINUTE, tEn)).toBe("overdue by 40 min");
    expect(tEn("time.day", { count: 1 })).toBe("1 day");
  });

  it("uses every Arabic plural class, in the form that follows the preposition", () => {
    expect(text(-HOUR, tAr)).toBe("متأخر منذ ساعة واحدة");
    expect(text(-2 * HOUR, tAr)).toBe("متأخر منذ ساعتين");
    expect(text(-5 * HOUR, tAr)).toBe("متأخر منذ 5 ساعات");
    expect(text(-11 * HOUR, tAr)).toBe("متأخر منذ 11 ساعة");
    expect(text(-2 * DAY, tAr)).toBe("متأخر منذ يومين");
    expect(text(3 * DAY, tAr)).toBe("خلال 3 أيام");
    expect(text(11 * DAY, tAr)).toBe("خلال 11 يومًا");
    expect(text(-100 * DAY, tAr)).toBe("متأخر منذ 100 يوم");
    expect(text(-MINUTE, tAr)).toBe("متأخر منذ دقيقة واحدة");
    expect(text(-2 * MINUTE, tAr)).toBe("متأخر منذ دقيقتين");
    expect(text(3 * MINUTE, tAr)).toBe("يستحق قريبًا: خلال 3 دقائق");
    expect(text(-25 * MINUTE, tAr)).toBe("متأخر منذ 25 دقيقة");
  });

  it("writes Western digits in Arabic", () => {
    for (const ms of [-5 * HOUR, 3 * DAY, -25 * MINUTE, -100 * DAY]) expect(text(ms, tAr)).not.toMatch(/[٠-٩]/);
  });
});

describe("refund deadline", () => {
  it("is 14 days after the withdrawal arrived, with the same chip", () => {
    const received = new Date("2026-11-10T09:30:00Z");
    const due = refundDueAt(received);
    expect(due.toISOString()).toBe("2026-11-24T09:30:00.000Z");
    expect(slaChip(due, now, tDe).state).toBe("ok");
    expect(slaChip(due, new Date("2026-11-24T07:00:00Z"), tDe)).toMatchObject({ state: "soon", tone: "warning" });
    expect(slaChip(due, new Date("2026-11-25T09:30:00Z"), tDe)).toEqual({ state: "overdue", tone: "danger", text: "überfällig seit 24 Std." });
    expect(slaChip(due, new Date("2026-11-27T09:30:00Z"), tDe).text).toBe("überfällig seit 3 Tagen");
  });
});
