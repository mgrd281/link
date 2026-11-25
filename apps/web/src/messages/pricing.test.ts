import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { billingQuestions, faqQuestions, freeTrustBody, pricingPlans, pricingValues, type MessageRef, type SiteState } from "@/features/marketing/pricing";
import { VAT_MODE } from "@/features/payments/prices";

import ar from "./ar.json";
import de from "./de.json";
import en from "./en.json";

/**
 * The pricing comparison (W-06) and every sentence around it say only what the code does: Free is
 * there now, Pro and the page service come with the start while payments are off, and a feature that
 * is live is never qualified as being built. Read through the same model the page and its structured
 * data use (features/marketing/pricing.ts), in all three languages.
 */
const FILES = { de, en, ar } as const;
type Locale = keyof typeof FILES;
const LOCALES = ["de", "en", "ar"] as const satisfies readonly Locale[];

/** "Being built" in each language: never next to a feature that is live. */
const IN_THE_WORKS = /in Arbeit|in the works|قيد التطوير/i;
/** The live feature that used to carry it: the cookie-free statistics ("Analytics ohne Cookies"). */
const STATISTICS = { de: /Analytics|Statistik/, en: /analytics|stats/i, ar: /إحصاء/ } as const;

/** The translator without its key types: the keys are built by the model. */
interface Loose {
  markup(key: string, values: Record<string, string | number | ((chunks: string) => string)>): string;
}

const plain = (locale: Locale) => {
  const t = createTranslator({ locale, messages: FILES[locale], namespace: "marketing" }) as unknown as Loose;
  return ({ key, values }: MessageRef) => t.markup(key, { ...values, bdi: (chunks: string) => chunks });
};

const STATES: SiteState[] = [
  { payments: false, statistics: true },
  { payments: false, statistics: false },
  { payments: true, statistics: true },
  { payments: true, statistics: false },
];

/** Every sentence the home page's pricing, FAQ and trust card show in a state. */
function sentences(locale: Locale, state: SiteState): string[] {
  const text = plain(locale);
  const lines = pricingPlans(state).flatMap((plan) => plan.lines.map((line) => text({ key: line.key, values: pricingValues(locale) })));
  const questions = [...faqQuestions(state, FILES[locale].marketing.faq.items.length), ...billingQuestions(state, locale)].flatMap(({ q, a }) => [text(q), text(a)]);
  return [...lines, ...questions, text(freeTrustBody(state))];
}

describe("the pricing comparison", () => {
  it("keeps now apart from the start: Free now, Pro and the page service with the start while payments are off", () => {
    const plans = pricingPlans({ payments: false, statistics: true });
    expect(plans.map((plan) => [plan.id, plan.when])).toEqual([
      ["free", "now"],
      ["pro", "launch"],
      ["service", "launch"],
    ]);
    // Pro ships AI drafts with the start; its own domain, selling and the list are planned (ADR 0066).
    const pro = plans.find((plan) => plan.id === "pro");
    expect(pro?.lines.filter((line) => line.when === "planned").map((line) => line.key)).toEqual(["pricing.pro.lines.domain", "pricing.pro.lines.selling", "pricing.pro.lines.list"]);
    expect(pro?.lines.filter((line) => line.when !== "planned").every((line) => line.when === "launch")).toBe(true);
    // Nothing of Free is "coming": every Free line is there today.
    expect(plans[0]?.lines.every((line) => line.when === "now")).toBe(true);
  });

  it("sells Pro and the page service now once payments are on", () => {
    const plans = pricingPlans({ payments: true, statistics: true });
    expect(plans.map((plan) => plan.when)).toEqual(["now", "now", "now"]);
  });

  it("lists the cookie-free statistics as there today where pages are counted, and as planned where not", () => {
    const line = (statistics: boolean) => pricingPlans({ payments: false, statistics })[0]?.lines.find((entry) => entry.key.endsWith(".statistics"))?.when;
    expect(line(true)).toBe("now");
    expect(line(false)).toBe("planned");
  });

  it("asks different questions before and after the start, and never promises Pro's checkout before it", () => {
    const keys = (payments: boolean) => billingQuestions({ payments, statistics: true }, "de").map(({ q }) => q.key.split(".")[3]);
    expect(keys(false)).toEqual(["card", "when", "cancel", "service"]);
    expect(keys(true)).toEqual(["card", "pay", "cancel", "ends", "service"]);
  });
});

describe("pricing messages", () => {
  for (const locale of LOCALES) {
    it(`${locale}: no "in the works" beside the statistics where pages are counted`, () => {
      for (const state of STATES.filter((entry) => entry.statistics)) {
        // The iOS app's answer is about the app, which is still being built (its widget shows the stats).
        const about = sentences(locale, state).filter((sentence) => STATISTICS[locale].test(sentence) && !sentence.includes("iOS"));
        expect(about.length, "the statistics are named").toBeGreaterThan(0);
        expect(
          about.filter((sentence) => IN_THE_WORKS.test(sentence)),
          JSON.stringify(state),
        ).toEqual([]);
      }
    });

    it(`${locale}: every sentence formats, with the prices from prices.ts`, () => {
      for (const state of STATES) {
        for (const sentence of sentences(locale, state)) {
          expect(sentence.trim().length).toBeGreaterThan(0);
          expect(sentence).not.toMatch(/[{}<>]/);
        }
      }
      const before = billingQuestions({ payments: false, statistics: true }, locale).map(({ a }) => plain(locale)(a)).join(" ");
      expect(before).toContain(String(pricingValues(locale).price));
      expect(before).toContain(String(pricingValues(locale).start));
    });

    it(`${locale}: the page service starts at the Start package's price, Pro costs its monthly price`, () => {
      const values = pricingValues(locale);
      const from = plain(locale)({ key: "pricing.service.from", values });
      expect(from).toContain(String(values.start));
      expect(from).not.toContain(String(values.price));
      expect(plain(locale)({ key: "pricing.pro.lines.drafts", values })).toContain(String(values.count));
    });

    it(`${locale}: Free names no app that is still being built`, () => {
      for (const line of Object.values(FILES[locale].marketing.pricing.free.lines)) {
        expect(line).not.toMatch(/iOS|in Arbeit|قيد التطوير|\(coming\)/i);
      }
    });
  }

  it("the FAQ still says honestly that the iOS app is in the works", () => {
    expect(de.marketing.faq.items.at(-1)?.a).toMatch(/iOS-App ist in Arbeit/);
    expect(en.marketing.faq.items.at(-1)?.a).toMatch(/iOS app is in the works/);
    expect(ar.marketing.faq.items.at(-1)?.a).toMatch(/iOS/);
  });

  it("names prices with VAT included, as the price configuration says (ADR 0066)", () => {
    // The billing answers say "inklusive Mehrwertsteuer": they would need new words without VAT.
    expect(VAT_MODE).toBe("standard19");
  });
});
