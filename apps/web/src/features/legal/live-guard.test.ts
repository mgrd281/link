import { describe, expect, it } from "vitest";

import { COMPANY, legalReady } from "./company";
import { assertLiveReady } from "./live-guard";

const message = "NEXT_PUBLIC_PAYMENTS=live needs the real company data and LEGAL_REVIEWED=1";

describe("live payments gate", () => {
  it("lets test and demo builds through with placeholders", () => {
    expect(() => assertLiveReady({ payments: "test", legalReady: false, reviewed: undefined })).not.toThrow();
    expect(() => assertLiveReady({ payments: undefined, legalReady: false, reviewed: undefined })).not.toThrow();
  });

  it("stops a live build with placeholders, even when reviewed", () => {
    expect(() => assertLiveReady({ payments: "live", legalReady: false, reviewed: undefined })).toThrow(message);
    expect(() => assertLiveReady({ payments: "live", legalReady: false, reviewed: "1" })).toThrow(message);
  });

  it("stops a live build with real data but no lawyer's review", () => {
    expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: undefined })).toThrow(message);
    expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: "yes" })).toThrow(message);
  });

  it("lets a live build through with real data and LEGAL_REVIEWED=1", () => {
    expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: "1" })).not.toThrow();
  });

  it("today's company data is still placeholders", () => {
    expect(legalReady).toBe(false);
    expect(Object.values(COMPANY).every((value) => value.startsWith("[") && value.endsWith("]"))).toBe(true);
  });
});
