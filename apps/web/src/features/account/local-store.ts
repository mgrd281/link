import { NO_IMAGE, profileSchema, RESERVED_USERNAMES, type Page } from "@linkyo/blocks";
import { z } from "zod";

import { hashPassword, isStrongEnough, verifyPassword, type PasswordHash } from "./password";
import type { Account, AccountSnapshot, AccountStore, Result, SignUpInput, Site } from "./types";

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
}

const EMPTY: Db = { version: 1, accounts: [], sites: {}, session: null };
const LOADING: AccountSnapshot = { status: "loading" };
const SIGNED_OUT: AccountSnapshot = { status: "signedOut" };

const emailSchema = z.email();
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (username: string) => username.trim().toLowerCase();
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

/** A brand-new creator page: the address, no photo yet (monogram), no blocks. */
export function starterSite(username: string, email: string, locale: Page["profile"]["locale"]): Site {
  return {
    page: {
      profile: { username, displayName: username, bio: "", avatar: { src: NO_IMAGE, alt: "" }, verified: false, locale },
      blocks: [],
    },
    theme: { template: "nocturne" },
    legal: { name: "", address: "", email, phone: "" },
    onboarded: false,
    updatedAt: now(),
  };
}

/** A page the Linkyo team prepared: ready to share, no welcome flow, a one-time welcome on Home. */
export function preparedSite(username: string, email: string, prepared: NonNullable<SignUpInput["prepared"]>): Site {
  const page = prepared.page;
  return {
    ...starterSite(username, email, page.profile.locale),
    page: { profile: { ...page.profile, username }, blocks: page.blocks },
    theme: prepared.theme,
    onboarded: true,
    prepared: { at: now() },
  };
}

export class LocalAccountStore implements AccountStore {
  readonly demo = true;
  private readonly listeners = new Set<() => void>();
  private raw: string | null | undefined;
  private snapshot: AccountSnapshot = LOADING;
  private readonly storage: () => StorageLike | null;

  constructor(storage: () => StorageLike | null) {
    this.storage = storage;
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

  usernameStatus = (input: string) => {
    const username = normalizeUsername(input);
    if (!profileSchema.shape.username.safeParse(username).success) return "invalidUsername" as const;
    if (RESERVED_USERNAMES.has(username)) return "reservedUsername" as const;
    const db = this.db();
    const current = this.currentId(db);
    if (db.accounts.some((account) => account.username === username && account.id !== current)) return "usernameTaken" as const;
    return "ok" as const;
  };

  async signUp(input: SignUpInput): Promise<Result> {
    const email = normalizeEmail(input.email);
    const username = normalizeUsername(input.username);
    if (!emailSchema.safeParse(email).success) return { ok: false, error: "invalidEmail" };
    const status = this.usernameStatus(username);
    if (status !== "ok") return { ok: false, error: status };
    if (!isStrongEnough(input.password, { email, username })) return { ok: false, error: "weakPassword" };
    if (this.db().accounts.some((account) => account.email === email)) return { ok: false, error: "emailTaken" };

    const password = await hashPassword(input.password);
    const account: StoredAccount = { id: crypto.randomUUID(), email, username, createdAt: now(), password };
    const db = this.db();
    return this.write({
      ...db,
      accounts: [...db.accounts, account],
      sites: {
        ...db.sites,
        [account.id]: input.prepared
          ? preparedSite(username, email, input.prepared)
          : { ...starterSite(username, email, input.locale), ...(input.start ? { kind: input.start.kind, theme: input.start.theme } : {}) },
      },
      session: { accountId: account.id, since: now() },
    });
  }

  async logIn(input: { email: string; password: string }): Promise<Result> {
    const email = normalizeEmail(input.email);
    const db = this.db();
    const account = db.accounts.find((candidate) => candidate.email === email);
    // Same answer for "no such email" and "wrong password" (no account enumeration).
    if (!account || !(await verifyPassword(input.password, account.password))) return { ok: false, error: "invalidCredentials" };
    return this.write({ ...db, session: { accountId: account.id, since: now() } });
  }

  logOut(): void {
    this.write({ ...this.db(), session: null });
  }

  async resetPassword(input: { email: string; password: string }): Promise<Result> {
    const email = normalizeEmail(input.email);
    const db = this.db();
    const account = db.accounts.find((candidate) => candidate.email === email);
    if (!account) return { ok: false, error: "notFound" };
    if (!isStrongEnough(input.password, { email, username: account.username })) return { ok: false, error: "weakPassword" };
    const password = await hashPassword(input.password);
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

  changeEmail(input: string): Result {
    const email = normalizeEmail(input);
    if (!emailSchema.safeParse(email).success) return { ok: false, error: "invalidEmail" };
    const db = this.db();
    const id = this.currentId(db);
    if (!id) return { ok: false, error: "notFound" };
    if (db.accounts.some((account) => account.email === email && account.id !== id)) return { ok: false, error: "emailTaken" };
    return this.write({ ...db, accounts: db.accounts.map((account) => (account.id === id ? { ...account, email } : account)) });
  }

  changeUsername(input: string): Result {
    const username = normalizeUsername(input);
    const status = this.usernameStatus(username);
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

  exportData(): string {
    const db = this.db();
    const account = db.accounts.find((candidate) => candidate.id === this.currentId(db));
    if (!account) return "{}";
    return JSON.stringify({ exportedAt: now(), account: publicAccount(account), site: db.sites[account.id] }, null, 2);
  }

  deleteAccount(): void {
    const db = this.db();
    const id = this.currentId(db);
    if (!id) return;
    const sites = Object.fromEntries(Object.entries(db.sites).filter(([key]) => key !== id));
    this.write({ ...db, accounts: db.accounts.filter((account) => account.id !== id), sites, session: null });
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
