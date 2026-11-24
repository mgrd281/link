import { describe, expect, it } from "vitest";

import { EMAIL_TRANSPORTS, LIVE_EMAIL_TRANSPORT } from "@/features/email/send";

import { COMPANY, legalReady } from "./company";
import { assertLiveReady, legalDocs, legalIsDraft, reviewMarkers } from "./live-guard";
import { REVIEW, type LegalDoc } from "./texts";

const message = "NEXT_PUBLIC_PAYMENTS=live needs the real company data and LEGAL_REVIEWED=1";
const mailMessage = "NEXT_PUBLIC_PAYMENTS=live needs EMAIL_TRANSPORT=tem: contract e-mails must really go out";
const launchMessage = "LAUNCH=1 needs final legal texts";

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

describe("launch gate (LAUNCH=1)", () => {
  const final = { payments: undefined, legalReady: true, reviewed: "1", emailTransport: undefined, markers: [] } as const;
  const marker = REVIEW.check;

  it("lets preview builds through with draft texts (no LAUNCH, or any other value)", () => {
    for (const launch of [undefined, "", "0", "true", "yes"]) {
      expect(() => assertLiveReady({ ...final, launch, legalReady: false, reviewed: undefined, markers: [marker] })).not.toThrow();
    }
  });

  it("stops a launch build while a bracketed marker is left, even when reviewed", () => {
    expect(() => assertLiveReady({ ...final, launch: "1", markers: [marker] })).toThrow(launchMessage);
    expect(() => assertLiveReady({ ...final, launch: "1", markers: [marker] })).toThrow(marker);
  });

  it("stops a launch build while the draft banner would show: no lawyer's review or no company data", () => {
    expect(() => assertLiveReady({ ...final, launch: "1", reviewed: undefined })).toThrow(launchMessage);
    expect(() => assertLiveReady({ ...final, launch: "1", reviewed: "yes" })).toThrow(launchMessage);
    expect(() => assertLiveReady({ ...final, launch: "1", legalReady: false })).toThrow(launchMessage);
  });

  it("lets a launch build through with final texts, and still applies the live-payments rules", () => {
    expect(() => assertLiveReady({ ...final, launch: "1" })).not.toThrow();
    expect(() => assertLiveReady({ ...final, launch: "1", payments: "live", emailTransport: "tem" })).not.toThrow();
    expect(() => assertLiveReady({ ...final, launch: "1", payments: "live", emailTransport: "console" })).toThrow(mailMessage);
  });

  it("reads the markers from the texts themselves when none are given", () => {
    const left = reviewMarkers(legalDocs());
    // While the lawyer's notes are in the texts, a launch build fails on its own (no list passed in).
    const launch = () => assertLiveReady({ payments: undefined, legalReady: true, reviewed: "1", emailTransport: undefined, launch: "1" });
    if (left.length > 0) expect(launch).toThrow(launchMessage);
    else expect(launch).not.toThrow();
  });

  it("finds every bracketed text in headings, paragraphs, lists and lines, once each", () => {
    const doc: LegalDoc = [
      { kind: "h2", text: "Titel [a]" },
      { kind: "p", text: "Text [b] und [a]" },
      { kind: "list", items: ["eins", "zwei [c]"] },
      { kind: "lines", lines: ["[d]", "(*) keine Klammer"] },
    ];
    expect(reviewMarkers([doc]).sort()).toEqual(["[a]", "[b]", "[c]", "[d]"]);
    expect(reviewMarkers([[{ kind: "p", text: "Fertig." }]])).toEqual([]);
  });

  it("calls the texts a draft until the data is real, reviewed and free of markers", () => {
    expect(legalIsDraft({ legalReady: true, reviewed: "1", markers: [] })).toBe(false);
    expect(legalIsDraft({ legalReady: true, reviewed: "1", markers: [marker] })).toBe(true);
    expect(legalIsDraft({ legalReady: true, reviewed: undefined, markers: [] })).toBe(true);
    expect(legalIsDraft({ legalReady: false, reviewed: "1", markers: [] })).toBe(true);
  });
});
