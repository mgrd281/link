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
  | "weakPassword"
  | "invalidUsername"
  | "reservedUsername"
  | "usernameTaken"
  | "emailTaken"
  | "invalidCredentials"
  | "wrongPassword"
  | "notFound"
  | "storageFull"
  | "unavailable"
  | "inviteMismatch"
  | "reservedForCreator"
  /** Real accounts: the sign-up link in the email was not opened yet. */
  | "emailNotConfirmed"
  /** Real accounts: the team suspended the account. */
  | "suspended"
  /** Real accounts: too many failed attempts in a short time (password guessing). */
  | "tooManyAttempts"
  /** Real accounts: sign-ins from this address are blocked. */
  | "blocked"
  /** Real accounts: the server could not be reached or answered with an error. */
  | "serverError"
  /** Real accounts: a link from one of our emails expired or was used already. */
  | "linkExpired";

/** `pending: "confirmEmail"`: done, but it counts only after the link we emailed is opened. */
export type Result = { ok: true; pending?: "confirmEmail" | undefined } | { ok: false; error: AuthError };

export type UsernameStatus = "ok" | Extract<AuthError, "invalidUsername" | "reservedUsername" | "usernameTaken">;

export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  locale: Page["profile"]["locale"];
  /** A page the Linkyo team prepared for this email: the account starts with it, ready. */
  prepared?: { page: Page; theme: CreatorThemeConfig } | undefined;
  /** Came from an example page (e.g. for journalists): start with that kind and its template. */
  start?: { kind: string; theme: CreatorThemeConfig } | undefined;
}

export interface AccountStore {
  /** `true` when data lives only in this browser (shown to the user everywhere it matters). */
  readonly demo: boolean;
  /** A forgotten password: set a new one right here (demo, no email possible) or by emailed link. */
  readonly passwordReset: "direct" | "email";
  subscribe(listener: () => void): () => void;
  getSnapshot(): AccountSnapshot;
  getServerSnapshot(): AccountSnapshot;

  signUp(input: SignUpInput): Promise<Result>;
  logIn(input: { email: string; password: string }): Promise<Result>;
  logOut(): void;
  /** Demo: sets `password` directly (no email can be sent). Real: emails a reset link. */
  resetPassword(input: { email: string; password?: string | undefined }): Promise<Result>;
  /** After opening a reset link (real accounts): the new password for the signed-in account. */
  setNewPassword(password: string): Promise<Result>;
  changePassword(input: { current: string; next: string }): Promise<Result>;
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
