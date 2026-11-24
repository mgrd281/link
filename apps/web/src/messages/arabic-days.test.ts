import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "./ar.json";

/**
 * The 7/30/90-day ranges in Arabic: the noun follows the number's rule (3–10 take the plural "أيام",
 * 11–99 the singular "يومًا"), so "7 أيام" and "30 يومًا", never "7 يومًا". The ranges pass a number,
 * so the plural can choose.
 */
describe("Arabic day ranges", () => {
  const stats = createTranslator({ locale: "ar", messages: ar, namespace: "app.analytics" });
  const overview = createTranslator({ locale: "ar", messages: ar, namespace: "admin.overview" });

  it("on the creator's Stats", () => {
    expect([7, 30, 90].map((days) => stats("days", { days }))).toEqual(["7 أيام", "30 يومًا", "90 يومًا"]);
    expect(stats("vsPrevious", { days: 7 })).toBe("مقارنةً بالأيام الـ7 السابقة");
  });

  it("on the team console's overview", () => {
    expect([7, 30, 90].map((days) => overview("days", { days }))).toEqual(["7 أيام", "30 يومًا", "90 يومًا"]);
    expect(overview("kpi.new", { days: 7 })).toBe("جدد خلال 7 أيام");
    expect(overview("kpi.vsStart", { days: 7 })).toBe("خلال 7 أيام");
    expect(overview("kpi.vsStart", { days: 30 })).toBe("خلال 30 يومًا");
    expect(overview("kpi.trend", { days: 7 })).toBe("الاتجاه خلال آخر 7 أيام");
  });
});
