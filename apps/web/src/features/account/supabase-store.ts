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

/** After this many refused saves in a row that each turned out to be this tab's own, the next one counts as a conflict. */
const MAX_REBASES = 3;

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
   * The save guard (ADR draft-app-sync): the row's `updated_at` as it was read or last saved here. A
   * save writes only while the row still has it, so a stale copy never overwrites a newer page.
   */
  private base: string | null = null;
  /** What the page held at `base`: a refused save that finds it (or a write whose answer never came) was this tab's own. */
  private baseContent: SiteContent | null = null;
  private unconfirmed: SiteContent[] = [];
  private rebases = 0;
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
    // Save what is pending when the tab goes away (closing, reloading, switching apps on a phone).
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.saveOnExit();
    });
    window.addEventListener("pagehide", () => this.saveOnExit());
  }

  private async load(session: Session): Promise<void> {
    const supabase = this.client();
    const id = session.user.id;
    this.loadedFor = id;
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
    void this.drainSaves().finally(() => void this.client().auth.signOut({ scope: "local" }));
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
    }
    return { ok: true };
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
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, delay);
  }

  /**
   * The page is going away: send what is pending as a `keepalive` request, which the browser
   * completes even after the tab is gone (a normal request would be cancelled with the page). It
   * carries the save guard like every save; when the tab comes back, its answer is the new version.
   */
  private saveOnExit() {
    const snapshot = this.snapshot;
    if (!this.dirty || snapshot.status !== "signedIn" || !this.token) return;
    const content = toRow(snapshot.site);
    const body = JSON.stringify(content);
    // A save on its way holds the version this one builds on, so this one follows it (a hidden tab
    // still runs its script); a page too large for keepalive saves the normal way.
    if (body.length > KEEPALIVE_LIMIT || this.saving) {
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
    const guard = base === null ? "" : `&updated_at=eq.${encodeURIComponent(base)}`;
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
          // Turned down (an expired session, the size limit): nothing was written, the next save tries again.
          this.dirty = true;
          return;
        }
        const [row] = (await response.json()) as { updated_at?: string }[];
        if (row?.updated_at) this.saved(id, row.updated_at, content);
        else await this.refused(id, base);
      })
      .catch(() => {
        this.unconfirm(content);
        this.dirty = true;
      });
    this.saving = request.finally(() => {
      this.saving = null;
    });
  }

  /** Saves now if something is pending (before signing out, deleting, or when the tab hides). */
  private async drainSaves(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.saving) await this.saving;
    if (this.dirty) await this.save();
  }

  /**
   * For the iPhone app before it changes the page itself (`window.linkyoApp.flush`): everything
   * waiting is saved, then the version on the server is answered. A refused save that was this tab's
   * own is sent again here, and so is a change made while a save was on its way.
   */
  flush = async (): Promise<{ updatedAt: string | null }> => {
    for (let round = 0; round <= MAX_REBASES; round += 1) {
      await this.drainSaves();
      if (!this.dirty || this.failed) break;
    }
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
    // A change made while the row was read is saved against the guard, which meets the newer version itself.
    if (this.dirty || this.saving || this.snapshot !== snapshot || row.updated_at === this.base) return;
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
      const { data, error } = await (base === null ? update : update.eq("updated_at", base)).select("page, updated_at").maybeSingle();
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
        this.unconfirm(content);
        this.retry(now);
        return;
      }
      if (!data) {
        await this.refused(id, base);
        return;
      }
      this.confirm(data.updated_at, content);
      // The server owns the badge and the address on the page (sites_guard); keep its word. Pictures
      // that went to Storage keep their new address here too.
      const saved = fromJson<Page>(data.page).profile;
      const page = this.uploaded.size > 0 ? replaceSources(now.site.page, this.uploaded) : now.site.page;
      const profile = { ...page.profile, verified: saved.verified, username: saved.username };
      const { syncError: _resolved, ...rest } = now;
      this.set({ ...rest, site: { ...now.site, page: { ...page, profile } }, sync: this.dirty ? "saving" : "saved", baseUpdatedAt: data.updated_at });
    };
    this.saving = run().finally(() => {
      this.saving = null;
    });
    await this.saving;
  }

  /** A failed save is tried again, each time a little later (the next change tries at once). */
  private retry(now: Extract<AccountSnapshot, { status: "signedIn" }>) {
    const delay = RETRY_DELAYS[Math.min(this.retries, RETRY_DELAYS.length - 1)] ?? 30_000;
    this.retries += 1;
    this.set({ ...now, sync: "error" });
    this.schedule(delay);
  }

  /** The server took a write: its version is the one the next save builds on. */
  private confirm(updatedAt: string, content: SiteContent) {
    this.base = updatedAt;
    this.baseContent = content;
    this.unconfirmed = [];
    this.retries = 0;
    this.rebases = 0;
    this.failed = false;
  }

  /** The keepalive save's answer came while the tab was still there. */
  private saved(id: string, updatedAt: string, content: SiteContent) {
    const now = this.snapshot;
    if (now.status !== "signedIn" || now.account.id !== id) return;
    this.confirm(updatedAt, content);
    this.set({ ...now, baseUpdatedAt: updatedAt, sync: this.dirty ? "saving" : "saved" });
  }

  /** A write whose answer never came: the server may hold it, so a later refusal can recognise it as this tab's own. */
  private unconfirm(content: SiteContent) {
    this.unconfirmed = [...this.unconfirmed, content].slice(-MAX_REBASES);
  }

  /**
   * A save the guard turned down: the row is no longer the version this tab built on. It is read
   * again to decide (ADR draft-app-sync):
   * - still the same version: the database refused the write (a suspended account), retried like a failed save;
   * - what this tab read or sent itself, apart from what the server owns (the badge, the address): it
   *   builds on the newer version and sends what is waiting again;
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
    const own = [this.baseContent, ...this.unconfirmed].some((content) => content !== null && contentKey(content) === key);
    if (own && this.rebases < MAX_REBASES) {
      this.rebases += 1;
      this.base = row.updated_at;
      this.baseContent = latest;
      this.unconfirmed = [];
      this.dirty = this.dirty || contentKey(toRow(now.site)) !== key;
      this.set({ ...now, baseUpdatedAt: row.updated_at, sync: this.dirty ? "saving" : "saved" });
      if (this.dirty) this.schedule(0);
      return;
    }
    this.replace(row, true);
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
    this.unconfirmed = [];
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
    await this.drainSaves();
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
    await this.drainSaves();
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
