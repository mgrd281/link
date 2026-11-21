"use client";

import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import type { ReferralOverview, VerificationResult } from "@/features/referrals/types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { fromJson, toJson } from "@/lib/supabase/json";

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
    this.set({ status: "signedIn", account, site: fromRow(row), sync: "saved" });
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
      signUp: input.signUp ? { username: input.signUp.username, invite: input.signUp.invite, start: input.signUp.start } : undefined,
    };
  }

  async requestCode(input: CodeRequest): Promise<Result> {
    return this.adopt(await this.post("/api/auth/code", SupabaseAccountStore.codeBody(input)));
  }

  async verifyCode(input: CodeRequest & { code: string }): Promise<Result> {
    return this.adopt(await this.post("/api/auth/verify", { ...SupabaseAccountStore.codeBody(input), code: input.code }));
  }

  logOut(): void {
    void this.flush().finally(() => void this.client().auth.signOut({ scope: "local" }));
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
    this.set({ ...this.snapshot, site: { ...next, updatedAt: new Date().toISOString() }, sync: "saving" });
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
   * completes even after the tab is gone (a normal request would be cancelled with the page).
   */
  private saveOnExit() {
    const snapshot = this.snapshot;
    if (!this.dirty || snapshot.status !== "signedIn" || !this.token) return;
    const body = JSON.stringify(toRow(snapshot.site));
    if (body.length > KEEPALIVE_LIMIT) {
      void this.flush();
      return;
    }
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.dirty = false;
    void fetch(`${SUPABASE_URL}/rest/v1/sites?profile_id=eq.${snapshot.account.id}`, {
      method: "PATCH",
      keepalive: true,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body,
    }).catch(() => {
      this.dirty = true;
    });
  }

  /** Saves now if something is pending (before signing out, deleting, or when the tab hides). */
  private async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.saving) await this.saving;
    if (this.dirty) await this.save();
  }

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
    const run = async () => {
      const { data, error } = await this.client()
        .from("sites")
        .update(toRow(snapshot.site))
        .eq("profile_id", snapshot.account.id)
        .select("page, updated_at")
        .single();
      const now = this.snapshot;
      if (now.status !== "signedIn" || now.account.id !== snapshot.account.id) return;
      if (error) {
        this.dirty = true;
        const delay = RETRY_DELAYS[Math.min(this.retries, RETRY_DELAYS.length - 1)] ?? 30_000;
        this.retries += 1;
        this.set({ ...now, sync: "error" });
        this.schedule(delay);
        return;
      }
      this.retries = 0;
      // The server owns the badge and the address on the page (sites_guard); keep its word.
      const saved = fromJson<Page>(data.page).profile;
      const profile = { ...now.site.page.profile, verified: saved.verified, username: saved.username };
      this.set({ ...now, site: { ...now.site, page: { ...now.site.page, profile } }, sync: this.dirty ? "saving" : "saved" });
    };
    this.saving = run().finally(() => {
      this.saving = null;
    });
    await this.saving;
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
    await this.flush();
    if (this.snapshot.status !== "signedIn") return "{}";
    const { account, site } = this.snapshot;
    const supabase = this.client();
    const [signIns, subscription, invoices] = await Promise.all([
      this.signIns(),
      supabase.from("subscriptions").select("plan, status, started_at, renews_at, trial_ends_at, canceled_at").maybeSingle(),
      supabase.from("invoices").select("id, at, amount_cents, status").order("at", { ascending: false }),
    ]);
    // Everything kept about the account (GDPR Art. 15 and 20).
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), account, site, signIns, subscription: subscription.data, invoices: invoices.data ?? [] },
      null,
      2,
    );
  }

  async deleteAccount(): Promise<Result> {
    await this.flush();
    const supabase = this.client();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return { ok: false, error: "serverError" };
    await supabase.auth.signOut({ scope: "local" });
    return { ok: true };
  }

  // Invite program: placeholders until its database functions exist (an empty program, nothing to ask).
  referrals(): Promise<ReferralOverview | null> {
    if (this.snapshot.status !== "signedIn") return Promise.resolve(null);
    return Promise.resolve({ code: "22222222", counted: 0, rewards: {}, verification: null, invited: [], invitedBy: null });
  }

  requestVerification(): Promise<VerificationResult> {
    return Promise.resolve({ ok: false, error: "unavailable" });
  }

  referralInviter(): Promise<{ name: string | null } | null> {
    return Promise.resolve(null);
  }
}
