/*
 * The invite program's data, as the creator and the team see it. In code, data and URLs the program
 * is "referral": "invite" already names the team's prepared-page invite (ADR 0015). Only the copy
 * says "Einladen", "Invite" and "دعوة".
 */

export type RewardKind = "verification_review" | "pro_for_life";

/** What the creator sees for one person they invited. */
export type InviteStatus = "pending" | "counted" | "checking" | "notCounted";

export type DeclineReason = "profileNotLinked" | "identityUnclear" | "impersonation" | "other";

/** The stored state of one invite (`public.referral_state`). */
export type ReferralState = "pending" | "qualified" | "held" | "rejected" | "revoked";

export type ReferralReason = "self" | "sameDevice" | "disposable" | "inviteeSuspended" | "noSignals" | "sameNetwork" | "cluster" | "repeat" | "team";

/** Yes/no signals of the abuse checks; no addresses or fingerprints are kept. */
export type ReferralSignals = Partial<Record<"sameNetwork" | "sameSignature" | "cluster" | "disposable" | "emailLink", boolean>>;

/** One account that signed up with the creator's link; the name is the public page name, never the email. */
export interface InvitedPerson {
  id: string;
  name: string | null;
  deleted: boolean;
  status: InviteStatus;
  at: string;
}

export interface RewardInfo {
  at: string;
  revoked: boolean;
}

export interface VerificationInfo {
  state: "requested" | "approved" | "declined";
  at: string;
  decidedAt: string | null;
  declineReason: DeclineReason | null;
  /** After a decline: from when the creator may ask again. */
  retryAt: string | null;
}

/** The signed-in creator's invite program. */
export interface ReferralOverview {
  code: string;
  counted: number;
  rewards: Partial<Record<RewardKind, RewardInfo>>;
  verification: VerificationInfo | null;
  /** Newest first. */
  invited: InvitedPerson[];
  invitedBy: { name: string } | null;
}

export type VerificationResult =
  | { ok: true }
  | { ok: false; error: "invalidLinks" | "alreadyOpen" | "tooSoon" | "notUnlocked" | "alreadyVerified" | "unavailable" | "serverError" };

// ── Team ────────────────────────────────────────────────────────────────────────────────────────

export interface QueueVerification {
  id: string;
  customerId: string;
  username: string;
  name: string;
  verified: boolean;
  links: string[];
  note: string;
  state: VerificationInfo["state"];
  at: string;
  decidedAt: string | null;
  declineReason: DeclineReason | null;
  reviewer: string | null;
  invites: number;
}

export interface HeldInvite {
  id: string;
  inviterId: string;
  inviter: string;
  inviteeId: string | null;
  invitee: string | null;
  reason: ReferralReason;
  signals: ReferralSignals;
  at: string;
  counted: number;
}

export interface RewardRow {
  customerId: string;
  username: string;
  kind: RewardKind;
  source: "referrals" | "team";
  at: string;
  revokedAt: string | null;
  counted: number;
}

export interface ReferralQueue {
  verifications: QueueVerification[];
  held: HeldInvite[];
  rewards: RewardRow[];
}

export interface CustomerReferrals {
  code: string;
  counted: number;
  invitedBy: {
    id: string;
    username: string;
    state: ReferralState;
    reason: ReferralReason | null;
    signals: ReferralSignals;
    at: string;
  } | null;
  invited: {
    id: string;
    inviteeId: string | null;
    username: string | null;
    status: "active" | "suspended" | null;
    state: ReferralState;
    reason: ReferralReason | null;
    signals: ReferralSignals;
    at: string;
    settledAt: string | null;
  }[];
  rewards: Partial<Record<RewardKind, { at: string; source: "referrals" | "team"; revokedAt: string | null; reason: string | null }>>;
  verifications: {
    id: string;
    state: VerificationInfo["state"];
    links: string[];
    note: string;
    at: string;
    decidedAt: string | null;
    declineReason: DeclineReason | null;
  }[];
}
