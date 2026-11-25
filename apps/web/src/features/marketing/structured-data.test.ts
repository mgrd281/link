import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { VAT_MODE } from "@/features/payments/prices";
import { jsonLd } from "@/lib/json-ld";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { billingQuestions, faqQuestions, type MessageRef, type SiteState } from "./pricing";
import { homeStructuredData } from "./structured-data";

/**
 * The home page's JSON-LD, built as app/[locale]/page.tsx builds it and parsed back from what the page
 * writes: Organization, WebSite, SoftwareApplication with an Offer for what can be had today, and
 * FAQPage from the FAQ the page shows (with the pricing questions).
 */
const FILES = { de, en, ar } as const;
type Locale = keyof typeof FILES;
const base = new URL("https://linkyo.example");

/** The translator without its key types: the keys are built by the model. */
interface Loose {
  (key: string): string;
  markup(key: string, values: Record<string, string | number | ((chunks: string) => string)>): string;
}

function build(locale: Locale, state: SiteState) {
  const t = createTranslator({ locale, messages: FILES[locale], namespace: "marketing" }) as unknown as Loose;
  const plain = ({ key, values }: MessageRef) => t.markup(key, { ...values, bdi: (chunks: string) => chunks });
  const faq = [...faqQuestions(state, FILES[locale].marketing.faq.items.length), ...billingQuestions(state, locale)].map(({ q, a }) => ({ q: plain(q), a: plain(a) }));
  const blocks = homeStructuredData({ base, locale, description: "Linkyo", names: { free: t("pricing.free.name"), pro: t("pricing.pro.name") }, faq, state });
  // What the page writes, read back as a search engine reads it.
  return { faq, parsed: blocks.map((block) => JSON.parse(jsonLd(block)) as Record<string, unknown>) };
}

const byType = (blocks: Record<string, unknown>[], type: string) => blocks.find((block) => block["@type"] === type);

describe("home page structured data", () => {
  for (const locale of ["de", "en", "ar"] as const) {
    it(`${locale}: four blocks that parse, each in schema.org's context`, () => {
      const { parsed } = build(locale, { payments: false, statistics: true });
      expect(parsed.map((block) => block["@type"])).toEqual(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]);
      for (const block of parsed) expect(block["@context"]).toBe("https://schema.org");
    });

    it(`${locale}: the organization and the site name Linkyo and its addresses`, () => {
      const { parsed } = build(locale, { payments: false, statistics: true });
      const organization = byType(parsed, "Organization");
      expect(organization).toMatchObject({ name: "Linkyo", url: "https://linkyo.example/", logo: "https://linkyo.example/apple-icon.png" });
      expect(byType(parsed, "WebSite")).toMatchObject({ name: "Linkyo", url: `https://linkyo.example/${locale}`, inLanguage: locale, publisher: { "@id": organization?.["@id"] } });
    });

    it(`${locale}: the FAQ is the page's own, question by question`, () => {
      const { parsed, faq } = build(locale, { payments: false, statistics: true });
      const page = byType(parsed, "FAQPage") as { mainEntity: { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[] };
      expect(page.mainEntity).toHaveLength(faq.length);
      expect(page.mainEntity.length).toBeGreaterThanOrEqual(FILES[locale].marketing.faq.items.length + 4);
      page.mainEntity.forEach((entry, index) => {
        expect(entry["@type"]).toBe("Question");
        expect(entry.name).toBe(faq[index]?.q);
        expect(entry.acceptedAnswer).toEqual({ "@type": "Answer", text: faq[index]?.a });
        expect(entry.name + entry.acceptedAnswer.text).not.toMatch(/[{}<>]/);
      });
    });
  }

  it("offers only the free plan while nothing can be bought", () => {
    const { parsed } = build("de", { payments: false, statistics: true });
    const application = byType(parsed, "SoftwareApplication") as { offers: Record<string, unknown>[]; name: string; operatingSystem: string; applicationCategory: string };
    expect(application).toMatchObject({ name: "Linkyo", operatingSystem: "Web", applicationCategory: "DesignApplication" });
    expect(application.offers).toEqual([{ "@type": "Offer", name: "Free", price: "0", priceCurrency: "EUR", url: "https://linkyo.example/de/signup" }]);
  });

  it("adds Pro's monthly offer, VAT included, once it can be bought", () => {
    const { parsed } = build("de", { payments: true, statistics: true });
    const application = byType(parsed, "SoftwareApplication") as { offers: Record<string, unknown>[] };
    expect(application.offers).toHaveLength(2);
    expect(application.offers[1]).toMatchObject({
      "@type": "Offer",
      name: "Pro",
      price: "8.00",
      priceCurrency: "EUR",
      url: "https://linkyo.example/de/checkout/pro",
      // VAT as the price configuration shows it (VAT_MODE): included with the standard rate.
      priceSpecification: { "@type": "UnitPriceSpecification", price: "8.00", unitCode: "MON", valueAddedTaxIncluded: VAT_MODE === "standard19" },
    });
  });
});
