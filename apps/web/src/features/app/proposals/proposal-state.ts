/**
 * What the customer's proposal review offers for the state of the order and the proposal. The rules
 * are the database's (`record_revision`), said on screen before a click can fail:
 * - a proposal can be used, and changes requested, also after it was used ("applied"): a paid round
 *   is not lost by looking at the page live first;
 * - an order that ended (refunded or withdrawn) offers neither, and promises no rounds;
 * - while changes are being made, or a withdrawal is being checked, the screen says so instead of
 *   showing a dead button next to "1 round left".
 */

export interface ProposalFacts {
  orderStatus: string;
  withdrawalPending: boolean;
  proposalStatus: string;
  revisionsLeft: number;
  /** The end of the 14 days for change requests (from the first delivery). */
  reviseUntil: Date | null;
}

export type ReviseState =
  /** Changes can be requested now. */
  | "open"
  /** The order was refunded or withdrawn. */
  | "ended"
  /** A withdrawal is being checked: the order rests. */
  | "paused"
  /** A change request is being worked on. */
  | "busy"
  /** A newer proposal replaced this one. */
  | "superseded"
  /** Every round is used. */
  | "none"
  /** The 14 days are over. */
  | "expired";

export interface ProposalView {
  /** "Use this proposal". */
  canApply: boolean;
  revise: ReviseState;
  /** "N rounds left until …" is true and worth saying. */
  roundsLine: boolean;
}

export function proposalView(facts: ProposalFacts, now: number): ProposalView {
  if (facts.orderStatus === "refunded" || facts.orderStatus === "withdrawn") return { canApply: false, revise: "ended", roundsLine: false };
  const expired = facts.reviseUntil !== null && now > facts.reviseUntil.getTime();
  const rounds = facts.revisionsLeft > 0 && !expired;
  if (facts.withdrawalPending) return { canApply: true, revise: "paused", roundsLine: false };
  if (facts.proposalStatus === "superseded") return { canApply: true, revise: "superseded", roundsLine: false };
  if (facts.orderStatus === "revision_requested") return { canApply: true, revise: "busy", roundsLine: rounds };
  if (facts.revisionsLeft <= 0) return { canApply: true, revise: "none", roundsLine: false };
  if (expired || facts.orderStatus !== "delivered") return { canApply: true, revise: "expired", roundsLine: false };
  // "delivered" or "applied": using the proposal does not use up the rounds.
  return { canApply: true, revise: "open", roundsLine: true };
}

/** A refusal of the revision route that can never succeed by trying again (409). */
export const isFinalRefusal = (code: string): boolean => code === "locked" || code === "noneLeft" || code === "expired" || code === "notFound";
