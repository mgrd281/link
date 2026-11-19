import { MarketingFooter } from "./footer";
import { MarketingHeader } from "./header";
import { Hero } from "./hero";
import { Faq, Features, FinalCta, Pricing, Templates, Trust } from "./sections";

/** linkyo.app — the marketing home (de/en/ar): light, calm, the product in motion. */
export function MarketingHome() {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="grid grid-cols-1">
        <Hero />
        <Trust />
        <Templates />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}
