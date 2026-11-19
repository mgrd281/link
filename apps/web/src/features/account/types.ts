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
  | { status: "signedIn"; account: Account; site: Site };

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
  | "reservedForCreator";

export type Result = { ok: true } | { ok: false; error: AuthError };

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
  subscribe(listener: () => void): () => void;
  getSnapshot(): AccountSnapshot;
  getServerSnapshot(): AccountSnapshot;

  signUp(input: SignUpInput): Promise<Result>;
  logIn(input: { email: string; password: string }): Promise<Result>;
  logOut(): void;
  /** Demo: sets the new password directly (no email can be sent). Real: sends a reset link. */
  resetPassword(input: { email: string; password: string }): Promise<Result>;
  changePassword(input: { current: string; next: string }): Promise<Result>;
  changeEmail(email: string): Result;
  changeUsername(username: string): Result;
  usernameStatus(username: string): "ok" | Extract<AuthError, "invalidUsername" | "reservedUsername" | "usernameTaken">;

  updateSite(update: (site: Site) => Site): Result;
  /** The account's sign-ins and failed attempts of the last 30 days, newest first. */
  signIns(): LoginEvent[];
  exportData(): string;
  deleteAccount(): void;
}
