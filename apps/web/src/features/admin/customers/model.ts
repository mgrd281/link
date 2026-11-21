import type { LoginEvent } from "@/features/account/types";
import type { RewardRow } from "@/features/referrals/types";

/**
 * Customers as the team sees them: account, page, subscription and security. One shape for the
 * demo (sample customers + the accounts on this device) and for Phase 1 (Postgres views behind
 * row-level security for team members), so the screens never change.
 */

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

/**
 * Monthly price in euro cents (gross). Pro has no public price yet: the €8 assumption from
 * docs/COSTS.md is used until pricing is decided. Pro for life (rewards) is never priced here.
 */
export const PLAN_PRICE: Record<Plan, number> = { free: 0, pro: 800 };

export const SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type AccountStatus = "active" | "suspended";

export type { DeviceInfo, LoginEvent } from "@/features/account/types";

export interface Invoice {
  id: string;
  at: string;
  amount: number;
  status: "paid" | "failed" | "refunded";
}

export interface Subscription {
  plan: Plan;
  /** Only for paid plans; free accounts have none. */
  status: SubscriptionStatus | null;
  startedAt?: string | undefined;
  renewsAt?: string | undefined;
  trialEndsAt?: string | undefined;
  canceledAt?: string | undefined;
  invoices: Invoice[];
}

export interface Note {
  id: string;
  at: string;
  author: string;
  text: string;
}

/** A reward of the invite program (ADR 0064), as the team sees it. */
export interface RewardRecord {
  at: string;
  /** Reached with counted invites, or given by hand by the team. */
  source: "referrals" | "team";
  /** Set once the team removed it; a removed reward is never given again automatically. */
  revokedAt?: string | undefined;
}

export interface Customer {
  id: string;
  /** "sample": demo data for the console; "device": a real account created in this browser. */
  source: "sample" | "device" | "live";
  name: string;
  email: string;
  username: string;
  locale: "de" | "en" | "ar";
  country: string;
  city?: string | undefined;
  createdAt: string;
  lastSeenAt: string;
  status: AccountStatus;
  verified: boolean;
  subscription: Subscription;
  usage: {
    kind: string;
    template: string;
    blocks: number;
    onboarded: boolean;
    views30: number;
    clicks30: number;
  };
  logins: LoginEvent[];
  notes: Note[];
  /**
   * The invite program's rewards. Never revenue: they live outside `subscription`, so
   * monthlyRevenue, isPaying, the KPIs and the MRR history can't see them.
   */
  rewards?: { verificationReview?: RewardRecord | undefined; proForLife?: RewardRecord | undefined } | undefined;
}

/** What a customer pays per month right now (cents): paid, trialing and overdue plans count; canceled don't. */
export function monthlyRevenue(customer: Customer): number {
  const { plan, status } = customer.subscription;
  if (plan === "free" || status === "canceled" || status === "trialing" || status === null) return 0;
  return PLAN_PRICE[plan];
}

export const isPaying = (customer: Customer) => monthlyRevenue(customer) > 0;

/** Pro for life from the invite program, and not removed by the team. */
export const hasProForLife = (customer: Customer) => Boolean(customer.rewards?.proForLife && !customer.rewards.proForLife.revokedAt);

/**
 * Pro features: a running Pro plan or Pro for life. The one entitlement check, for access only and
 * never for money (that is monthlyRevenue): at launch, billing asks this and never bills a reward.
 */
export const hasPro = (customer: Customer) =>
  (customer.subscription.plan === "pro" && customer.subscription.status !== null && customer.subscription.status !== "canceled") || hasProForLife(customer);

type Rewards = NonNullable<Customer["rewards"]>;

/**
 * The invite program's rewards (rows of the team's referral queue) on the customers they belong to.
 * They go beside the subscription, never into it, so nothing that counts money can see them.
 */
export function withRewards(customers: Customer[], rows: readonly RewardRow[]): Customer[] {
  if (!rows.length) return customers;
  const byCustomer = new Map<string, Rewards>();
  for (const row of rows) {
    const record: RewardRecord = { at: row.at, source: row.source, ...(row.revokedAt ? { revokedAt: row.revokedAt } : {}) };
    const key: keyof Rewards = row.kind === "pro_for_life" ? "proForLife" : "verificationReview";
    byCustomer.set(row.customerId, { ...byCustomer.get(row.customerId), [key]: record });
  }
  return customers.map((customer) => {
    const rewards = byCustomer.get(customer.id);
    return rewards ? { ...customer, rewards: { ...customer.rewards, ...rewards } } : customer;
  });
}

export const DAY = 86_400_000;
export const daysAgo = (now: number, iso: string) => (now - Date.parse(iso)) / DAY;

/** Why a sign-in deserves a look: a device or country never seen before, a burst of failures, a blocked address. */
export type RiskFlag = "new-device" | "new-country" | "failed-burst" | "blocked-ip";

export function riskFlags(
  event: LoginEvent,
  history: readonly LoginEvent[],
  blockedIps: ReadonlySet<string>,
): RiskFlag[] {
  const before = history.filter(
    (other) => other.id !== event.id && Date.parse(other.at) < Date.parse(event.at),
  );
  const earlierSuccess = before.filter((other) => other.result === "success");
  const flags: RiskFlag[] = [];
  if (blockedIps.has(event.ip)) flags.push("blocked-ip");
  if (event.result === "success" && earlierSuccess.length > 0) {
    if (
      !earlierSuccess.some(
        (other) =>
          other.deviceId === event.deviceId || (event.signature && other.signature === event.signature),
      )
    )
      flags.push("new-device");
    if (event.country && !earlierSuccess.some((other) => other.country === event.country))
      flags.push("new-country");
  }
  const hourBefore = before.filter(
    (other) => other.result === "failed" && Date.parse(event.at) - Date.parse(other.at) <= 3_600_000,
  );
  if (hourBefore.length >= 3 || (event.result === "failed" && hourBefore.length >= 2))
    flags.push("failed-burst");
  return flags;
}
