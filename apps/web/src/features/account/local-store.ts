import { z } from "zod";

import { hashPassword, isStrongEnough, verifyPassword, type PasswordHash } from "./password";
import { firstSite } from "./site-builders";
import type { Account, AccountSnapshot, AccountStore, LoginContext, LoginEvent, Result, SignUpInput, Site, UsernameStatus } from "./types";
import { localUsernameStatus, normalizeEmail, normalizeUsername } from "./username";

export { preparedSite, starterSite } from "./site-builders";

/**
 * Demo-mode account store: everything lives in this browser's localStorage under one key.
 * - Passwords are hashed (PBKDF2), never stored in plain text.
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

interface StoredAccount extends Account {
  password: PasswordHash;
}

interface Db {
  version: 1;
  accounts: StoredAccount[];
  sites: Record<string, Site>;
  session: { accountId: string; since: string } | null;
  /** Sign-ins and failed attempts per account (30 days, at most 50), for account security. */
  logins?: Record<string, LoginEvent[]>;
}

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
  readonly passwordReset = "direct" as const;
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

  async signUp(input: SignUpInput): Promise<Result> {
    const email = normalizeEmail(input.email);
    const username = normalizeUsername(input.username);
    if (!emailSchema.safeParse(email).success) return { ok: false, error: "invalidEmail" };
    const status = this.usernameStatusNow(username);
    if (status !== "ok") return { ok: false, error: status };
    if (!isStrongEnough(input.password, { email, username })) return { ok: false, error: "weakPassword" };
    if (this.db().accounts.some((account) => account.email === email)) return { ok: false, error: "emailTaken" };

    const password = await hashPassword(input.password);
    const account: StoredAccount = { id: crypto.randomUUID(), email, username, createdAt: now(), password };
    const db = this.db();
    const written = this.write({
      ...db,
      accounts: [...db.accounts, account],
      sites: {
        ...db.sites,
        [account.id]: firstSite({ ...input, username, email }),
      },
      session: { accountId: account.id, since: now() },
    });
    if (written.ok) void this.logSignIn(account.id, "success");
    return written;
  }

  async logIn(input: { email: string; password: string }): Promise<Result> {
    const email = normalizeEmail(input.email);
    const db = this.db();
    const account = db.accounts.find((candidate) => candidate.email === email);
    // Same answer for "no such email" and "wrong password" (no account enumeration).
    if (!account) return { ok: false, error: "invalidCredentials" };
    if (!(await verifyPassword(input.password, account.password))) {
      void this.logSignIn(account.id, "failed");
      return { ok: false, error: "invalidCredentials" };
    }
    const written = this.write({ ...db, session: { accountId: account.id, since: now() } });
    if (written.ok) void this.logSignIn(account.id, "success");
    return written;
  }

  logOut(): void {
    this.write({ ...this.db(), session: null });
  }

  async resetPassword(input: { email: string; password?: string | undefined }): Promise<Result> {
    const email = normalizeEmail(input.email);
    const db = this.db();
    const account = db.accounts.find((candidate) => candidate.email === email);
    if (!account) return { ok: false, error: "notFound" };
    if (!input.password || !isStrongEnough(input.password, { email, username: account.username })) return { ok: false, error: "weakPassword" };
    const password = await hashPassword(input.password);
    return this.write({ ...this.db(), accounts: db.accounts.map((candidate) => (candidate.id === account.id ? { ...candidate, password } : candidate)) });
  }

  async setNewPassword(next: string): Promise<Result> {
    const db = this.db();
    const account = db.accounts.find((candidate) => candidate.id === this.currentId(db));
    if (!account) return { ok: false, error: "notFound" };
    if (!isStrongEnough(next, account)) return { ok: false, error: "weakPassword" };
    const password = await hashPassword(next);
    return this.write({ ...this.db(), accounts: db.accounts.map((candidate) => (candidate.id === account.id ? { ...candidate, password } : candidate)) });
  }

  async changePassword(input: { current: string; next: string }): Promise<Result> {
    const db = this.db();
    const account = db.accounts.find((candidate) => candidate.id === this.currentId(db));
    if (!account) return { ok: false, error: "notFound" };
    if (!(await verifyPassword(input.current, account.password))) return { ok: false, error: "wrongPassword" };
    if (!isStrongEnough(input.next, account)) return { ok: false, error: "weakPassword" };
    const password = await hashPassword(input.next);
    return this.write({ ...this.db(), accounts: db.accounts.map((candidate) => (candidate.id === account.id ? { ...candidate, password } : candidate)) });
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
    // Everything kept about the account, its sign-in log included (GDPR Art. 15 and 20).
    return JSON.stringify({ exportedAt: now(), account: publicAccount(account), site: db.sites[account.id], signIns: db.logins?.[account.id] ?? [] }, null, 2);
  }

  deleteAccount(): Promise<Result> {
    const db = this.db();
    const id = this.currentId(db);
    if (!id) return Promise.resolve({ ok: false, error: "notFound" });
    const sites = Object.fromEntries(Object.entries(db.sites).filter(([key]) => key !== id));
    const logins = Object.fromEntries(Object.entries(db.logins ?? {}).filter(([key]) => key !== id));
    return Promise.resolve(this.write({ ...db, accounts: db.accounts.filter((account) => account.id !== id), sites, logins, session: null }));
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
 * The accounts kept in this browser, without their password hashes: for the team console in demo
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
