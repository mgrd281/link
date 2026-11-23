import type { ContractRequest } from "./orders-data";

/**
 * What the team can do with a withdrawal or a cancellation, from what is on record (plan §1.7). The
 * rules follow what is actually finished, not which button was pressed last:
 * - an accepted withdrawal whose refund did not go through is still open and can be finished;
 * - a contract is withdrawn once: a second declaration for an order that is already withdrawn or
 *   refunded (or a Pro contract already reversed) is only filed as handled;
 * - an ordinary cancellation that was held (suspect) or that Stripe did not take when it arrived
 *   can be carried out, not only filed.
 */

export type ContractAction = "handled" | "acceptWithdrawal" | "finishWithdrawal" | "rejectWithdrawal" | "schedule" | "endNow" | "rejectCancellation" | "resume";

/** Decisions that need a reason (the route and SQL refuse them without one). */
export const NOTE_REQUIRED: ReadonlySet<ContractAction> = new Set(["rejectWithdrawal", "endNow", "rejectCancellation", "resume"]);

type Withdrawal = Extract<ContractRequest, { kind: "withdrawal" }>;

/** Has the contract a withdrawal names already ended (so nothing is left to accept or refund)? */
export function contractEnded(item: Withdrawal): boolean {
  if (item.order) return item.order.status === "withdrawn" || item.order.status === "refunded";
  return item.entitlement?.status === "refunded";
}

/** Accepted, but the money has not gone back yet: the request is open until it has. */
export function refundOpen(item: ContractRequest): boolean {
  return item.kind === "withdrawal" && item.decision === "accepted" && !item.handledAt;
}

export function actionsFor(item: ContractRequest): ContractAction[] {
  if (item.handledAt) return [];
  if (!item.matched) return ["handled"];
  if (item.kind === "withdrawal") {
    // Finishing also heals a request whose contract ended some other way: the route then only files it.
    if (item.decision === "accepted") return ["finishWithdrawal"];
    if (item.decision !== null || !(item.order || item.entitlement) || contractEnded(item)) return ["handled"];
    return item.suspect ? ["acceptWithdrawal", "rejectWithdrawal", "handled"] : ["acceptWithdrawal", "rejectWithdrawal"];
  }
  const decisions: ContractAction[] =
    item.decision === "scheduled"
      ? ["resume"]
      : item.decision !== null || !item.entitlement
        ? []
        : item.cancellationKind === "extraordinary"
          ? ["endNow", "rejectCancellation"]
          : ["schedule"];
  return item.suspect ? [...decisions, "handled"] : decisions.length > 0 ? decisions : ["handled"];
}

/** What the route is asked to do: finishing an accepted withdrawal is the same decision again. */
export const routeAction = (action: ContractAction): string => (action === "finishWithdrawal" ? "acceptWithdrawal" : action);

/** Euros typed by the team ("24,99" or "24.99") in cents; null when it is not an amount. */
export function parseCents(text: string): number | null {
  const clean = text.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
