import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

/**
 * The account contract the whole app talks to. Today it is backed by the browser (demo mode,
 * `local-store.ts`); in Phase 1 a Supabase implementation (Auth + Postgres, EU region) replaces it
 * without touching a single screen: same methods, same snapshot shape.
 */

export interface Account {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

/** Legal notice (DE: § 5 DDG "Impressum"), linked from the page footer. */
export interface Legal {
  name: string;
  address: string;
  email: string;
  phone: string;
}

/** Everything a creator owns besides the login: the page, its look and settings. */
export interface Site {
  page: Page;
  theme: CreatorThemeConfig;
  legal: Legal;
  /** Finished (or skipped) the welcome flow. */
  onboarded: boolean;
  /** What the page is for (TikTok, shop, writer …), chosen in the welcome flow; picks templates and tips. */
  kind?: string | undefined;
  /** Set when the Linkyo team prepared this page before sign-up; `seen` once the welcome is dismissed. */
  prepared?: { at: string; seen?: boolean } | undefined;
  updatedAt: string;
}

export interface DeviceInfo {
  type: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
}

/**
 * One sign-in (or failed attempt) to an account, kept 30 days for account security only: the
 * owner sees it under Settings, the team uses it against account takeover and abuse.
 */
export interface LoginEvent {
  id: string;
  at: string;
  /** The full address, dropped after 30 days. */
  ip: string;
  country?: string | undefined;
  city?: string | undefined;
  device: DeviceInfo;
  /** A random id this browser keeps for the site (not a fingerprint): "known device" checks. */
  deviceId: string;
  /** Hash of browser, system, language, time zone and screen: tells devices apart when the id is gone. */
  signature?: string | undefined;
  /** Real accounts, team view: the session this sign-in opened is still open (device signed in). */
  active?: boolean | undefined;
  result: "success" | "failed";
}

/** Where a sign-in comes from, filled in by the browser and the server (IP, rough location). */
export type LoginContext = Omit<LoginEvent, "id" | "at" | "result">;

export type AccountSnapshot =
  | { status: "loading" }
  | { status: "signedOut" }
  | {
      status: "signedIn";
      account: Account;
      site: Site;
      /** Real accounts: whether the last change reached the server ("error": it will retry). */
      sync?: "saving" | "saved" | "error" | undefined;
    };

export type AuthError =
  | "invalidEmail"
  | "invalidUsername"
  | "reservedUsername"
  | "usernameTaken"
  | "emailTaken"
  /** The 6-digit code does not match the one we sent. */
  | "invalidCode"
  /** The code is older than 10 minutes, was used, or was guessed wrong too often: ask for a new one. */
  | "codeExpired"
  | "notFound"
  | "storageFull"
  | "unavailable"
  | "inviteMismatch"
  | "reservedForCreator"
  /** Real accounts: the team suspended the account. */
  | "suspended"
  /** Too many codes or wrong codes in a short time (guessing), or emails sent too quickly. */
  | "tooManyAttempts"
  /** Real accounts: sign-ins from this address are blocked. */
  | "blocked"
  /** Real accounts: the server could not be reached or answered with an error. */
  | "serverError"
  /** Real accounts: a link from one of our emails expired or was used already. */
  | "linkExpired";

/**
 * `pending: "confirmEmail"`: done, but it counts only after the link we emailed is opened.
 * `pending: "code"`: a 6-digit code is on its way (the demo, which sends no email, returns it as
 * `demoCode` so it can be shown on screen).
 */
export type Result =
  | { ok: true; pending?: "confirmEmail" | "code" | undefined; demoCode?: string | undefined }
  | { ok: false; error: AuthError };

export type UsernameStatus = "ok" | Extract<AuthError, "invalidUsername" | "reservedUsername" | "usernameTaken">;

/** A new account's page: the address they chose and how it starts. */
export interface SignUpInput {
  username: string;
  /** A page the Linkyo team prepared for this email: the account starts with it, ready. */
  prepared?: { page: Page; theme: CreatorThemeConfig } | undefined;
  /** The invite from a prepared page's link (real accounts: the server looks the page up again). */
  invite?: string | undefined;
  /**
   * Came from an example page (e.g. for journalists) or the homepage playground: start with that
   * kind and look, and the name typed there.
   */
  start?: { kind: string; theme: CreatorThemeConfig; displayName?: string | undefined } | undefined;
}

/**
 * Signing in without a password: an email gets a 6-digit code (and a one-click link). Someone new
 * also sends `signUp` with the page they want; someone coming back sends only the email.
 */
export interface CodeRequest {
  email: string;
  locale: Page["profile"]["locale"];
  signUp?: SignUpInput | undefined;
}

export interface AccountStore {
  /** `true` when data lives only in this browser (shown to the user everywhere it matters). */
  readonly demo: boolean;
  subscribe(listener: () => void): () => void;
  getSnapshot(): AccountSnapshot;
  getServerSnapshot(): AccountSnapshot;

  /**
   * Sends a 6-digit code (valid 10 minutes) to the email. The answer is the same whether or not the
   * address has an account (no account enumeration); a sign-up checks the page address first.
   */
  requestCode(input: CodeRequest): Promise<Result>;
  /** Signs in with the code. Someone new gets their account and first page here. */
  verifyCode(input: CodeRequest & { code: string }): Promise<Result>;
  logOut(): void;
  /** Real accounts confirm the new address by email first (`pending: "confirmEmail"`). */
  changeEmail(email: string): Promise<Result>;
  changeUsername(username: string): Promise<Result>;
  usernameStatus(username: string): Promise<UsernameStatus>;

  /** Applies at once; real accounts save in the background (see `syncState`). */
  updateSite(update: (site: Site) => Site): Result;
  /** The account's sign-ins and failed attempts of the last 30 days, newest first. */
  signIns(): Promise<LoginEvent[]>;
  exportData(): Promise<string>;
  deleteAccount(): Promise<Result>;
}
