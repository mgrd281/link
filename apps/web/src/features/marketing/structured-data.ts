import { PRICES } from "@/features/payments/prices";

import type { SiteState } from "./pricing";

/** A question and its answer as plain text. */
export interface QuestionAndAnswer {
  q: string;
  a: string;
}

/**
 * The home page's structured data for search engines (schema.org JSON-LD), one block each: who runs
 * the site (Organization), the site (WebSite), the product with what can be had today
 * (SoftwareApplication with its Offers) and the questions answered on the page (FAQPage). Written into
 * the page with `jsonLd()` (lib/json-ld.ts). Pure, so lib tests parse what the page writes.
 *
 * Offers name only what can be had today: the free plan always; Pro only once payments are on (the
 * page service is a service, not the software). No contact data: the Impressum carries it.
 */
export interface StructuredDataInput {
  /** The site's origin, e.g. https://linkyo.app. */
  base: URL;
  locale: string;
  /** The product in one sentence (the home page's own meta description). */
  description: string;
  /** Offer names, in the visitor's language. */
  names: { free: string; pro: string };
  /** The FAQ as the page shows it (FAQ and the pricing questions). */
  faq: readonly QuestionAndAnswer[];
  state: SiteState;
}

const CONTEXT = "https://schema.org";

/** A price in schema.org's form: euros with a point and two decimals ("8.00"). */
const euros = (cents: number) => (cents / 100).toFixed(2);

export function homeStructuredData({ base, locale, description, names, faq, state }: StructuredDataInput): Record<string, unknown>[] {
  const at = (path: string) => new URL(path, base).toString();
  const home = at(`/${locale}`);
  const organization = { "@context": CONTEXT, "@type": "Organization", "@id": at("/#organization"), name: "Linkyo", url: at("/"), logo: at("/apple-icon.png") };
  const website = {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": at("/#website"),
    name: "Linkyo",
    url: home,
    inLanguage: locale,
    publisher: { "@id": organization["@id"] },
  };
  const offers: Record<string, unknown>[] = [{ "@type": "Offer", name: names.free, price: "0", priceCurrency: "EUR", url: at(`/${locale}/signup`) }];
  if (state.payments) {
    const pro = PRICES["pro-monthly"];
    offers.push({
      "@type": "Offer",
      name: names.pro,
      price: euros(pro.amountCents),
      priceCurrency: pro.currency,
      url: at(`/${locale}/checkout/pro`),
      priceSpecification: { "@type": "UnitPriceSpecification", price: euros(pro.amountCents), priceCurrency: pro.currency, valueAddedTaxIncluded: true, unitCode: "MON" },
    });
  }
  const application = {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    name: "Linkyo",
    url: home,
    description,
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    inLanguage: locale,
    publisher: { "@id": organization["@id"] },
    offers,
  };
  const questions = {
    "@context": CONTEXT,
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return [organization, website, application, questions];
}
