"use client";

import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { uploadDataUrl } from "@/features/app/media-upload";
import type { ReferralOverview, VerificationResult } from "@/features/referrals/types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { fromJson, toJson } from "@/lib/supabase/json";

import { hasDataUrls, migrateDataUrls, replaceSources } from "./media-migrate";
import { handOverPendingEdits } from "./pending-edits";
import { starterSite } from "./site-builders";
import type {
  Account,
  AccountSnapshot,
  AccountStore,
  AuthError,
  CodeRequest,
  DeviceInfo,
  Legal,
  LoginEvent,
  Result,
  Site,
  UsernameStatus,
} from "./types";
import { localUsernameStatus, normalizeEmail, normalizeUsername } from "./username";

/**
 * Real accounts (Supabase Auth + Postgres in Frankfurt, ADR 0030). Same contract as the demo store,
 * so no screen changes:
 * - Sign-up and sign-in go through our server routes (/api/auth/*), which check blocked addresses
 *   and suspended accounts and write the security log; the browser then adopts the session.
 * - The page is edited in memory and saved in the background (debounced, retried on failure).
 * - Everything else talks to Postgres directly with the publishable key, inside row-level security.
 */

type SiteRow = Tables<"sites">;
type SignInRow = Pick<Tables<"sign_ins">, "id" | "at" | "result" | "ip" | "country" | "city" | "device" | "device_id" | "signature">;
type Client = SupabaseClient<Database>;

type ServerResult = Result & { session?: { access_token: string; refresh_token: string } };
type DeviceContext = () => Promise<{ device: DeviceInfo; deviceId: string; signature?: string }>;

const LOADING: AccountSnapshot = { status: "loading" };
const SIGNED_OUT: AccountSnapshot = { status: "signedOut" };
const SAVE_DELAY = 400;
/** Requests with `keepalive` (the only kind that survives closing the tab) may carry at most 64 KB. */
const KEEPALIVE_LIMIT = 60_000;
const RETRY_DELAYS = [2_000, 5_000, 15_000, 30_000];
/**
 * How long a hidden tab waits for a save on its way, or the read-back of one whose answer was lost,
 * before it sends what is left anyway (with the exact guard): a phone may freeze the page soon after.
 */
export const HIDDEN_WAIT = 3_000;

const AUTH_ERRORS = new Set<string>(["invalidUsername", "reservedUsername", "usernameTaken"]);

type VerificationError = Extract<VerificationResult, { ok: false }>["error"];
/** What request_verification() answers besides 'ok' (anything else counts as a server error). */
const VERIFICATION_ERRORS: readonly VerificationError[] = ["invalidLinks", "alreadyOpen", "tooSoon", "notUnlocked", "alreadyVerified", "unavailable"];
const verificationError = (answer: string): VerificationError => VERIFICATION_ERRORS.find((known) => known === answer) ?? "serverError";
const emptyLegal: Legal = { name: "", address: "", email: "", phone: "" };

function fromRow(row: SiteRow): Site {
  const prepared = fromJson<Site["prepared"] | null>(row.prepared);
  return {
    page: fromJson<Page>(row.page),
    theme: fromJson<CreatorThemeConfig>(row.theme),
    legal: { ...emptyLegal, ...fromJson<Partial<Legal>>(row.legal) },
    onboarded: row.onboarded,
    ...(row.kind ? { kind: row.kind } : {}),
    ...(prepared ? { prepared } : {}),
    updatedAt: row.updated_at,
  };
}

function toRow(site: Site) {
  return {
    kind: site.kind ?? null,
    onboarded: site.onboarded,
    theme: toJson(site.theme),
    page: toJson(site.page),
    legal: toJson(site.legal),
    prepared: site.prepared ? toJson(site.prepared) : null,
  };
}

function toLoginEvent(row: SignInRow): LoginEvent {
  const device = fromJson<Partial<DeviceInfo> | null>(row.device);
  return {
    id: row.id,
    at: row.at,
    result: row.result === "failed" ? "failed" : "success",
    ip: String(row.ip),
    ...(row.country ? { country: row.country } : {}),
    ...(row.city ? { city: row.city } : {}),
    device: { type: device?.type ?? "desktop", os: device?.os ?? "", browser: device?.browser ?? "" },
    deviceId: row.device_id,
    ...(row.signature ? { signature: row.signature } : {}),
  };
}

const origin = () => window.location.origin;
const localeOf = (site: Site | null) => site?.page.profile.locale ?? "de";

/** The database refused the page for its size (`sites.site_size`): retrying the same page cannot help. */
const tooLarge = (error: { code?: string; message?: string }) => error.code === "23514" && (error.message ?? "").includes("site_size");

type SiteContent = ReturnType<typeof toRow>;

/** A JSON value in one fixed spelling: keys sorted (Postgres hands `jsonb` back in its own key order). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return value === undefined ? "null" : JSON.stringify(value);
}

/**
 * What a version of the page holds, without what the server owns: `sites_guard` writes the badge and
 * the address into every page, so a version that differs only there was not changed by anyone's edit
 * (an address change, the team's badge).
 */
export function contentKey(content: SiteContent): string {
  const page = content.page as Record<string, unknown>;
  const { username: _username, verified: _verified, ...profile } = (page.profile ?? {}) as Record<string, unknown>;
  return canonical({ ...content, page: { ...page, profile } });
}

/**
 * A short fingerprint of a content key: the writes that may have landed are remembered by this, never
 * as whole pages (there is no limit on how many). Two 32-bit hashes and the length: a foreign page that
 * matches one of them by chance (and would be overwritten as this tab's own) is not a practical risk.
 */
export function fingerprint(key: string): string {
  let a = 0x811c9dc5;
  let b = 0x2545f491;
  for (let i = 0; i < key.length; i += 1) {
    const code = key.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x5bd1e995);
    b ^= b >>> 13;
  }
  return `${key.length.toString(36)}.${(a >>> 0).toString(36)}.${(b >>> 0).toString(36)}`;
}

/** The browser says it is offline: a write tried now never left this device. */
const offline = () => typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;

/**
 * A failed write may still have reached the database when no answer came at all (the connection
 * dropped, a timeout: PostgREST's client reports status 0) or the server failed (5xx). A 4xx answer
 * from PostgREST means it wrote nothing; neither did a write tried while the browser was offline.
 */
const mayHaveLanded = (sentOffline: boolean, status?: number) => !sentOffline && !(status !== undefined && status >= 400 && status < 500);

/**
 * Refused saves in a row that each turned out to be this tab's own (its write landed, the answer was
 * lost) are sent again at once this many times; after that the next one waits like a failed save.
 */
const MAX_REBASES = 3;
/** Saving everything before signing out (or `flush`) stops after this many rounds that each left a change waiting. */
const SETTLE_ROUNDS = 2 * MAX_REBASES + 2;

export class SupabaseAccountStore implements AccountStore {
  readonly demo = false;
  private snapshot: AccountSnapshot = LOADING;
  private readonly listeners = new Set<() => void>();
  private started = false;
  private loadedFor: string | null = null;
  private saveTimer: number | null = null;
  private saving: Promise<void> | null = null;
  private retries = 0;
  private dirty = false;
  private token: string | null = null;
  /** Pictures moved from data URLs to Storage in this session (data URL → address): never uploaded twice. */
  private readonly uploaded = new Map<string, string>();
  /**
   * The save guard (ADR 0088): the row's `updated_at` as it was read or last saved here. A
   * save writes only while the row still has it, so a stale copy never overwrites a newer page.
   */
  private base: string | null = null;
  /**
   * What the page held at `base`: a refused save that finds it, a write still on its way or one whose
   * answer never came, was this tab's own.
   */
  private baseContent: SiteContent | null = null;
  private readonly sending = new Set<SiteContent>();
  /**
   * Every write since the last confirmed version that may have reached the database without this tab
   * hearing back (fingerprint → its number, see `sent`). A refused save that finds one of them in the
   * row was this tab's own. Only a confirmed version (for the writes sent up to it), a rebase on this
   * tab's own version and a replaced page clear it.
   */
  private readonly landed = new Map<string, number>();
  /** Read-backs of saves whose answer was lost, still running (a hidden tab waits for them). */
  private readonly reading = new Set<Promise<void>>();
  /**
   * The lost writes (`landed`) up to this number were resolved by a read of the row since: none of
   * them is in the row unseen. A hidden tab with one still open sends its keepalive with the closing
   * tab's guard (`saveWhenHidden`).
   */
  private lostResolved = 0;
  /** A hidden tab waiting for what is uncertain before it sends the rest (`saveWhenHidden`). */
  private hiddenWait: Promise<void> | null = null;
  private rebases = 0;
  /**
   * Writes are numbered as they are sent. Two of them can both land (a save on its way, then the
   * keepalive save after it), and their answers may come back in either order: the answer of one
   * sent before the newest confirmed one never moves the base back.
   */
  private sent = 0;
  private confirmedWrite = 0;
  /** The last save failed (network, server): `flush()` says so instead of answering an old version. */
  private failed = false;
  private revision = 0;
  private conflicts = 0;

  constructor(
    private readonly client: () => Client,
    private readonly device: DeviceContext,
  ) {}

  // Arrow properties: React calls these detached.
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.start();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AccountSnapshot => this.snapshot;
  getServerSnapshot = (): AccountSnapshot => LOADING;

  private set(next: AccountSnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    const supabase = this.client();
    supabase.auth.onAuthStateChange((event, session) => {
      this.token = session?.access_token ?? null;
      // Never await Supabase inside this callback (it holds the auth lock): continue right after.
      window.setTimeout(() => {
        if (event === "SIGNED_OUT" || !session) {
          this.loadedFor = null;
          // Nothing of this session's saves may carry over to the next account signed in in this tab.
          this.resetSaves();
          this.set(SIGNED_OUT);
          return;
        }
        if (event === "USER_UPDATED" && this.snapshot.status === "signedIn") {
          this.set({ ...this.snapshot, account: { ...this.snapshot.account, email: session.user.email ?? this.snapshot.account.email } });
          return;
        }
        if (this.loadedFor !== session.user.id) void this.load(session);
      }, 0);
    });
    // Save what is pending when the tab is hidden (another tab, another app on a phone: the page keeps
    // running) or goes away (closing, reloading: no code runs after this).
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.saveWhenHidden();
    });
    window.addEventListener("pagehide", () => {
      this.saveOnExit(this.uncertain());
    });
  }

  /**
   * Forgets what one session's saves left behind: a change waiting, the retry timer, failures in a row,
   * the writes whose answers were lost, a hidden tab's wait and the version built on. Called when the
   * session ends and when another account takes this tab (signed out in Settings, then another sign-in
   * in the same document): the next account must not start with the last one's `dirty` and lost writes,
   * or its closing tab would send its own unchanged page with the loose guard over its app's write.
   * Late answers to the last account's writes are dropped by their own account checks.
   */
  private resetSaves() {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.dirty = false;
    this.failed = false;
    this.retries = 0;
    this.rebases = 0;
    this.landed.clear();
    this.sending.clear();
    this.lostResolved = this.sent;
    this.hiddenWait = null;
    this.uploaded.clear();
    this.base = null;
    this.baseContent = null;
  }

  private async load(session: Session): Promise<void> {
    const supabase = this.client();
    const id = session.user.id;
    this.loadedFor = id;
    // Another account than the one shown (or none yet): its saves' state is not this one's.
    const switching = this.snapshot.status !== "signedIn" || this.snapshot.account.id !== id;
    if (switching) this.resetSaves();
    const [profileResult, siteResult] = await Promise.all([
      supabase.from("profiles").select("id, username, locale, status, created_at").eq("id", id).maybeSingle(),
      supabase.from("sites").select("*").eq("profile_id", id).maybeSingle(),
    ]);
    const profile = profileResult.data;
    if (profile?.status !== "active") {
      await supabase.auth.signOut({ scope: "local" });
      return;
    }
    let row = siteResult.data;
    if (!row) {
      // Accounts confirmed before their first page was written start with a blank one.
      const locale = profile.locale === "en" || profile.locale === "ar" ? profile.locale : "de";
      const starter = starterSite(profile.username, session.user.email ?? "", locale);
      const created = await supabase
        .from("sites")
        .insert({ profile_id: id, ...toRow(starter) })
        .select("*")
        .single();
      row = created.data;
    }
    if (!row || this.loadedFor !== id) return;
    // Late answers to the last account's writes may have run while this one loaded.
    if (switching) this.resetSaves();
    const account: Account = { id, email: session.user.email ?? "", username: profile.username, createdAt: profile.created_at };
    const site = fromRow(row);
    this.base = row.updated_at;
    this.baseContent = toRow(site);
    this.set({ status: "signedIn", account, site, sync: "saved", baseUpdatedAt: row.updated_at, revision: this.revision, conflicts: this.conflicts });
  }

  /** Takes over the session our server opened (after a correct code). */
  private async adopt(result: ServerResult): Promise<Result> {
    if (!result.ok) return result;
    if (result.session) {
      const { data, error } = await this.client().auth.setSession(result.session);
      if (error || !data.session) return { ok: false, error: "serverError" };
      await this.load(data.session);
    }
    return result.pending ? { ok: true, pending: result.pending } : { ok: true };
  }

  private async post(path: string, body: object): Promise<ServerResult> {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ...(await this.device()) }),
      });
      return (await response.json()) as ServerResult;
    } catch {
      return { ok: false, error: "serverError" };
    }
  }

  usernameStatus = async (input: string): Promise<UsernameStatus> => {
    const local = localUsernameStatus(input);
    if (local !== "ok") return local;
    const { data, error } = await this.client().rpc("username_status", { candidate: normalizeUsername(input) });
    if (error) return "ok"; // The server checks again on submit.
    return data === "invalidUsername" || data === "reservedUsername" || data === "usernameTaken" ? data : "ok";
  };

  /** What our server needs to know about a new account (the page itself is built there). */
  private static codeBody(input: CodeRequest) {
    return {
      email: input.email,
      locale: input.locale,
      signUp: input.signUp ? { username: input.signUp.username, invite: input.signUp.invite, start: input.signUp.start, ref: input.signUp.ref } : undefined,
    };
  }

  async requestCode(input: CodeRequest): Promise<Result> {
    return this.adopt(await this.post("/api/auth/code", SupabaseAccountStore.codeBody(input)));
  }

  async verifyCode(input: CodeRequest & { code: string }): Promise<Result> {
    return this.adopt(await this.post("/api/auth/verify", { ...SupabaseAccountStore.codeBody(input), code: input.code }));
  }

  async signInWithPassword(input: { email: string; password: string }): Promise<Result> {
    return this.adopt(await this.post("/api/auth/password", { email: input.email, password: input.password }));
  }

  logOut(): void {
    // The editor's change from the last moment (its autosave delay) first, then everything waiting is
    // saved, a refused save of this tab's own included; one that cannot be saved goes with the session.
    handOverPendingEdits();
    void this.settleSaves()
      .catch(() => undefined)
      .finally(() => void this.client().auth.signOut({ scope: "local" }));
  }

  async changeEmail(input: string): Promise<Result> {
    const email = normalizeEmail(input);
    const { error } = await this.client().auth.updateUser(
      { email },
      { emailRedirectTo: `${origin()}/api/auth/confirm?next=/${localeOf(this.currentSite())}/app/settings` },
    );
    if (!error) return { ok: true, pending: "confirmEmail" };
    if (error.code === "email_exists") return { ok: false, error: "emailTaken" };
    if (error.code === "validation_failed" || error.code === "email_address_invalid") return { ok: false, error: "invalidEmail" };
    return { ok: false, error: error.status === 429 ? "tooManyAttempts" : "serverError" };
  }

  async changeUsername(input: string): Promise<Result> {
    const username = normalizeUsername(input);
    const { data, error } = await this.client().rpc("change_username", { candidate: username });
    if (error) return { ok: false, error: "serverError" };
    // Any other answer ("unavailable") means the account is suspended.
    if (data !== "ok") return { ok: false, error: AUTH_ERRORS.has(data) ? (data as AuthError) : "suspended" };
    if (this.snapshot.status === "signedIn") {
      const { account, site } = this.snapshot;
      this.set({
        ...this.snapshot,
        account: { ...account, username },
        site: { ...site, page: { ...site.page, profile: { ...site.page.profile, username } } },
      });
      // The address went into the page row too, as a new version of the same content.
      void this.adoptServerVersion(account.id);
    }
    return { ok: true };
  }

  /**
   * The server wrote the row without a change of this tab's (the address): when it still holds the
   * content this tab built on, its new version becomes the base. Otherwise the next save would be
   * refused, and a tab that closes right after a change (the keepalive save, with nothing left to
   * send it again) would lose it.
   */
  private async adoptServerVersion(id: string): Promise<void> {
    if (this.saving) await this.saving;
    const { data: row } = await this.client().from("sites").select("*").eq("profile_id", id).maybeSingle();
    const now = this.snapshot;
    // A save that started meanwhile finds the new version itself (refused as this tab's own).
    if (!row || this.saving || now.status !== "signedIn" || now.account.id !== id || row.updated_at === this.base) return;
    const latest = toRow(fromRow(row));
    if (this.baseContent === null || contentKey(latest) !== contentKey(this.baseContent)) return;
    this.base = row.updated_at;
    this.baseContent = latest;
    this.set({ ...now, baseUpdatedAt: row.updated_at });
  }

  updateSite(update: (site: Site) => Site): Result {
    if (this.snapshot.status !== "signedIn") return { ok: false, error: "notFound" };
    const current = this.snapshot.site;
    const next = update(current);
    if (next === current) return { ok: true };
    this.dirty = true;
    // A change is a new attempt: a page that was too large may fit now.
    const { syncError: _previous, ...rest } = this.snapshot;
    this.set({ ...rest, site: { ...next, updatedAt: new Date().toISOString() }, sync: "saving" });
    this.schedule(SAVE_DELAY);
    return { ok: true };
  }

  private currentSite(): Site | null {
    return this.snapshot.status === "signedIn" ? this.snapshot.site : null;
  }

  private schedule(delay: number) {
    // A hidden tab waiting (`saveWhenHidden`) sends nothing meanwhile: when the wait ends, what is left
    // goes as its keepalive, or as a normal save once the tab is back on screen.
    if (this.hiddenWait) return;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, delay);
  }

  /**
   * Something this tab sent may have reached the database without the tab knowing its version yet: a
   * save still on its way, or one since the last confirmed version whose answer never came (`landed`).
   */
  private uncertain(): boolean {
    return this.sending.size > 0 || this.landed.size > 0;
  }

  /**
   * The tab is hidden (a tab switch on a computer, another app on a phone). The page usually keeps
   * running, but a phone may freeze it and end it later without another event (iOS ending a suspended
   * app's web view sends no `pagehide`), so the keepalive sent here may be the last write it makes:
   * - nothing uncertain: what is pending goes at once, as a keepalive with the exact guard;
   * - a save on its way, or a write whose answer was lost (`landed`): the tab waits for that to settle
   *   (at most `HIDDEN_WAIT`), and reads the row again for a lost answer, so a write of its own that
   *   landed becomes the version it builds on. Then it sends what is left with the exact guard against
   *   the version it knows, like any save. A refusal is a normal one: the row is read again, a page
   *   changed elsewhere wins and the toast shows when the tab is back.
   * - a lost answer still unresolved when the wait ends (the read failed or took too long): the row may
   *   hold this tab's own write, which an exact keepalive would never match, and nothing may run after
   *   it. So that keepalive takes the closing tab's rule (`updated_at >= base`, `saveOnExit`).
   * The price (ADR 0088): a phone that freezes the page and ends it before a save on its way answers
   * loses the edits made after that save (the save itself is kept); in the last case, a write from
   * elsewhere since this tab last read or saved is overwritten instead of refused.
   */
  private saveWhenHidden() {
    // The editor's change from the last moment: its own listener may run after this one.
    handOverPendingEdits();
    const snapshot = this.snapshot;
    if (!this.dirty || snapshot.status !== "signedIn") return;
    if (!this.uncertain()) {
      this.saveOnExit(false);
      return;
    }
    if (this.hiddenWait) return;
    // Nothing goes out meanwhile; a save that lands or a refusal read back sets the version to build on.
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    // A lost answer: the row is read now, so a write of this tab's that landed becomes the base.
    if (this.lostOpen()) this.readBack(this.readLost(snapshot.account.id));
    const waiting: Promise<void> = this.settled(HIDDEN_WAIT).then(() => {
      // Signed out or another account meanwhile (`resetSaves`): this wait is over.
      if (this.hiddenWait !== waiting) return;
      this.hiddenWait = null;
      // Still hidden: as a keepalive, which outlives a page the phone freezes (the closing tab's guard
      // while a lost answer is still open). Back on screen: the normal save (it waits for one on its way).
      if (document.visibilityState === "hidden") this.saveOnExit(this.lostOpen());
      else if (this.dirty && this.snapshot.status === "signedIn") this.schedule(0);
    });
    this.hiddenWait = waiting;
  }

  /**
   * A hidden tab with an open lost answer reads the row (`saveWhenHidden`). Holding one of this tab's
   * own versions, the tab builds on it (no save goes out here: the keepalive carries the rest). Still
   * at the version it built on, nothing of its lost writes landed; holding a version from elsewhere, the
   * exact guard is right too (a page changed elsewhere wins). Either way the lost answers are resolved.
   */
  private async readLost(id: string): Promise<void> {
    const base = this.base;
    const lost = this.lostUpTo();
    const { data: row, error } = await this.client().from("sites").select("*").eq("profile_id", id).maybeSingle();
    const now = this.snapshot;
    // Something moved meanwhile (a save confirmed, a refusal read back): that one decides.
    if (error || !row || now.status !== "signedIn" || now.account.id !== id || this.base !== base) return;
    const latest = toRow(fromRow(row));
    const key = contentKey(latest);
    if (row.updated_at !== base && this.isOwn(key)) this.rebaseOwn(now, row, latest, key, false);
    else this.resolveLost(lost);
  }

  /** Resolves once no save is on its way and no read-back runs, or after `limit` ms. */
  private async settled(limit: number): Promise<void> {
    let timer = 0;
    const timeout = new Promise<"over">((resolve) => {
      timer = window.setTimeout(() => {
        resolve("over");
      }, limit);
    });
    // A save or read-back that ends may start the next (a rebase sends again): wait for those too.
    while (this.saving || this.reading.size > 0) {
      const outcome = await Promise.race([Promise.allSettled([this.saving, ...this.reading]).then(() => "settled" as const), timeout]);
      if (outcome === "over") break;
    }
    window.clearTimeout(timer);
  }

  /**
   * Sends what is pending as a `keepalive` request, which the browser completes even after the tab is
   * gone (a normal request would be cancelled with the page). It carries the save guard like every
   * save; when the tab is still there, its answer is the new version.
   *
   * `loose`: the last code the page may run, while something may have reached the database without
   * this tab knowing its version yet. A closed tab (`pagehide`) runs no more code, so a refused
   * keepalive is never sent again; its guard therefore depends on `uncertain`:
   * - nothing: `updated_at = base`, the exact guard of every save;
   * - a save still on its way, or one since the last confirmed version that may have landed (`landed`:
   *   no answer at all or a server error, while the browser was online): `updated_at >= base`. That
   *   save carries the exact guard and lands first in the normal order, so an exact keepalive would
   *   always be refused and the last change lost. The other order is safe too: the save, landing
   *   second, no longer finds `base` and changes nothing. The price (ADR 0088): any write from
   *   elsewhere since this tab last read or saved is overwritten instead of refused.
   * A hidden tab (`saveWhenHidden`) uses the exact guard, except for a lost answer it could not read
   * back in time.
   */
  private saveOnExit(loose: boolean) {
    // The editor's change from the last moment: its own listener may run after this one (`pagehide`).
    handOverPendingEdits();
    const snapshot = this.snapshot;
    if (!this.dirty || snapshot.status !== "signedIn" || !this.token) return;
    const content = toRow(snapshot.site);
    const body = JSON.stringify(content);
    if (body.length > KEEPALIVE_LIMIT) {
      void this.drainSaves();
      return;
    }
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.dirty = false;
    const id = snapshot.account.id;
    const base = this.base;
    const guard = base === null ? "" : `&updated_at=${loose ? "gte" : "eq"}.${encodeURIComponent(base)}`;
    const write = (this.sent += 1);
    const sentOffline = offline();
    this.sending.add(content);
    const request = fetch(`${SUPABASE_URL}/rest/v1/sites?profile_id=eq.${id}${guard}&select=updated_at`, {
      method: "PATCH",
      keepalive: true,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body,
    })
      .then(async (response) => {
        if (!response.ok) {
          // Turned down (an expired session, the size limit: nothing written) or a server error (maybe
          // written): the tab, if it is still there, saves again like after any failed save.
          this.sending.delete(content);
          this.exitFailed(id, content, write, sentOffline, response.status);
          return;
        }
        const [row] = (await response.json()) as { updated_at?: string }[];
        this.sending.delete(content);
        if (row?.updated_at) this.saved(id, row.updated_at, content, write);
        else await this.refused(id, base);
      })
      .catch(() => {
        this.sending.delete(content);
        this.exitFailed(id, content, write, sentOffline);
      });
    void this.track(request);
  }

  /** The keepalive save failed and the tab is still there (a phone back from another app): saved again later. */
  private exitFailed(id: string, content: SiteContent, write: number, sentOffline: boolean, status?: number) {
    const now = this.snapshot;
    // Signed out, or another account in this tab by now: nothing of this write is that account's.
    if (now.status !== "signedIn" || now.account.id !== id) return;
    this.unconfirm(content, write, sentOffline, status);
    this.dirty = true;
    this.failed = true;
    if (this.saveTimer === null) this.retry(now);
  }

  /** Every save goes into `saving`; the next one waits until all that are on their way have landed. */
  private track(work: Promise<unknown>): Promise<void> {
    const previous = this.saving;
    const all: Promise<void> = (previous ? Promise.allSettled([previous, work]) : work).then(
      () => undefined,
      () => undefined,
    );
    this.saving = all;
    void all.then(() => {
      if (this.saving === all) this.saving = null;
    });
    return all;
  }

  /** Saves now if something is pending (one pass: `settleSaves` also sends again what a refusal left waiting). */
  private async drainSaves(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.saving) await this.saving;
    if (this.dirty) await this.save();
  }

  /**
   * Saves until nothing waits (before signing out, an export, a deletion and `flush`): a refused save
   * that was this tab's own is sent again here at once (also past `MAX_REBASES`), and so is a change
   * made while a save was on its way. Stops at a save that failed (offline, too large).
   */
  private async settleSaves(): Promise<void> {
    for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
      await this.drainSaves();
      if (!this.dirty || this.failed) return;
    }
  }

  /**
   * For the iPhone app before it changes the page itself (`window.linkyoApp.flush`): everything
   * waiting is saved, then the version on the server is answered.
   */
  flush = async (): Promise<{ updatedAt: string | null }> => {
    await this.settleSaves();
    if (this.snapshot.status !== "signedIn") return { updatedAt: null };
    if (this.dirty) throw new Error(this.snapshot.syncError ?? "saveFailed");
    return { updatedAt: this.base };
  };

  /**
   * After the iPhone app changed the page (`window.linkyoApp.reload`): saves what is waiting, reads the
   * row again and starts the editor over from it. When nothing changed, nothing happens.
   */
  reload = async (): Promise<void> => {
    await this.flush();
    const snapshot = this.snapshot;
    if (snapshot.status !== "signedIn") return;
    const { data: row, error } = await this.client().from("sites").select("*").eq("profile_id", snapshot.account.id).maybeSingle();
    if (error || !row) throw new Error("reloadFailed");
    const now = this.snapshot;
    if (now.status !== "signedIn" || now.account.id !== snapshot.account.id || row.updated_at === this.base) return;
    // A change made while the row was read is saved against the guard, which meets the newer version itself.
    if (this.dirty || this.saving) return;
    this.replace(row, false);
  };

  private async save(): Promise<void> {
    if (this.saving) {
      // One save at a time; the latest state goes in the next one.
      await this.saving;
      if (this.dirty) this.schedule(0);
      return;
    }
    const snapshot = this.snapshot;
    if (snapshot.status !== "signedIn" || !this.dirty) return;
    this.dirty = false;
    const id = snapshot.account.id;
    const base = this.base;
    const run = async () => {
      // Pictures still inside the page (imported from the demo, the "Try it" photo) go to Storage first;
      // one that fails to upload stays as it is and is tried again on the next save.
      const site = hasDataUrls(snapshot.site.page)
        ? { ...snapshot.site, page: await migrateDataUrls(snapshot.site.page, (dataUrl) => uploadDataUrl(dataUrl), { uploaded: this.uploaded }) }
        : snapshot.site;
      const content = toRow(site);
      // The guard: the row changes only while it is still the version this tab read or last saved.
      const update = this.client().from("sites").update(content).eq("profile_id", id);
      const write = (this.sent += 1);
      const sentOffline = offline();
      this.sending.add(content);
      const { data, error, status } = await (base === null ? update : update.eq("updated_at", base)).select("page, updated_at").maybeSingle();
      this.sending.delete(content);
      const now = this.snapshot;
      if (now.status !== "signedIn" || now.account.id !== id) return;
      if (error) {
        this.dirty = true;
        this.failed = true;
        if (tooLarge(error)) {
          // No retry loop: the page stays too large until it changes (the next change saves again).
          this.retries = 0;
          this.set({ ...now, sync: "error", syncError: "tooLarge" });
          return;
        }
        this.unconfirm(content, write, sentOffline, status);
        this.retry(now);
        // Not awaited: offline, the read is retried for seconds, and no save waits for it (a hidden
        // tab does, for a while: `saveWhenHidden`).
        if (mayHaveLanded(sentOffline, status)) this.readBack(this.recheck(id, base, content, write));
        return;
      }
      if (!data) {
        await this.refused(id, base);
        return;
      }
      this.confirm(data.updated_at, content, write);
      this.showSaved(now, data.page, data.updated_at);
    };
    const running = run();
    void this.track(running);
    await running;
  }

  /**
   * After a confirmed save: the server owns the badge and the address on the page (sites_guard); keep
   * its word. Pictures that went to Storage keep their new address here too.
   */
  private showSaved(now: Extract<AccountSnapshot, { status: "signedIn" }>, savedPage: SiteRow["page"], updatedAt: string) {
    const saved = fromJson<Page>(savedPage).profile;
    const page = this.uploaded.size > 0 ? replaceSources(now.site.page, this.uploaded) : now.site.page;
    const profile = { ...page.profile, verified: saved.verified, username: saved.username };
    const { syncError: _resolved, ...rest } = now;
    this.set({ ...rest, site: { ...now.site, page: { ...page, profile } }, sync: this.dirty ? "saving" : "saved", baseUpdatedAt: this.base ?? updatedAt });
  }

  /**
   * A save failed in a way that may have written it (no answer, a server error): the row is read back
   * at once, since a read often gets through where the write's answer did not (a connection that drops
   * on the way back). Holding this write's content, the save landed: it counts as confirmed. Holding
   * another version of this tab's own (an earlier write that landed), the tab builds on that. Anything
   * else, no answer, or a write sent after this one meanwhile changes nothing here: the next save's
   * guard decides.
   */
  private async recheck(id: string, base: string | null, content: SiteContent, write: number): Promise<void> {
    const lost = this.lostUpTo();
    const { data: row, error } = await this.client().from("sites").select("*").eq("profile_id", id).maybeSingle();
    const now = this.snapshot;
    if (error || !row || now.status !== "signedIn" || now.account.id !== id) return;
    // Something moved meanwhile (a later write, a refusal read back): that one decides.
    if (this.sent !== write || this.base !== base || this.sending.size > 0) return;
    // Still the version this tab built on: nothing of its lost writes landed.
    if (row.updated_at === base) {
      this.resolveLost(lost);
      return;
    }
    const latest = toRow(fromRow(row));
    const key = contentKey(latest);
    if (key === contentKey(content)) {
      this.confirm(row.updated_at, latest, write);
      this.dirty = contentKey(toRow(now.site)) !== key;
      this.showSaved(now, row.page, row.updated_at);
      // The failed save's retry is not needed; a change made meanwhile goes out at once.
      if (this.dirty) this.schedule(0);
      else if (this.saveTimer !== null) {
        window.clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      return;
    }
    // Changed elsewhere: the next save's exact guard is refused, and the newer page wins.
    if (!this.isOwn(key)) {
      this.resolveLost(lost);
      return;
    }
    // Whether anything waits is what the page here holds beyond that version (the failed save set it).
    this.dirty = false;
    this.rebaseOwn(now, row, latest, key);
  }

  /** The newest of the writes whose answers were lost (`landed`) so far, 0 for none. */
  private lostUpTo(): number {
    return Math.max(0, ...this.landed.values());
  }

  /** A read of the row showed what became of the lost writes up to `write`: none of them is still open. */
  private resolveLost(write: number) {
    this.lostResolved = Math.max(this.lostResolved, write);
  }

  /** A write whose answer was lost and that no read of the row has resolved since (`saveWhenHidden`). */
  private lostOpen(): boolean {
    for (const write of this.landed.values()) if (write > this.lostResolved) return true;
    return false;
  }

  /** Keeps a running read-back in `reading` until it ends. */
  private readBack(work: Promise<void>) {
    const running = work.catch(() => undefined);
    this.reading.add(running);
    void running.then(() => this.reading.delete(running));
  }

  /** A failed save is tried again, each time a little later (the next change tries at once). */
  private retry(now: Extract<AccountSnapshot, { status: "signedIn" }>) {
    const delay = RETRY_DELAYS[Math.min(this.retries, RETRY_DELAYS.length - 1)] ?? 30_000;
    this.retries += 1;
    this.set({ ...now, sync: "error" });
    this.schedule(delay);
  }

  /** The server took a write: its version is the one the next save builds on (unless a later write's answer came first). */
  private confirm(updatedAt: string, content: SiteContent, write: number) {
    if (write < this.confirmedWrite) return;
    this.confirmedWrite = write;
    this.base = updatedAt;
    this.baseContent = content;
    // A write sent before this one can no longer land (its guard names an older version); one sent
    // after it (the keepalive save) still can.
    for (const [key, sent] of this.landed) if (sent <= write) this.landed.delete(key);
    this.retries = 0;
    this.rebases = 0;
    this.failed = false;
  }

  /** The keepalive save's answer came while the tab was still there. */
  private saved(id: string, updatedAt: string, content: SiteContent, write: number) {
    const now = this.snapshot;
    if (now.status !== "signedIn" || now.account.id !== id) return;
    this.confirm(updatedAt, content, write);
    this.set({ ...now, baseUpdatedAt: this.base ?? updatedAt, sync: this.dirty ? "saving" : "saved" });
  }

  /**
   * A write that failed: when it may have landed (no answer, a server error), the server may hold it, so
   * a later refusal recognises it as this tab's own. Every such write is kept until a version is confirmed.
   */
  private unconfirm(content: SiteContent, write: number, sentOffline: boolean, status?: number) {
    if (!mayHaveLanded(sentOffline, status)) return;
    const key = fingerprint(contentKey(content));
    this.landed.set(key, Math.max(write, this.landed.get(key) ?? 0));
  }

  /** What this tab read, saved, is sending or may have written (apart from what the server owns). */
  private isOwn(key: string): boolean {
    if (this.baseContent !== null && contentKey(this.baseContent) === key) return true;
    for (const content of this.sending) if (contentKey(content) === key) return true;
    return this.landed.has(fingerprint(key));
  }

  /**
   * A save the guard turned down: the row is no longer the version this tab built on. It is read
   * again to decide (ADR 0088):
   * - still the same version: the database refused the write (a suspended account), retried like a failed save;
   * - what this tab read, sent or may have written itself, apart from what the server owns (the badge,
   *   the address): it builds on the newer version and sends what is waiting again, at once the first
   *   `MAX_REBASES` times in a row, after that like a failed save (later, each time a little later);
   * - anything else was changed elsewhere (another tab, the iPhone app): the newer version wins, this
   *   tab's unsaved change is dropped, and the editor starts over from it and says so.
   */
  private async refused(id: string, base: string | null): Promise<void> {
    const { data: row, error } = await this.client().from("sites").select("*").eq("profile_id", id).maybeSingle();
    const now = this.snapshot;
    if (now.status !== "signedIn" || now.account.id !== id) return;
    if (error || !row || row.updated_at === base) {
      this.dirty = true;
      this.failed = true;
      this.retry(now);
      return;
    }
    const latest = toRow(fromRow(row));
    const key = contentKey(latest);
    if (!this.isOwn(key)) {
      this.replace(row, true);
      return;
    }
    this.rebaseOwn(now, row, latest, key);
  }

  /**
   * The row holds a version of this tab's own: the page here stays, and the next save builds on that
   * version. The server has just answered, so the save is not failing. `send`: what waits goes out at
   * once (a hidden tab's read-back leaves that to its keepalive).
   */
  private rebaseOwn(now: Extract<AccountSnapshot, { status: "signedIn" }>, row: SiteRow, latest: SiteContent, key: string, send = true) {
    this.base = row.updated_at;
    this.baseContent = latest;
    this.landed.clear();
    this.dirty = this.dirty || contentKey(toRow(now.site)) !== key;
    this.failed = false;
    if (!send) {
      this.set({ ...now, baseUpdatedAt: row.updated_at, sync: this.dirty ? "saving" : "saved" });
      return;
    }
    if (this.rebases < MAX_REBASES) {
      this.rebases += 1;
      this.retries = 0;
      this.set({ ...now, baseUpdatedAt: row.updated_at, sync: this.dirty ? "saving" : "saved" });
      if (this.dirty) this.schedule(0);
      return;
    }
    // Rebased this often without a confirmed save (its answers keep getting lost): no tight loop, the
    // change waits like after a failed save. Nothing is dropped.
    const rebased = { ...now, baseUpdatedAt: row.updated_at };
    if (this.dirty) this.retry(rebased);
    else this.set({ ...rebased, sync: "saved" });
  }

  /** The page from the server replaces the one here, and the editor starts over from it (`revision`). */
  private replace(row: SiteRow, conflict: boolean) {
    const now = this.snapshot;
    if (now.status !== "signedIn") return;
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const site = fromRow(row);
    this.dirty = false;
    this.failed = false;
    this.retries = 0;
    this.rebases = 0;
    this.base = row.updated_at;
    this.baseContent = toRow(site);
    this.landed.clear();
    this.revision += 1;
    if (conflict) this.conflicts += 1;
    const { syncError: _gone, ...rest } = now;
    // The address on the page is the account's (sites_guard): another tab may have changed it.
    const username = site.page.profile.username || now.account.username;
    this.set({
      ...rest,
      account: { ...now.account, username },
      site,
      sync: "saved",
      baseUpdatedAt: row.updated_at,
      revision: this.revision,
      conflicts: this.conflicts,
    });
  }

  async signIns(): Promise<LoginEvent[]> {
    const { data } = await this.client()
      .from("sign_ins")
      .select("id, at, result, ip, country, city, device, device_id, signature")
      .order("at", { ascending: false })
      .limit(50);
    return (data ?? []).map(toLoginEvent);
  }

  async exportData(): Promise<string> {
    await this.settleSaves();
    if (this.snapshot.status !== "signedIn") return "{}";
    const { account, site } = this.snapshot;
    const supabase = this.client();
    const [signIns, subscription, invoices, program, requests] = await Promise.all([
      this.signIns(),
      supabase.from("subscriptions").select("plan, status, started_at, renews_at, trial_ends_at, canceled_at").maybeSingle(),
      supabase.from("invoices").select("id, at, amount_cents, status").order("at", { ascending: false }),
      supabase.rpc("my_referrals"),
      supabase.rpc("my_verification_requests"),
    ]);
    // The invite program: the people this account invited appear without names (other people's data).
    const overview = fromJson<ReferralOverview | null>(program.data ?? null);
    const referrals = overview
      ? {
          code: overview.code,
          counted: overview.counted,
          rewards: overview.rewards,
          verifications: requests.data ?? [],
          invitedBy: overview.invitedBy,
          invited: overview.invited.map(({ status, at }) => ({ status, at })),
        }
      : null;
    // Everything kept about the account (GDPR Art. 15 and 20).
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), account, site, signIns, subscription: subscription.data, invoices: invoices.data ?? [], referrals },
      null,
      2,
    );
  }

  async deleteAccount(): Promise<Result> {
    await this.settleSaves();
    const supabase = this.client();
    const token = (await supabase.auth.getSession()).data.session?.access_token ?? this.token;
    if (!token) return { ok: false, error: "serverError" };
    // Our server deletes the account as the user, then removes every file of it from Storage (GDPR Art. 17).
    try {
      const response = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return { ok: false, error: "serverError" };
    } catch {
      return { ok: false, error: "serverError" };
    }
    await supabase.auth.signOut({ scope: "local" });
    return { ok: true };
  }

  // ── Invite program (ADR 0064): database functions only; customers never read the tables ─────

  async referrals(): Promise<ReferralOverview | null> {
    if (this.snapshot.status !== "signedIn") return null;
    const { data, error } = await this.client().rpc("my_referrals");
    // A failed load is an error on screen (with "Try again"), not an empty program.
    if (error) throw new Error(error.message);
    return fromJson<ReferralOverview | null>(data);
  }

  async requestVerification(input: { links: string[]; note?: string | undefined }): Promise<VerificationResult> {
    const { data, error } = await this.client().rpc("request_verification", { links: input.links, ...(input.note ? { note: input.note } : {}) });
    if (error) return { ok: false, error: "serverError" };
    return data === "ok" ? { ok: true } : { ok: false, error: verificationError(data) };
  }

  async referralInviter(code: string): Promise<{ name: string | null } | null> {
    // Works signed out (the sign-up page): the function answers visitors with the public page name only.
    const { data, error } = await this.client().rpc("referral_inviter", { code });
    if (error || !data) return null;
    const { name } = fromJson<{ name?: unknown }>(data);
    return { name: typeof name === "string" && name ? name : null };
  }
}
