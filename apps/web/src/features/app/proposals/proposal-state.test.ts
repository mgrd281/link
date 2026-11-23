import { describe, expect, it } from "vitest";

import { isStale, SIGN_AGAIN_MS, SIGNED_SECONDS } from "@/lib/supabase/signed";

import { isFinalRefusal, proposalView, type ProposalFacts } from "./proposal-state";

const NOW = Date.parse("2026-11-26T10:00:00Z");
const facts = (overrides: Partial<ProposalFacts> = {}): ProposalFacts => ({
  orderStatus: "delivered",
  withdrawalPending: false,
  proposalStatus: "delivered",
  revisionsLeft: 1,
  reviseUntil: new Date("2026-12-07T17:00:00Z"),
  ...overrides,
});

describe("the customer's proposal review", () => {
  it("a delivered proposal can be used and changed", () => {
    expect(proposalView(facts(), NOW)).toEqual({ canApply: true, revise: "open", roundsLine: true });
  });

  it("using the proposal does not take the paid round away", () => {
    // Day 3: the customer applied it, looked at the live page and wants one change.
    expect(proposalView(facts({ proposalStatus: "applied" }), NOW)).toEqual({ canApply: true, revise: "open", roundsLine: true });
  });

  it("an ended order offers neither and promises no rounds", () => {
    expect(proposalView(facts({ orderStatus: "refunded" }), NOW)).toEqual({ canApply: false, revise: "ended", roundsLine: false });
    expect(proposalView(facts({ orderStatus: "withdrawn", proposalStatus: "applied" }), NOW)).toEqual({ canApply: false, revise: "ended", roundsLine: false });
  });

  it("while changes are being made it says so (and how many rounds are left after them)", () => {
    expect(proposalView(facts({ orderStatus: "revision_requested", revisionsLeft: 2 }), NOW)).toEqual({ canApply: true, revise: "busy", roundsLine: true });
    expect(proposalView(facts({ orderStatus: "revision_requested", revisionsLeft: 0 }), NOW)).toEqual({ canApply: true, revise: "busy", roundsLine: false });
  });

  it("while a withdrawal is checked the order rests", () => {
    expect(proposalView(facts({ withdrawalPending: true }), NOW)).toEqual({ canApply: true, revise: "paused", roundsLine: false });
  });

  it("an older proposal points to the newer one", () => {
    expect(proposalView(facts({ proposalStatus: "superseded" }), NOW).revise).toBe("superseded");
  });

  it("no rounds left, or the 14 days are over", () => {
    expect(proposalView(facts({ revisionsLeft: 0 }), NOW)).toEqual({ canApply: true, revise: "none", roundsLine: false });
    expect(proposalView(facts(), Date.parse("2026-12-08T10:00:00Z"))).toEqual({ canApply: true, revise: "expired", roundsLine: false });
    expect(proposalView(facts({ orderStatus: "completed" }), NOW).revise).toBe("expired");
  });

  it("tells a refusal that will never succeed from a failure worth trying again", () => {
    expect(["locked", "noneLeft", "expired", "notFound"].every(isFinalRefusal)).toBe(true);
    expect(isFinalRefusal("server")).toBe(false);
  });
});

describe("signed addresses of private pictures", () => {
  it("are signed again before they run out", () => {
    expect(SIGN_AGAIN_MS).toBeLessThan(SIGNED_SECONDS * 1000);
  });

  it("an address is not handed out once it may have run out (a tab that slept)", () => {
    const signedAt = Date.parse("2026-11-26T10:00:00Z");
    expect(isStale(null, signedAt)).toBe(true);
    expect(isStale(signedAt, signedAt + 60_000)).toBe(false);
    // 15 minutes later (the customer copied both bios first): sign again, do not navigate to "expired".
    expect(isStale(signedAt, signedAt + 15 * 60_000)).toBe(true);
  });
});
