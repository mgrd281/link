import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { refundDueAt, slaChip, slaDuration, slaState, SOON_MS, type SlaT } from "./sla";

const now = new Date("2026-11-23T10:00:00Z");
const at = (ms: number) => new Date(now.getTime() + ms);
const HOUR = 3_600_000;

const translator = (locale: "de" | "en" | "ar", messages: typeof de): SlaT => {
  const t = createTranslator({ locale, messages, namespace: "admin.orders.sla" });
  return (key, values) => t(key, values);
};

describe("slaState", () => {
  it("is ok above 4 hours, soon at 4 hours or less, overdue after the deadline", () => {
    expect(slaState(at(SOON_MS + 1), now)).toBe("ok");
    expect(slaState(at(SOON_MS), now)).toBe("soon");
    expect(slaState(at(60_000), now)).toBe("soon");
    expect(slaState(at(0), now)).toBe("soon");
    expect(slaState(at(-1), now)).toBe("overdue");
  });
});

describe("slaDuration", () => {
  it("rounds down to days, hours or minutes, never zero", () => {
    expect(slaDuration(3 * 24 * HOUR + 5 * HOUR, "de")).toBe("3 Tage");
    expect(slaDuration(30 * HOUR, "de")).toBe("30 Std.");
    expect(slaDuration(3 * HOUR + 59 * 60_000, "de")).toBe("3 Std.");
    expect(slaDuration(25 * 60_000, "de")).toBe("25 Min.");
    expect(slaDuration(10_000, "de")).toBe("1 Min.");
    expect(slaDuration(-2 * HOUR, "en")).toBe("2 hr");
  });

  it("writes Western digits in Arabic", () => {
    expect(slaDuration(3 * HOUR, "ar")).toMatch(/3/);
    expect(slaDuration(3 * HOUR, "ar")).not.toMatch(/[٠-٩]/);
  });
});

describe("slaChip", () => {
  it("has text for every state, with the tone as a second signal", () => {
    const t = translator("de", de);
    expect(slaChip(at(26 * HOUR), now, "de", t)).toEqual({ state: "ok", tone: "neutral", text: "in 26 Std." });
    expect(slaChip(at(2 * HOUR), now, "de", t)).toEqual({ state: "soon", tone: "warning", text: "bald fällig: in 2 Std." });
    expect(slaChip(at(-3 * 24 * HOUR), now, "de", t)).toEqual({ state: "overdue", tone: "danger", text: "überfällig seit 3 Tage" });
  });

  it("speaks English and Arabic", () => {
    expect(slaChip(at(-5 * HOUR), now, "en", translator("en", en)).text).toBe("overdue by 5 hr");
    const text = slaChip(at(-5 * HOUR), now, "ar", translator("ar", ar)).text;
    expect(text).toContain("متأخر منذ");
    expect(text).toContain("5");
  });
});

describe("refund deadline", () => {
  it("is 14 days after the withdrawal arrived, with the same chip", () => {
    const received = new Date("2026-11-10T09:30:00Z");
    const due = refundDueAt(received);
    expect(due.toISOString()).toBe("2026-11-24T09:30:00.000Z");
    const t = translator("de", de);
    expect(slaChip(due, now, "de", t).state).toBe("ok");
    expect(slaChip(due, new Date("2026-11-24T07:00:00Z"), "de", t)).toMatchObject({ state: "soon", tone: "warning" });
    expect(slaChip(due, new Date("2026-11-25T09:30:00Z"), "de", t)).toEqual({ state: "overdue", tone: "danger", text: "überfällig seit 24 Std." });
  });
});
