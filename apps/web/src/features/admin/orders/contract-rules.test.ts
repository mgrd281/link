import { describe, expect, it } from "vitest";

import { actionsFor, contractEnded, parseCents, refundOpen, routeAction } from "./contract-rules";
import type { ContractRequest, OrderStatus } from "./orders-data";

type Withdrawal = Extract<ContractRequest, { kind: "withdrawal" }>;
type Cancellation = Extract<ContractRequest, { kind: "cancellation" }>;

const order = (status: OrderStatus = "queued", withdrawalPending = true) => ({ id: "o-1", number: "LNK-2026-000123", amountCents: 9900, earlyStart: true, status, withdrawalPending });

const withdrawal = (overrides: Partial<Withdrawal> = {}): Withdrawal => ({
  kind: "withdrawal",
  id: "w-1",
  receivedAt: "2026-11-23T10:00:00Z",
  name: "Mila",
  email: "mila@example.com",
  contract: "LNK-2026-000123",
  matched: true,
  suspect: false,
  decision: null,
  refundCents: null,
  handledAt: null,
  note: null,
  refundDueAt: "2026-12-07T10:00:00Z",
  account: null,
  order: order(),
  entitlement: null,
  invoice: null,
  ...overrides,
});

const cancellation = (overrides: Partial<Cancellation> = {}): Cancellation => ({
  kind: "cancellation",
  id: "c-1",
  receivedAt: "2026-11-23T10:00:00Z",
  name: "Mila",
  cancellationKind: "ordinary",
  reason: null,
  accountEmail: "mila@example.com",
  wantedDate: null,
  matched: true,
  suspect: false,
  decision: null,
  effectiveAt: null,
  handledAt: null,
  note: null,
  account: null,
  entitlement: { id: "e-1", subscription: "sub_1", status: "active", cancelAtPeriodEnd: false, cancelAt: null },
  ...overrides,
});

describe("what the team can do with a withdrawal", () => {
  it("decides an open, matched one", () => {
    expect(actionsFor(withdrawal())).toEqual(["acceptWithdrawal", "rejectWithdrawal"]);
    expect(actionsFor(withdrawal({ order: null, entitlement: { id: "e-1", subscription: "sub_1", status: "active" } }))).toEqual(["acceptWithdrawal", "rejectWithdrawal"]);
  });

  it("can finish an accepted one whose refund did not go through (also after a reload)", () => {
    const stuck = withdrawal({ decision: "accepted", refundCents: 9900 });
    expect(refundOpen(stuck)).toBe(true);
    expect(actionsFor(stuck)).toEqual(["finishWithdrawal"]);
    // The route finishes the same decision: it is asked to accept again.
    expect(routeAction("finishWithdrawal")).toBe("acceptWithdrawal");
    expect(routeAction("schedule")).toBe("schedule");
  });

  it("has nothing left to do once the refund is on record", () => {
    const done = withdrawal({ decision: "accepted", refundCents: 9900, handledAt: "2026-11-23T11:00:00Z", order: order("withdrawn", false) });
    expect(refundOpen(done)).toBe(false);
    expect(actionsFor(done)).toEqual([]);
  });

  it("only files a second declaration for an order that is already withdrawn or refunded", () => {
    expect(contractEnded(withdrawal({ order: order("withdrawn", false) }))).toBe(true);
    expect(actionsFor(withdrawal({ order: order("withdrawn", false) }))).toEqual(["handled"]);
    expect(actionsFor(withdrawal({ order: order("refunded", false) }))).toEqual(["handled"]);
    expect(actionsFor(withdrawal({ order: null, entitlement: { id: "e-1", subscription: "sub_1", status: "refunded" } }))).toEqual(["handled"]);
    expect(contractEnded(withdrawal())).toBe(false);
  });

  it("offers 'handled' as well for a suspect one, and only that for an unmatched one", () => {
    expect(actionsFor(withdrawal({ suspect: true }))).toEqual(["acceptWithdrawal", "rejectWithdrawal", "handled"]);
    expect(actionsFor(withdrawal({ matched: false, order: null }))).toEqual(["handled"]);
    expect(actionsFor(withdrawal({ order: null }))).toEqual(["handled"]);
  });
});

describe("what the team can do with a cancellation", () => {
  it("carries out an ordinary one that was held or that Stripe did not take", () => {
    expect(actionsFor(cancellation())).toEqual(["schedule"]);
    expect(actionsFor(cancellation({ suspect: true }))).toEqual(["schedule", "handled"]);
  });

  it("ends or rejects an extraordinary one, resumes a scheduled one", () => {
    expect(actionsFor(cancellation({ cancellationKind: "extraordinary", reason: "Umzug" }))).toEqual(["endNow", "rejectCancellation"]);
    expect(actionsFor(cancellation({ decision: "scheduled" }))).toEqual(["resume"]);
  });

  it("only files one without an account, and offers nothing once it is handled", () => {
    expect(actionsFor(cancellation({ matched: false, entitlement: null }))).toEqual(["handled"]);
    expect(actionsFor(cancellation({ entitlement: null }))).toEqual(["handled"]);
    expect(actionsFor(cancellation({ decision: "rejected", handledAt: "2026-11-23T11:00:00Z" }))).toEqual([]);
  });
});

describe("a refund amount typed by the team", () => {
  it("reads euros with a comma or a point", () => {
    expect(parseCents("24,99")).toBe(2499);
    expect(parseCents(" 39.5 € ")).toBe(3950);
    expect(parseCents("0")).toBe(0);
    expect(parseCents("")).toBeNull();
    expect(parseCents("12,345")).toBeNull();
    expect(parseCents("abc")).toBeNull();
  });
});
