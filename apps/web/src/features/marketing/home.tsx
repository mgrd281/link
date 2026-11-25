import type { ReactNode } from "react";

import { MarketingFooter } from "./footer";
import { MarketingHeader } from "./header";
import { Hero } from "./hero";
import { Features, TryIt } from "./features";
import { PortfolioBand } from "./portfolio/band";
import { Faq, FinalCta, Pricing, Templates, Trust } from "./sections";

/**
 * linkyo.app — the marketing home (de/en/ar): light, calm, the product in motion.
 *
 * `structuredData` (the page's JSON-LD) is written right after the questions: its FAQ repeats the
 * questions and answers of the prices and the FAQ word for word, and next to them the page's
 * compression finds those words again (the home page's HTML is budgeted, ADR 0008).
 */
export function MarketingHome({ structuredData }: { structuredData?: ReactNode } = {}) {
  return (
    <>
      {/* On phones, sign-up joins the header once the hero's own sign-up has been passed. */}
      <MarketingHeader signupAfter="hero-cta" wide />
      <main id="main" className="grid grid-cols-1">
        <Hero />
        <Trust />
        <Templates />
        {/* Portfolios: two real pages, and the way to the Portfolio page. */}
        <PortfolioBand />
        <TryIt />
        <Features />
        <Pricing />
        <Faq />
        {structuredData}
        <FinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}
