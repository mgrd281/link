import { MarketingFooter } from "./footer";
import { MarketingHeader } from "./header";
import { Hero } from "./hero";
import { Features, TryIt } from "./features";
import { PortfolioBand } from "./portfolio/band";
import { Faq, FinalCta, Pricing, Templates, Trust } from "./sections";

/** linkyo.app — the marketing home (de/en/ar): light, calm, the product in motion. */
export function MarketingHome() {
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
        <FinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}
