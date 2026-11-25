"use client";

import type { ReferralOverview, VerificationResult } from "@/features/referrals/types";
import { browserSupabase, loadBrowserSupabase } from "@/lib/supabase/browser";

import { browserDevice } from "./login-context";
import type { AccountSnapshot, AccountStore, CodeRequest, LoginEvent, Result, Site, UsernameStatus } from "./types";

const LOADING: AccountSnapshot = { status: "loading" };

/**
 * Real accounts (ADR 0030), loaded when the account is first asked for: the store that talks to
 * Supabase and Supabase's client come in chunks of their own, so a demo build carries neither and a
 * page that never asks for the account loads neither (ADR 0008). Until both are here the account is
 * "loading", exactly as while the first session check runs; then this store hands every call to the
 * real one (`./supabase-store.ts`) and passes its changes on.
 */
export class DeferredAccountStore implements AccountStore {
  readonly demo = false;
  private real: AccountStore | null = null;
  private loading: Promise<AccountStore> | null = null;
  private readonly listeners = new Set<() => void>();

  private load(): Promise<AccountStore> {
    this.loading ??= Promise.all([import("./supabase-store"), loadBrowserSupabase()]).then(([{ SupabaseAccountStore }]) => {
      const real = new SupabaseAccountStore(browserSupabase, browserDevice);
      this.real = real;
      real.subscribe(() => this.notify());
      this.notify();
      return real;
    });
    // A failed load (offline) may be tried again by the next caller.
    this.loading.catch(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  // Arrow properties: React calls these detached.
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (typeof window !== "undefined") void this.load().catch(() => undefined);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AccountSnapshot => this.real?.getSnapshot() ?? LOADING;
  getServerSnapshot = (): AccountSnapshot => LOADING;

  requestCode = async (input: CodeRequest): Promise<Result> => (await this.load()).requestCode(input);
  verifyCode = async (input: CodeRequest & { code: string }): Promise<Result> => (await this.load()).verifyCode(input);
  signInWithPassword = async (input: { email: string; password: string }): Promise<Result> => (await this.load()).signInWithPassword(input);
  logOut = (): void => {
    void this.load().then((real) => real.logOut());
  };
  changeEmail = async (email: string): Promise<Result> => (await this.load()).changeEmail(email);
  changeUsername = async (username: string): Promise<Result> => (await this.load()).changeUsername(username);
  usernameStatus = async (username: string): Promise<UsernameStatus> => (await this.load()).usernameStatus(username);
  // Only a signed-in account changes its page, and there is none before the real store is here.
  updateSite = (update: (site: Site) => Site): Result => (this.real ? this.real.updateSite(update) : { ok: false, error: "notFound" });
  signIns = async (): Promise<LoginEvent[]> => (await this.load()).signIns();
  exportData = async (): Promise<string> => (await this.load()).exportData();
  deleteAccount = async (): Promise<Result> => (await this.load()).deleteAccount();
  referrals = async (): Promise<ReferralOverview | null> => (await this.load()).referrals();
  requestVerification = async (input: { links: string[]; note?: string | undefined }): Promise<VerificationResult> => (await this.load()).requestVerification(input);
  referralInviter = async (code: string): Promise<{ name: string | null } | null> => (await this.load()).referralInviter(code);
}
