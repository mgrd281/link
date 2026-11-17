import { MarketingFooter } from "./footer";
import { MarketingHeader } from "./header";
import { Hero } from "./hero";
import { Analytics, Faq, FinalCta, PasteSection, Pricing, Proof, Story, Templates } from "./sections";

/** linkyo.app — the marketing home (de/en/ar). */
export function MarketingHome({ locale }: { locale: string }) {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="grid grid-cols-1 gap-4 pt-4">
        <Hero locale={locale} />
        <Proof />
        <Templates />
        <Story />
        <PasteSection />
        <Analytics />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}
