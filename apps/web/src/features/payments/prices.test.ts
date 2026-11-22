import { describe, expect, it } from "vitest";

import { PRICE_CHANGELOG, PRICES, PRO_DRAFTS, REVISIONS, VAT_MODE, formatEuro, vatCents } from "./prices";

describe("prices", () => {
  it("charges what the founder decided", () => {
    expect(PRICES["service-start"]).toMatchObject({ amountCents: 2499, currency: "EUR", interval: "once" });
    expect(PRICES["service-premium"]).toMatchObject({ amountCents: 7999, currency: "EUR", interval: "once" });
    expect(PRICES["pro-monthly"]).toMatchObject({ amountCents: 800, currency: "EUR", interval: "month" });
    expect(PRO_DRAFTS).toBe(5);
    expect(REVISIONS).toEqual({ start: 1, premium: 3 });
    expect(VAT_MODE).toBe("standard19");
  });

  it("computes the VAT inside a gross price", () => {
    expect(vatCents(2499)).toBe(399);
    expect(vatCents(7999)).toBe(1277);
    expect(vatCents(800)).toBe(128);
    expect(vatCents(2499, "kleinunternehmer")).toBe(0);
  });

  it("never shows a struck-through price: no intro price, and none without an end date", () => {
    for (const price of Object.values(PRICES)) {
      expect(price.introUntil, price.id).toBeUndefined();
      if (price.priceAfterCents !== undefined) expect(price.introUntil, price.id).toBeDefined();
    }
  });

  it("logs every current price", () => {
    for (const price of Object.values(PRICES)) {
      const last = PRICE_CHANGELOG.filter((entry) => entry.id === price.id).at(-1);
      expect(last?.amountCents, price.id).toBe(price.amountCents);
    }
  });

  it("formats euros per language with Western digits", () => {
    expect(formatEuro(2499, "de")).toBe("24,99 €");
    expect(formatEuro(2499, "en")).toBe("€24.99");
    expect(formatEuro(2499, "ar")).toMatch(/24\.99/);
    expect(formatEuro(800, "ar")).not.toMatch(/[٠-٩]/);
  });
});
