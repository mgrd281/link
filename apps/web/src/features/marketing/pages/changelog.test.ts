import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { CHANGELOG, formatDay } from "./changelog";

/**
 * The changelog holds real, dated entries from the stages that shipped: each date is a day of the
 * history (the first commit is from 2026-11-17), newest first, and every entry has its words in all
 * three languages.
 */
const FILES = { de, en, ar } as const;
const entries = (locale: keyof typeof FILES) => FILES[locale].sitePages.changelog.entries as Record<string, { title: string; items: string[] }>;

describe("changelog", () => {
  it("lists entries newest first, on real days of the project", () => {
    const dates = CHANGELOG.map((entry) => entry.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${date}T00:00:00Z`))).toBe(false);
      // The repository starts on 2026-11-17; the newest entry is the polish pass of 2026-11-25.
      expect(date >= "2026-11-17" && date <= "2026-11-25", date).toBe(true);
    }
    expect(new Set(CHANGELOG.map((entry) => entry.key)).size).toBe(CHANGELOG.length);
  });

  for (const locale of ["de", "en", "ar"] as const) {
    it(`${locale}: every entry has a title and the same number of lines as in German`, () => {
      for (const { key } of CHANGELOG) {
        const entry = entries(locale)[key];
        expect(entry?.title.trim().length, key).toBeGreaterThan(3);
        expect(entry?.items.length, key).toBe(entries("de")[key]?.items.length);
        for (const item of entry?.items ?? []) expect(item.trim().length, key).toBeGreaterThan(10);
      }
      // No entry in the messages without its date.
      expect(Object.keys(entries(locale)).sort()).toEqual(CHANGELOG.map((entry) => entry.key).sort());
    });
  }

  it("names no switched-off part as live (payments, the AI builder)", () => {
    for (const locale of ["de", "en", "ar"] as const) {
      const text = JSON.stringify(entries(locale));
      expect(text, locale).not.toMatch(/Stripe|Checkout|KI-Entw|AI draft|الذكاء الاصطناعي/);
    }
  });

  it("writes days in each language with Western digits", () => {
    expect(formatDay("2026-11-25", "de")).toBe("25. November 2026");
    expect(formatDay("2026-11-25", "en")).toBe("November 25, 2026");
    expect(formatDay("2026-11-25", "ar")).toMatch(/25/);
    expect(formatDay("2026-11-25", "ar")).not.toMatch(/[٠-٩]/);
  });
});
