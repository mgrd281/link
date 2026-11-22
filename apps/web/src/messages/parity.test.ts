import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "./ar.json";
import de from "./de.json";
import en from "./en.json";

/**
 * The three message files: identical keys, and every string of the AI builder, the page service,
 * the legal flows and the team console formats without an ICU error in all three languages.
 */

type Messages = Record<string, unknown>;
const FILES = { de, en, ar } as Record<"de" | "en" | "ar", Messages>;
const LOCALES = ["de", "en", "ar"] as const;

/** Every leaf (a string or an array read with t.raw) by its dotted key. */
function leaves(messages: Messages, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) for (const [inner, leaf] of leaves(value as Messages, path)) out.set(inner, leaf);
    else out.set(path, value);
  }
  return out;
}

const flat = Object.fromEntries(LOCALES.map((locale) => [locale, leaves(FILES[locale])])) as Record<(typeof LOCALES)[number], Map<string, unknown>>;

/** The namespaces and keys v7 added or changed (plan §1.9). */
const V7 = [
  "ai",
  "app.ai",
  "app.orders",
  "app.proposals",
  "orders",
  "legal",
  "service",
  "checkout",
  "email",
  "admin.orders",
  "admin.nav.orders",
  "app.meta.build",
  "app.meta.order",
  "app.meta.proposal",
  "app.welcome.start",
  "app.welcome.fromAi",
  "app.welcome.import",
  "app.home.ai",
  "app.home.proposal",
  "app.home.stats.empty",
  "app.home.link.live",
  "app.analytics.empty",
  "app.analytics.leadReal",
  "app.editor.withAi",
  "app.editor.aiTag",
  "app.save.tooLarge",
  "app.form.imageErrors.upload",
  "app.add.imageErrors.upload",
  "app.settings.groups.contracts",
  "app.settings.rows",
  "app.settings.footers.contracts",
  "app.invite.rules.proLive",
  "marketing.try.sample",
  "marketing.try.ai",
  "marketing.pricing.leadPaid",
  "marketing.pricing.proLive",
  "marketing.real",
  "auth.signup.draft",
  "creator.notFound",
  "creator.legalTitle",
];
const inV7 = (key: string) => V7.some((prefix) => key === prefix || key.startsWith(`${prefix}.`));
const v7Keys = [...flat.de.keys()].filter(inV7);

type Value = string | number | Date | ((chunks: string) => string);

interface LooseTranslator {
  raw(key: string): unknown;
  markup(key: string, values: Record<string, Value>): string;
}

/** Placeholder values for every argument and tag a message uses: numbers for plurals, a word otherwise. */
function valuesFor(message: string, count: number): Record<string, Value> {
  const values: Record<string, Value> = {};
  for (const [, name] of message.matchAll(/\{\s*(\w+)\s*\}/g)) if (name) values[name] = "X";
  for (const [, name, type] of message.matchAll(/\{\s*(\w+)\s*,\s*(plural|selectordinal|select|number|date|time)\b/g)) {
    if (!name) continue;
    values[name] = type === "select" ? "yes" : type === "date" || type === "time" ? new Date("2026-11-30T17:00:00Z") : count;
  }
  for (const [, tag] of message.matchAll(/<(\w+)>/g)) if (tag) values[tag] = (chunks: string) => `[${chunks}]`;
  return values;
}

describe("messages", () => {
  it("have the same keys in de, en and ar", () => {
    const keys = (locale: (typeof LOCALES)[number]) => [...flat[locale].keys()].sort();
    expect(keys("en")).toEqual(keys("de"));
    expect(keys("ar")).toEqual(keys("de"));
  });

  it("cover every v7 namespace", () => {
    for (const prefix of V7) expect(v7Keys.some((key) => key === prefix || key.startsWith(`${prefix}.`)), prefix).toBe(true);
    expect(v7Keys.length).toBeGreaterThan(550);
  });

  for (const locale of LOCALES) {
    it(`format every v7 string without an ICU error (${locale})`, () => {
      const errors: string[] = [];
      // Keys are dynamic here, so the translator is used without its key types.
      const t = createTranslator({ locale, messages: FILES[locale], onError: (error) => errors.push(`${error.code}: ${error.message}`) }) as unknown as LooseTranslator;
      for (const key of v7Keys) {
        const message = flat[locale].get(key);
        if (Array.isArray(message)) {
          expect(message.length, key).toBe((flat.de.get(key) as unknown[]).length);
          for (const item of message) expect(typeof item === "string" && item.trim().length > 0, key).toBe(true);
          expect(t.raw(key), key).toEqual(message);
          continue;
        }
        expect(typeof message, key).toBe("string");
        for (const count of [0, 1, 2, 5]) {
          const text = t.markup(key, valuesFor(String(message), count));
          expect(text, key).not.toMatch(/[{}]/);
          expect(text.trim().length, key).toBeGreaterThan(0);
        }
      }
      expect(errors).toEqual([]);
    });
  }

  it("say Arbeitstag, never Werktag, in German service, checkout and e-mail texts", () => {
    const offenders = [...flat.de].filter(([key, value]) => /^(service|checkout|email)\./.test(key) && /werktag/i.test(JSON.stringify(value)));
    expect(offenders).toEqual([]);
  });

  it("promise the voluntary money-back once per account wherever it appears", () => {
    for (const key of ["service.conditions.refund", "service.refund.body", "app.proposals.refund"]) expect(flat.de.get(key), key).toMatch(/einmal pro Konto/i);
    for (const key of ["service.conditions.refund", "service.refund.body", "app.proposals.refund"]) expect(flat.en.get(key), key).toMatch(/once per account/i);
  });

  it("write Arabic numbers with Western digits", () => {
    const offenders = v7Keys.filter((key) => /[٠-٩۰-۹]/.test(JSON.stringify(flat.ar.get(key))));
    expect(offenders).toEqual([]);
  });
});
