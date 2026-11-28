"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useNow } from "@/features/directions/poster/live";
import { useReports } from "@/features/moderation/team";
import { overdue } from "@/features/moderation/types";
import { useReferralQueue } from "@/features/referrals/team";
import { usePathname } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";
import { supabaseEnabled } from "@/lib/supabase/config";

import { settle, type Loaded } from "./orders/load";
import { loadContracts, loadQueue, type ContractRequest, type QueueOrder } from "./orders/orders-data";
import { useAdmin } from "./session";

/**
 * What waits for the team (A-17): open page-service orders, withdrawals and cancellations without a
 * decision, verification requests and held invites, and open reports (DSA notice and action). Read once by the shell for its count badges
 * and shared with the overview's "Needs a look" (one read, not one per screen). A queue that does not
 * exist on this deployment (no payments, no permission) is `off`; one that failed to load is `failed`
 * and shows no number at all, never a 0 that says nothing waits.
 */

export type Queue<T> = { status: "off" } | Loaded<T>;

export interface Queues {
  orders: Queue<QueueOrder[]>;
  contracts: Queue<ContractRequest[]>;
  referrals: Queue<{ verifications: number; held: number }>;
  /** Open reports and those past the team's target (REPORT_SLA_HOURS); `off` on a database without reports. */
  reports: Queue<{ open: number; overdue: number }>;
}

const OFF = { status: "off" } as const;
const QueuesContext = createContext<Queues>({ orders: OFF, contracts: OFF, referrals: OFF, reports: OFF });

/** A withdrawal or cancellation the team still has to decide, or an accepted withdrawal whose refund is not on record. */
export const waitingContract = (item: ContractRequest) => item.decision === null || (item.kind === "withdrawal" && item.decision === "accepted" && !item.handledAt);

/** "Due" on the overview: a deadline that has passed or is less than a day away. */
const DUE_WINDOW = 86_400_000;

/** Open orders whose deadline has passed or is less than a day away (an order with a withdrawal waiting is counted there). */
export const dueOrders = (orders: readonly QueueOrder[], now: Date) =>
  orders.filter((order) => !order.withdrawalPending && order.due !== null && Date.parse(order.due) - now.getTime() <= DUE_WINDOW);

/** The numbers a badge shows: null while loading, off or failed. */
export const countOf = <T,>(queue: Queue<T>, count: (data: T) => number): number | null => (queue.status === "ready" ? count(queue.data) : null);

/** The real-mode order queues (payments on, real accounts): read again on every move inside the team area. */
function useOrderQueues(enabled: boolean, contractsAllowed: boolean): Pick<Queues, "orders" | "contracts"> {
  const pathname = usePathname();
  const [state, setState] = useState<Pick<Queues, "orders" | "contracts">>({ orders: OFF, contracts: OFF });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void Promise.all([settle(() => loadQueue("open")), contractsAllowed ? settle(loadContracts) : Promise.resolve(OFF)]).then(([orders, contracts]) => {
      if (live) setState({ orders, contracts });
    });
    return () => {
      live = false;
    };
  }, [enabled, contractsAllowed, pathname]);
  return enabled ? state : { orders: OFF, contracts: OFF };
}

export function QueuesProvider({ children }: { children: ReactNode }) {
  const { can } = useAdmin();
  const orderQueues = useOrderQueues(paymentsEnabled && supabaseEnabled && can("orders.view"), can("billing.view"));
  // The queue's function needs customers.view on the database: a role without it asks nothing.
  const referralsAllowed = can("orders.view") && can("customers.view");
  const referral = useReferralQueue(referralsAllowed);
  const referrals = useMemo<Queues["referrals"]>(() => {
    if (!referralsAllowed) return OFF;
    if (referral.status === "loading") return { status: "loading" };
    if (referral.status === "error") return { status: "failed" };
    return {
      status: "ready",
      data: { verifications: referral.queue.verifications.filter((request) => request.state === "requested").length, held: referral.queue.held.length },
    };
  }, [referralsAllowed, referral.status, referral.queue]);
  const reportsAllowed = can("reports.manage");
  const openReports = useReports("open", reportsAllowed);
  // The visitor's clock, per minute (null while rendering on the server: nothing counts as late yet).
  const now = useNow();
  const reports = useMemo<Queues["reports"]>(() => {
    if (!reportsAllowed || openReports.status === "unavailable") return OFF;
    if (openReports.status === "loading") return { status: "loading" };
    if (openReports.status === "error") return { status: "failed" };
    const late = now === null ? 0 : openReports.reports.filter((report) => overdue(report, now)).length;
    return { status: "ready", data: { open: openReports.reports.length, overdue: late } };
  }, [reportsAllowed, openReports.status, openReports.reports, now]);
  const value = useMemo(() => ({ ...orderQueues, referrals, reports }), [orderQueues, referrals, reports]);
  return <QueuesContext.Provider value={value}>{children}</QueuesContext.Provider>;
}

/** The team's queues, as the shell loaded them. */
export const useQueues = () => useContext(QueuesContext);
