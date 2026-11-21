"use client";

import type { CustomerReferrals, DeclineReason, ReferralQueue, RewardKind } from "./types";

/*
 * The team console's side of the invite program. STUB: the real version (RPCs on real accounts, the
 * demo store's team methods plus the activity log in demo mode) replaces this file; until then the
 * queue is empty, a customer has no invite data and every action answers `false` (nothing changed).
 * The signatures are the contract the console builds against.
 */

type LoadStatus = "loading" | "ready" | "error";

const EMPTY_QUEUE: ReferralQueue = { verifications: [], held: [], rewards: [] };
const noop = () => undefined;

/** Open verification requests, held invites and every reward, for `/admin/referrals` and the customers list. */
export function useReferralQueue(): { status: LoadStatus; queue: ReferralQueue; reload(): void } {
  return { status: "ready", queue: EMPTY_QUEUE, reload: noop };
}

/** One customer's invites, rewards and verification requests (the customer's Invites tab). */
export function useCustomerReferrals(_customerId: string): { status: LoadStatus; data: CustomerReferrals | null; reload(): void } {
  return { status: "ready", data: null, reload: noop };
}

export const referralTeam: {
  /** Approve (sets the blue check) or decline a verification request. */
  review(input: { requestId: string; customerId: string; target: string; actor: string; decision: "approve" | "decline"; reason?: DeclineReason }): Promise<boolean>;
  /** Count a held invite, or remove one. */
  setReferral(input: { id: string; next: "qualified" | "revoked"; why?: string; actor: string; target: string }): Promise<boolean>;
  /** Give or remove a reward. */
  setReward(input: { customerId: string; kind: RewardKind; granted: boolean; why?: string; actor: string; target: string }): Promise<boolean>;
} = {
  review: () => Promise.resolve(false),
  setReferral: () => Promise.resolve(false),
  setReward: () => Promise.resolve(false),
};
