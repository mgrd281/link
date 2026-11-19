import { z } from "zod";

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
    const written = this.write({
      ...db,
      accounts: [...db.accounts, account],
      sites: { ...db.sites, [account.id]: firstSite({ ...signUp, username, email, locale: input.locale }) },
      session: { accountId: account.id, since: now() },
    });
    if (written.ok) void this.logSignIn(account.id, "success");
    return written;
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
