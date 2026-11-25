import { describe, expect, it } from "vitest";

import ar from "./ar.json";
import de from "./de.json";
import en from "./en.json";

/**
 * The pricing section's Free plan lists what a visitor gets today. The native iOS app is still
 * being built: it is no included feature, so it is not in this list in any language (the FAQ says
 * where the app stands). The Pricing component reads the list by position (`FREE_ANALYTICS`, the
 * cookie-free analytics line), so the list's shape is checked as well.
 */
const FREE = { de: de.marketing.pricing.free.features, en: en.marketing.pricing.free.features, ar: ar.marketing.pricing.free.features } as const;
const ANALYTICS_LINE = { de: /Analytics/, en: /analytics/i, ar: /إحصاءات/ } as const;

describe("the Free plan's feature list", () => {
  for (const locale of ["de", "en", "ar"] as const) {
    it(`${locale}: holds only features that exist today`, () => {
      const features = FREE[locale];
      for (const feature of features) {
        expect(feature, "an app that is still being built is not an included feature").not.toMatch(/iOS|in Arbeit|قيد التطوير|\(coming\)/i);
      }
    });

    it(`${locale}: five features, the analytics line stays where the component expects it`, () => {
      const features = FREE[locale];
      expect(features).toHaveLength(5);
      // marketing/sections.tsx: FREE_ANALYTICS = 3.
      expect(features[3]).toMatch(ANALYTICS_LINE[locale]);
    });
  }

  it("the FAQ still says honestly that the iOS app is in the works", () => {
    expect(de.marketing.faq.items.at(-1)?.a).toMatch(/iOS-App ist in Arbeit/);
    expect(en.marketing.faq.items.at(-1)?.a).toMatch(/iOS app is in the works/);
    expect(ar.marketing.faq.items.at(-1)?.a).toMatch(/iOS/);
  });
});
