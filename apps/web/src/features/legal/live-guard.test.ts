import { describe, expect, it } from "vitest";

import { EMAIL_TRANSPORTS, LIVE_EMAIL_TRANSPORT } from "@/features/email/send";

import { COMPANY, legalReady } from "./company";
import { assertLiveReady } from "./live-guard";

const message = "NEXT_PUBLIC_PAYMENTS=live needs the real company data and LEGAL_REVIEWED=1";
const mailMessage = "NEXT_PUBLIC_PAYMENTS=live needs EMAIL_TRANSPORT=tem: contract e-mails must really go out";

describe("live payments gate", () => {
  it("lets test and demo builds through with placeholders and without an e-mail transport", () => {
    expect(() => assertLiveReady({ payments: "test", legalReady: false, reviewed: undefined, emailTransport: undefined })).not.toThrow();
    expect(() => assertLiveReady({ payments: undefined, legalReady: false, reviewed: undefined, emailTransport: undefined })).not.toThrow();
    expect(() => assertLiveReady({ payments: "test", legalReady: true, reviewed: "1", emailTransport: "capture" })).not.toThrow();
  });

  it("stops a live build with placeholders, even when reviewed", () => {
    expect(() => assertLiveReady({ payments: "live", legalReady: false, reviewed: undefined, emailTransport: "tem" })).toThrow(message);
    expect(() => assertLiveReady({ payments: "live", legalReady: false, reviewed: "1", emailTransport: "tem" })).toThrow(message);
  });

  it("stops a live build with real data but no lawyer's review", () => {
    expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: undefined, emailTransport: "tem" })).toThrow(message);
    expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: "yes", emailTransport: "tem" })).toThrow(message);
  });

  it("stops a live build whose e-mail transport sends nothing", () => {
    // Unset and "console" only log; "capture" writes files; a typo is no transport at all.
    for (const emailTransport of [undefined, "", "console", "capture", "TEM", "smtp"]) {
      expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: "1", emailTransport })).toThrow(mailMessage);
    }
  });

  it("lets a live build through with real data, LEGAL_REVIEWED=1 and EMAIL_TRANSPORT=tem", () => {
    expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: "1", emailTransport: "tem" })).not.toThrow();
  });

  it("asks at build time for the transport the sender asks for at run time", () => {
    // The gate is pure and names the transport itself; this keeps the two in step.
    expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: "1", emailTransport: LIVE_EMAIL_TRANSPORT })).not.toThrow();
    for (const transport of EMAIL_TRANSPORTS.filter((candidate) => candidate !== LIVE_EMAIL_TRANSPORT)) {
      expect(() => assertLiveReady({ payments: "live", legalReady: true, reviewed: "1", emailTransport: transport })).toThrow(mailMessage);
    }
  });

  it("the company data is complete: no placeholder is left", () => {
    expect(legalReady).toBe(true);
    expect(Object.values(COMPANY).some((value) => value.includes("["))).toBe(false);
  });
});
