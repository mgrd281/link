import { z } from "zod";

import { emailIdentity, isReferralCode, newReferralCode, REFERRAL_RULES } from "@/features/referrals/rules";
import type {
  CustomerReferrals,
  DeclineReason,
  InvitedPerson,
  ReferralOverview,
  ReferralQueue,
  RewardKind,
  VerificationInfo,
  VerificationResult,
} from "@/features/referrals/types";

import { firstSite } from "./site-builders";
import type { Account, AccountSnapshot, AccountStore, CodeRequest, LoginContext, LoginEvent, Result, Site, UsernameStatus } from "./types";
import { localUsernameStatus, normalizeEmail, normalizeUsername } from "./username";

export { preparedSite, starterSite } from "./site-builders";

/**
 * Demo-mode account store: everything lives in this browser's localStorage under one key.
 * - No passwords: sign-in is a 6-digit code, as with real accounts. The demo sends no email, so the
 *   code comes back in the answer and is shown on screen. Codes live only in memory.
 * - Snapshots are cached by the raw string, so `useSyncExternalStore` re-renders only on change.
 * - Other tabs stay in sync through the `storage` event.
 * Nothing is sent anywhere: no cookies, no network.
 */

export const STORAGE_KEY = "linkyo.demo.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Older demo data may still carry a password hash; it is ignored. */
type StoredAccount = Account;

/** A code that was sent: valid 10 minutes, five wrong tries. */
interface PendingCode {
  code: string;
  until: number;
  tries: number;
}
const CODE_MINUTES = 10;
const CODE_TRIES = 5;

/** Six random digits (cryptographically random, leading zeros kept). */
export function sixDigits(): string {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return String(value % 1_000_000).padStart(6, "0");
}

/**
 * One invite in the demo (ADR 0064). Entering the on-screen code is the demo's email confirmation, so
 * an invite is settled at sign-up: it counts, or it is a self-invite. The device and network checks
 * can't apply when every demo account lives in one browser.
 */
interface DemoReferral {
  id: string;
  inviterId: string;
  /** Null: the invited account was deleted after it counted. */
  inviteeId: string | null;
  state: "qualified" | "rejected" | "revoked";
  reason?: "self" | "team" | undefined;
  at: string;
}

interface DemoReward {
  at: string;
  source: "referrals" | "team";
  revokedAt?: string | undefined;
  reason?: string | undefined;
}

interface DemoVerification {
  id: string;
  state: VerificationInfo["state"];
  links: string[];
  note: string;
  at: string;
  decidedAt?: string | undefined;
  declineReason?: DeclineReason | undefined;
}

interface Db {
  version: 1;
  accounts: StoredAccount[];
  sites: Record<string, Site>;
  session: { accountId: string; since: string } | null;
  /** Sign-ins and failed attempts per account (30 days, at most 50), for account security. */
  logins?: Record<string, LoginEvent[]>;
  /** The invite program: each account's code (made at sign-up, or later for older demo accounts). */
  referralCodes?: Record<string, string>;
  referrals?: DemoReferral[];
  rewards?: Record<string, Partial<Record<RewardKind, DemoReward>>>;
  verifications?: Record<string, DemoVerification[]>;
}

const DAY = 86_400_000;
const REWARDS: readonly { kind: RewardKind; at: number }[] = [
  { kind: "verification_review", at: REFERRAL_RULES.verificationAt },
  { kind: "pro_for_life", at: REFERRAL_RULES.proForLifeAt },
];
/** The same rule as SQL request_verification(): https, a host with a dot, no spaces, at most 300 characters. */
const PROFILE_LINK = /^https:\/\/[^\s/]+\.\S+$/;
const DECLINE_REASONS: readonly DeclineReason[] = ["profileNotLinked", "identityUnclear", "impersonation", "other"];

/** Counted invites: qualified (demo accounts are never suspended; a deleted invitee still counts). */
const countedFor = (db: Db, inviterId: string) => (db.referrals ?? []).filter((entry) => entry.inviterId === inviterId && entry.state === "qualified").length;

/** Gives the rewards an inviter has reached; one the team removed is never given again (it still exists). */
function withRewards(db: Db, inviterId: string, at: string): Db {
  const counted = countedFor(db, inviterId);
  const own = { ...db.rewards?.[inviterId] };
  let changed = false;
  for (const reward of REWARDS) {
    if (counted >= reward.at && !own[reward.kind]) {
      own[reward.kind] = { at, source: "referrals" };
      changed = true;
    }
  }
  return changed ? { ...db, rewards: { ...db.rewards, [inviterId]: own } } : db;
}

/** The newest request first, as SQL orders them. */
const latest = (requests: readonly DemoVerification[] | undefined) => [...(requests ?? [])].sort((a, b) => b.at.localeCompare(a.at))[0];

/** A page name, or null when there is none (an empty name is no name). */
const filled = (name: string | undefined): string | null => (name === undefined || name === "" ? null : name);

const retryAt = (request: DemoVerification) =>
  request.state === "declined" && request.decidedAt ? new Date(Date.parse(request.decidedAt) + REFERRAL_RULES.retryVerificationDays * DAY).toISOString() : null;

/** Account-security log retention: 30 days, 50 entries per account. */
const LOGIN_DAYS = 30;
const LOGIN_MAX = 50;

const EMPTY: Db = { version: 1, accounts: [], sites: {}, session: null };
const LOADING: AccountSnapshot = { status: "loading" };
const SIGNED_OUT: AccountSnapshot = { status: "signedOut" };

const emailSchema = z.email();
const now = () => new Date().toISOString();

function parse(raw: string | null): Db {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as Partial<Db>;
    if (data.version !== 1 || !Array.isArray(data.accounts)) return EMPTY;
    return { ...EMPTY, ...data };
  } catch {
    return EMPTY;
  }
}

const publicAccount = ({ id, email, username, createdAt }: StoredAccount): Account => ({ id, email, username, createdAt });

export class LocalAccountStore implements AccountStore {
  readonly demo = true;
  private readonly codes = new Map<string, PendingCode>();
  private readonly listeners = new Set<() => void>();
  private raw: string | null | undefined;
  private snapshot: AccountSnapshot = LOADING;
  private readonly storage: () => StorageLike | null;
  private readonly context: (() => Promise<LoginContext>) | null;

  /** `context` describes where a sign-in comes from (IP, place, device); without it nothing is logged. */
  constructor(storage: () => StorageLike | null, context: (() => Promise<LoginContext>) | null = null) {
    this.storage = storage;
    this.context = context;
  }

  /** Adds a sign-in to the account's security log once its context is known (never delays the sign-in). */
  private async logSignIn(accountId: string, result: LoginEvent["result"]): Promise<void> {
    if (!this.context) return;
    const context = await this.context().catch(() => null);
    if (!context) return;
    const db = this.db();
    const cutoff = Date.now() - LOGIN_DAYS * 86_400_000;
    const event: LoginEvent = { id: `lg_${crypto.randomUUID().slice(0, 12)}`, at: now(), result, ...context };
    const kept = (db.logins?.[accountId] ?? []).filter((entry) => Date.parse(entry.at) >= cutoff);
    this.write({ ...db, logins: { ...db.logins, [accountId]: [event, ...kept].slice(0, LOGIN_MAX) } });
  }

  signIns(): Promise<LoginEvent[]> {
    return Promise.resolve(this.signInsNow());
  }

  private signInsNow(): LoginEvent[] {
    const db = this.db();
    const id = this.currentId(db);
    const cutoff = Date.now() - LOGIN_DAYS * 86_400_000;
    return id ? (db.logins?.[id] ?? []).filter((entry) => Date.parse(entry.at) >= cutoff) : [];
  }

  // Arrow properties: React calls these detached.
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) listener();
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  };

  getSnapshot = (): AccountSnapshot => {
    const raw = this.read();
    if (raw === this.raw) return this.snapshot;
    this.raw = raw;
    const db = parse(raw);
    const account = db.session ? db.accounts.find((candidate) => candidate.id === db.session?.accountId) : undefined;
    const site = account ? db.sites[account.id] : undefined;
    this.snapshot = account && site ? { status: "signedIn", account: publicAccount(account), site } : SIGNED_OUT;
    return this.snapshot;
  };

  getServerSnapshot = (): AccountSnapshot => LOADING;

  usernameStatus = (input: string): Promise<UsernameStatus> => Promise.resolve(this.usernameStatusNow(input));

  private usernameStatusNow(input: string): UsernameStatus {
    const username = normalizeUsername(input);
    const local = localUsernameStatus(username);
    if (local !== "ok") return local;
    const db = this.db();
    const current = this.currentId(db);
    if (db.accounts.some((account) => account.username === username && account.id !== current)) return "usernameTaken";
    return "ok";
  }

  requestCode(input: CodeRequest): Promise<Result> {
    const email = normalizeEmail(input.email);
    if (!emailSchema.safeParse(email).success) return Promise.resolve({ ok: false, error: "invalidEmail" });
    const known = this.db().accounts.some((account) => account.email === email);
    if (input.signUp && !known) {
      const status = this.usernameStatusNow(input.signUp.username);
      if (status !== "ok") return Promise.resolve({ ok: false, error: status });
    }
    // Coming back with an address that has no account: the same answer, but no code (as real accounts).
    if (!known && !input.signUp) return Promise.resolve({ ok: true, pending: "code" });
    const code = sixDigits();
    this.codes.set(email, { code, until: Date.now() + CODE_MINUTES * 60_000, tries: 0 });
    return Promise.resolve({ ok: true, pending: "code", demoCode: code });
  }

  verifyCode(input: CodeRequest & { code: string }): Promise<Result> {
    return Promise.resolve(this.verifyCodeNow(input));
  }

  private verifyCodeNow(input: CodeRequest & { code: string }): Result {
    const email = normalizeEmail(input.email);
    const pending = this.codes.get(email);
    if (!pending || pending.until < Date.now() || pending.tries >= CODE_TRIES) {
      this.codes.delete(email);
      return { ok: false, error: "codeExpired" };
    }
    const db = this.db();
    const existing = db.accounts.find((candidate) => candidate.email === email);
    if (input.code.replace(/\D/g, "") !== pending.code) {
      pending.tries += 1;
      if (existing) void this.logSignIn(existing.id, "failed");
      return { ok: false, error: pending.tries >= CODE_TRIES ? "codeExpired" : "invalidCode" };
    }
    this.codes.delete(email);

    if (existing) {
      const written = this.write({ ...db, session: { accountId: existing.id, since: now() } });
      if (written.ok) void this.logSignIn(existing.id, "success");
      return written;
    }
    const signUp = input.signUp;
    if (!signUp) return { ok: false, error: "notFound" };
    const username = normalizeUsername(signUp.username);
    const status = this.usernameStatusNow(username);
    if (status !== "ok") return { ok: false, error: status };
    const account: StoredAccount = { id: crypto.randomUUID(), email, username, createdAt: now() };
    const created: Db = {
      ...db,
      accounts: [...db.accounts, account],
      sites: { ...db.sites, [account.id]: firstSite({ ...signUp, username, email, locale: input.locale }) },
      session: { accountId: account.id, since: now() },
      referralCodes: { ...db.referralCodes, [account.id]: this.freeCode(db) },
    };
    const written = this.write(this.attribute(created, account, signUp.ref));
    if (written.ok) void this.logSignIn(account.id, "success");
    return written;
  }

  /** A code no other demo account has. */
  private freeCode(db: Db): string {
    const taken = new Set(Object.values(db.referralCodes ?? {}));
    let code = newReferralCode();
    while (taken.has(code)) code = newReferralCode();
    return code;
  }

  /**
   * A new account that came through someone's invite link (`ref`): it counts at once (the code was
   * entered), unless it is the inviter's own mailbox. Rewards reached are given right away.
   */
  private attribute(db: Db, account: StoredAccount, ref: string | undefined): Db {
    const code = ref?.trim().toLowerCase() ?? "";
    if (!isReferralCode(code)) return db;
    const inviterId = Object.entries(db.referralCodes ?? {}).find(([id, owned]) => owned === code && id !== account.id)?.[0];
    const inviter = inviterId ? db.accounts.find((candidate) => candidate.id === inviterId) : undefined;
    if (!inviter) return db;
    const self = emailIdentity(inviter.email) === emailIdentity(account.email);
    const at = now();
    const referral: DemoReferral = {
      id: crypto.randomUUID(),
      inviterId: inviter.id,
      inviteeId: account.id,
      state: self ? "rejected" : "qualified",
      ...(self ? { reason: "self" as const } : {}),
      at,
    };
    const next = { ...db, referrals: [...(db.referrals ?? []), referral] };
    return self ? next : withRewards(next, inviter.id, at);
  }

  logOut(): void {
    this.write({ ...this.db(), session: null });
  }

  changeEmail(input: string): Promise<Result> {
    return Promise.resolve(this.changeEmailNow(input));
  }

  private changeEmailNow(input: string): Result {
    const email = normalizeEmail(input);
    if (!emailSchema.safeParse(email).success) return { ok: false, error: "invalidEmail" };
    const db = this.db();
    const id = this.currentId(db);
    if (!id) return { ok: false, error: "notFound" };
    if (db.accounts.some((account) => account.email === email && account.id !== id)) return { ok: false, error: "emailTaken" };
    return this.write({ ...db, accounts: db.accounts.map((account) => (account.id === id ? { ...account, email } : account)) });
  }

  changeUsername(input: string): Promise<Result> {
    return Promise.resolve(this.changeUsernameNow(input));
  }

  private changeUsernameNow(input: string): Result {
    const username = normalizeUsername(input);
    const status = this.usernameStatusNow(username);
    if (status !== "ok") return { ok: false, error: status };
    const db = this.db();
    const id = this.currentId(db);
    const site = id ? db.sites[id] : undefined;
    if (!id || !site) return { ok: false, error: "notFound" };
    return this.write({
      ...db,
      accounts: db.accounts.map((account) => (account.id === id ? { ...account, username } : account)),
      sites: { ...db.sites, [id]: { ...site, page: { ...site.page, profile: { ...site.page.profile, username } }, updatedAt: now() } },
    });
  }

  updateSite(update: (site: Site) => Site): Result {
    const db = this.db();
    const id = this.currentId(db);
    const site = id ? db.sites[id] : undefined;
    if (!id || !site) return { ok: false, error: "notFound" };
    const next = update(site);
    if (next === site) return { ok: true };
    return this.write({ ...db, sites: { ...db.sites, [id]: { ...next, updatedAt: now() } } });
  }

  exportData(): Promise<string> {
    return Promise.resolve(this.exportNow());
  }

  private exportNow(): string {
    const db = this.db();
    const account = db.accounts.find((candidate) => candidate.id === this.currentId(db));
    if (!account) return "{}";
    // Everything kept about the account, its sign-in log and invite program included (GDPR Art. 15
    // and 20). The people it invited appear without names: those are other people's data.
    const program = this.overviewOf(db, account.id);
    const referrals = program
      ? {
          code: program.code,
          counted: program.counted,
          rewards: program.rewards,
          verifications: (db.verifications?.[account.id] ?? []).map(({ state, links, note, at, decidedAt, declineReason }) => ({
            state,
            links,
            note,
            at,
            decidedAt: decidedAt ?? null,
            declineReason: declineReason ?? null,
          })),
          invitedBy: program.invitedBy,
          invited: program.invited.map(({ status, at }) => ({ status, at })),
        }
      : null;
    return JSON.stringify(
      { exportedAt: now(), account: publicAccount(account), site: db.sites[account.id], signIns: db.logins?.[account.id] ?? [], referrals },
      null,
      2,
    );
  }

  deleteAccount(): Promise<Result> {
    const db = this.db();
    const id = this.currentId(db);
    if (!id) return Promise.resolve({ ok: false, error: "notFound" });
    const without = <T>(record: Record<string, T> | undefined) => Object.fromEntries(Object.entries(record ?? {}).filter(([key]) => key !== id));
    // Its own invites go with it; an invite it counted for someone else stays, without the account.
    const referrals = (db.referrals ?? [])
      .filter((entry) => entry.inviterId !== id && (entry.inviteeId !== id || entry.state === "qualified"))
      .map((entry) => (entry.inviteeId === id ? { ...entry, inviteeId: null } : entry));
    return Promise.resolve(
      this.write({
        ...db,
        accounts: db.accounts.filter((account) => account.id !== id),
        sites: without(db.sites),
        logins: without(db.logins),
        referralCodes: without(db.referralCodes),
        referrals,
        rewards: without(db.rewards),
        verifications: without(db.verifications),
        session: null,
      }),
    );
  }

  // ── Invite program (ADR 0064) ───────────────────────────────────────────────────────────────

  referrals(): Promise<ReferralOverview | null> {
    let db = this.db();
    const id = this.currentId(db);
    if (!id) return Promise.resolve(null);
    if (!db.referralCodes?.[id]) {
      // Demo accounts from before the program get their code on first use.
      db = { ...db, referralCodes: { ...db.referralCodes, [id]: this.freeCode(db) } };
      if (!this.write(db).ok) return Promise.reject(new Error("storage"));
    }
    return Promise.resolve(this.overviewOf(db, id));
  }

  /** What my_referrals() answers, for one demo account. */
  private overviewOf(db: Db, id: string): ReferralOverview | null {
    const code = db.referralCodes?.[id];
    if (!code) return null;
    const rewards: ReferralOverview["rewards"] = {};
    for (const [kind, reward] of Object.entries(db.rewards?.[id] ?? {}) as [RewardKind, DemoReward][]) rewards[kind] = { at: reward.at, revoked: Boolean(reward.revokedAt) };
    const request = latest(db.verifications?.[id]);
    const invited: InvitedPerson[] = (db.referrals ?? [])
      .filter((entry) => entry.inviterId === id)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((entry) => {
        const site = entry.inviteeId ? db.sites[entry.inviteeId] : undefined;
        return {
          id: entry.id,
          // The page name once its owner finished the welcome flow; never the email.
          name: site?.onboarded ? filled(site.page.profile.displayName) : null,
          deleted: entry.inviteeId === null,
          status: entry.state === "qualified" ? "counted" : "notCounted",
          at: entry.at,
        };
      });
    const by = (db.referrals ?? []).find((entry) => entry.inviteeId === id);
    const inviter = by ? db.accounts.find((account) => account.id === by.inviterId) : undefined;
    return {
      code,
      counted: countedFor(db, id),
      rewards,
      verification: request
        ? { state: request.state, at: request.at, decidedAt: request.decidedAt ?? null, declineReason: request.declineReason ?? null, retryAt: retryAt(request) }
        : null,
      invited,
      invitedBy: inviter ? { name: filled(db.sites[inviter.id]?.page.profile.displayName) ?? inviter.username } : null,
    };
  }

  requestVerification(input: { links: string[]; note?: string | undefined }): Promise<VerificationResult> {
    return Promise.resolve(this.requestVerificationNow(input));
  }

  /** The same checks, in the same order, as SQL request_verification(). */
  private requestVerificationNow(input: { links: string[]; note?: string | undefined }): VerificationResult {
    const db = this.db();
    const id = this.currentId(db);
    const site = id ? db.sites[id] : undefined;
    if (!id || !site) return { ok: false, error: "unavailable" };
    if (site.page.profile.verified) return { ok: false, error: "alreadyVerified" };
    const reward = db.rewards?.[id]?.verification_review;
    if (!reward || reward.revokedAt) return { ok: false, error: "notUnlocked" };
    const previous = latest(db.verifications?.[id]);
    if (previous?.state === "requested") return { ok: false, error: "alreadyOpen" };
    const again = previous ? retryAt(previous) : null;
    if (again && Date.parse(again) > Date.now()) return { ok: false, error: "tooSoon" };
    const links = [...new Set(input.links.map((link) => link.trim()).filter(Boolean))];
    if (links.length === 0 || links.length > 3 || links.some((link) => !PROFILE_LINK.test(link) || link.length > 300)) return { ok: false, error: "invalidLinks" };
    const request: DemoVerification = { id: crypto.randomUUID(), state: "requested", links, note: (input.note ?? "").trim().slice(0, 300), at: now() };
    const written = this.write({ ...db, verifications: { ...db.verifications, [id]: [...(db.verifications?.[id] ?? []), request] } });
    return written.ok ? { ok: true } : { ok: false, error: "serverError" };
  }

  referralInviter(code: string): Promise<{ name: string | null } | null> {
    const db = this.db();
    const wanted = code.trim().toLowerCase();
    const inviterId = Object.entries(db.referralCodes ?? {}).find(([, owned]) => owned === wanted)?.[0];
    const site = inviterId ? db.sites[inviterId] : undefined;
    if (!inviterId || !site) return Promise.resolve(null);
    // The page name only once the page is set up (as public pages); otherwise "you were invited".
    return Promise.resolve({ name: site.onboarded ? filled(site.page.profile.displayName) : null });
  }

  // ── Demo team console (same browser; not part of AccountStore; features/referrals/team.ts) ──

  /** Open verification requests (and 30 days of decisions), held invites (none in the demo), every reward. */
  teamQueue(): ReferralQueue {
    const db = this.db();
    const since = Date.now() - 30 * DAY;
    const label = (id: string) => db.accounts.find((account) => account.id === id)?.username ?? "";
    const verifications = Object.entries(db.verifications ?? {})
      .flatMap(([customerId, requests]) =>
        requests
          .filter((request) => request.state === "requested" || (request.decidedAt !== undefined && Date.parse(request.decidedAt) > since))
          .map((request) => ({
            id: request.id,
            customerId,
            username: label(customerId),
            name: filled(db.sites[customerId]?.page.profile.displayName) ?? label(customerId),
            verified: db.sites[customerId]?.page.profile.verified ?? false,
            links: request.links,
            note: request.note,
            state: request.state,
            at: request.at,
            decidedAt: request.decidedAt ?? null,
            declineReason: request.declineReason ?? null,
            reviewer: null,
            invites: countedFor(db, customerId),
          })),
      )
      .sort((a, b) => a.at.localeCompare(b.at));
    const rewards = Object.entries(db.rewards ?? {})
      .flatMap(([customerId, owned]) =>
        (Object.entries(owned) as [RewardKind, DemoReward][]).map(([kind, reward]) => ({
          customerId,
          username: label(customerId),
          kind,
          source: reward.source,
          at: reward.at,
          revokedAt: reward.revokedAt ?? null,
          counted: countedFor(db, customerId),
        })),
      )
      .sort((a, b) => b.at.localeCompare(a.at));
    return { verifications, held: [], rewards };
  }

  /** One demo account's program, as the customer's Invites tab shows it; null for an unknown account. */
  teamCustomer(accountId: string): CustomerReferrals | null {
    const db = this.db();
    if (!db.accounts.some((account) => account.id === accountId)) return null;
    const label = (id: string | null) => (id ? (db.accounts.find((account) => account.id === id)?.username ?? null) : null);
    const by = (db.referrals ?? []).find((entry) => entry.inviteeId === accountId);
    const rewards: CustomerReferrals["rewards"] = {};
    for (const [kind, reward] of Object.entries(db.rewards?.[accountId] ?? {}) as [RewardKind, DemoReward][])
      rewards[kind] = { at: reward.at, source: reward.source, revokedAt: reward.revokedAt ?? null, reason: reward.reason ?? null };
    return {
      code: db.referralCodes?.[accountId] ?? "",
      counted: countedFor(db, accountId),
      invitedBy: by ? { id: by.inviterId, username: label(by.inviterId) ?? "", state: by.state, reason: by.reason ?? null, signals: {}, at: by.at } : null,
      invited: (db.referrals ?? [])
        .filter((entry) => entry.inviterId === accountId)
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((entry) => ({
          id: entry.id,
          inviteeId: entry.inviteeId,
          username: label(entry.inviteeId),
          status: entry.inviteeId ? ("active" as const) : null,
          state: entry.state,
          reason: entry.reason ?? null,
          signals: {},
          at: entry.at,
          settledAt: entry.at,
        })),
      rewards,
      verifications: [...(db.verifications?.[accountId] ?? [])]
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((request) => ({
          id: request.id,
          state: request.state,
          links: request.links,
          note: request.note,
          at: request.at,
          decidedAt: request.decidedAt ?? null,
          declineReason: request.declineReason ?? null,
        })),
    };
  }

  /** Approve (the page gets the blue check) or decline (with a reason) an open request. */
  teamReview(requestId: string, decision: "approve" | "decline", reason?: DeclineReason): boolean {
    const db = this.db();
    const owner = Object.entries(db.verifications ?? {}).find(([, requests]) => requests.some((request) => request.id === requestId && request.state === "requested"))?.[0];
    if (!owner) return false;
    if (decision === "decline" && !(reason && DECLINE_REASONS.includes(reason))) return false;
    const decidedAt = now();
    const requests = (db.verifications?.[owner] ?? []).map((request) =>
      request.id === requestId ? { ...request, state: decision === "approve" ? ("approved" as const) : ("declined" as const), decidedAt, ...(decision === "decline" ? { declineReason: reason } : {}) } : request,
    );
    const site = db.sites[owner];
    const sites =
      decision === "approve" && site ? { ...db.sites, [owner]: { ...site, page: { ...site.page, profile: { ...site.page.profile, verified: true } }, updatedAt: decidedAt } } : db.sites;
    return this.write({ ...db, sites, verifications: { ...db.verifications, [owner]: requests } }).ok;
  }

  /** Count an invite again or remove it; answers the state it had, or null when nothing changed. */
  teamSetReferral(id: string, next: "qualified" | "revoked"): "qualified" | "rejected" | "revoked" | null {
    const db = this.db();
    const found = (db.referrals ?? []).find((entry) => entry.id === id);
    if (!found) return null;
    const changed: DemoReferral = next === "revoked" ? { ...found, state: "revoked", reason: "team" } : { id: found.id, inviterId: found.inviterId, inviteeId: found.inviteeId, state: "qualified", at: found.at };
    const updated = { ...db, referrals: (db.referrals ?? []).map((entry) => (entry.id === id ? changed : entry)) };
    return this.write(next === "qualified" ? withRewards(updated, found.inviterId, now()) : updated).ok ? found.state : null;
  }

  /** Give a reward by hand (or back), or remove one; removing the review also declines an open request. */
  teamSetReward(accountId: string, kind: RewardKind, granted: boolean, why?: string): boolean {
    const db = this.db();
    if (!db.accounts.some((account) => account.id === accountId)) return false;
    const current = db.rewards?.[accountId]?.[kind];
    if (!granted && (!current || current.revokedAt)) return false;
    const at = now();
    const reward: DemoReward = granted ? { at: current?.at ?? at, source: current?.source ?? "team" } : { ...(current ?? { at, source: "team" }), revokedAt: at, reason: (why ?? "").slice(0, 200) };
    const next: Db = { ...db, rewards: { ...db.rewards, [accountId]: { ...db.rewards?.[accountId], [kind]: reward } } };
    if (!granted && kind === "verification_review") {
      // Without the reward an open request has nothing to stand on.
      const requests = (db.verifications?.[accountId] ?? []).map((request) =>
        request.state === "requested" ? { ...request, state: "declined" as const, decidedAt: at, declineReason: "other" as const } : request,
      );
      next.verifications = { ...db.verifications, [accountId]: requests };
    }
    return this.write(next).ok;
  }

  private read(): string | null {
    try {
      return this.storage()?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private db(): Db {
    return parse(this.read());
  }

  private currentId(db: Db): string | null {
    const id = db.session?.accountId;
    return id && db.accounts.some((account) => account.id === id) ? id : null;
  }

  private write(db: Db): Result {
    const storage = this.storage();
    if (!storage) return { ok: false, error: "unavailable" };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // QuotaExceededError: demo storage is a few MB per site.
      return { ok: false, error: "storageFull" };
    }
    for (const listener of this.listeners) listener();
    return { ok: true };
  }
}

/**
 * The accounts kept in this browser: for the team console in demo
 * mode, which runs in the same browser. Phase 1 replaces this with a team-only database view.
 */
export function deviceAccounts(storage: StorageLike | null): { account: Account; site: Site; logins: LoginEvent[] }[] {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  const db = parse(raw);
  return db.accounts.flatMap((stored) => {
    const site = db.sites[stored.id];
    return site ? [{ account: publicAccount(stored), site, logins: db.logins?.[stored.id] ?? [] }] : [];
  });
}
