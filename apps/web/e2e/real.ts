import { randomInt, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Page as BlocksPage } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { test as base, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";
import { toJson } from "../src/lib/supabase/json";

/**
 * Helpers for real-mode specs (tests tagged `@real`): a build with Supabase settings, the local stack
 * (`pnpm db:start`), the local mocks (`E2E_MOCKS=1`) and the variables of plan §0.5. Every `@real` spec
 * imports `test` from here, not from `@playwright/test`:
 *
 * - each test's browser sends its own `x-forwarded-for` to the app (`requestPlace` reads it), so the
 *   per-address limits (AI runs, contract forms) count per test, and parallel tests never share one;
 * - `tag` is a unique id for the mock Messages API (`[[fixture:<name>#<tag>]]`, `mockCalls(tag)`).
 */

/** Real-mode specs run only with E2E_SUPABASE=1 (the regular suite covers demo mode). */
export const realEnabled = process.env.E2E_SUPABASE === "1";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const MOCK_ANTHROPIC_PORT = process.env.MOCK_ANTHROPIC_PORT ?? "54399";

/** The service client (bypasses row-level security): seeding and checks only, never from the app. */
export function service() {
  return createClient<Database>(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
}

// One random third octet per worker process, the worker in the second and a counter in the fourth:
// unique within a run, and unlikely to repeat an address from an earlier run the same day.
const third = randomInt(0, 256);
let counter = 0;

function nextAddress(worker: number): string {
  counter += 1;
  return `10.${worker % 256}.${(third + Math.floor(counter / 250)) % 256}.${(counter % 250) + 1}`;
}

export const test = base.extend<{ ip: string; tag: string }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures take their dependencies as the first argument
  ip: async ({}, use, testInfo) => {
    await use(nextAddress(testInfo.workerIndex));
  },
  // eslint-disable-next-line no-empty-pattern -- see above
  tag: async ({}, use) => {
    await use(randomUUID().replaceAll("-", "").slice(0, 16));
  },
  // Only requests to the app carry the address (requests to the Supabase host stay untouched, so no
  // extra header triggers a CORS preflight there).
  context: async ({ context, ip, baseURL }, use) => {
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    await context.route(
      (url) => url.origin === origin,
      (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }),
    );
    await use(context);
  },
});

export { expect } from "@playwright/test";

export interface RealAccount {
  id: string;
  email: string;
  username: string;
}

/** A unique address and username for one test ("<prefix>-<random>"). */
export function uniqueName(prefix = "real"): { username: string; email: string } {
  const username = `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  return { username, email: `${username}@example.com` };
}

/** A starter page for seeding: a name, an empty photo and the given blocks. */
export function seedPage(username: string, locale: "de" | "en" | "ar", overrides: Partial<BlocksPage["profile"]> = {}, blocks: BlocksPage["blocks"] = []): BlocksPage {
  return {
    profile: { username, displayName: "Real Creator", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale, ...overrides },
    blocks,
  };
}

/**
 * A confirmed account with its page, made directly in the database (no e-mail round trip): the auth
 * user (the trigger makes the profile from `user_metadata`) and its `sites` row.
 */
export async function createRealAccount(input: {
  email: string;
  username: string;
  locale: "de" | "en" | "ar";
  onboarded: boolean;
  page?: BlocksPage | undefined;
  theme?: CreatorThemeConfig | undefined;
  legal?: { name: string; address: string; email: string; phone: string } | undefined;
}): Promise<RealAccount> {
  const db = service();
  const { data, error } = await db.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { username: input.username, locale: input.locale },
  });
  if (error) throw new Error(`createUser ${input.email}: ${error.message}`);
  const id = data.user.id;
  const page = input.page ?? seedPage(input.username, input.locale);
  const { error: siteError } = await db.from("sites").upsert({
    profile_id: id,
    onboarded: input.onboarded,
    page: toJson(page),
    theme: toJson(input.theme ?? { template: "nocturne" }),
    legal: toJson(input.legal ?? { name: "", address: "", email: input.email, phone: "" }),
  });
  if (siteError) throw new Error(`sites ${input.username}: ${siteError.message}`);
  return { id, email: input.email, username: input.username };
}

/**
 * Puts a picture in an account's folder of a Storage bucket (service client) and answers its path;
 * for `media`, also its public address.
 */
export async function seedMedia(
  profileId: string,
  { bucket = "media", folder = "2026", file = "src/assets/samples/mila-avatar.jpg" }: { bucket?: "media" | "briefing" | "deliverables"; folder?: string; file?: string } = {},
): Promise<{ path: string; url: string }> {
  const path = `${profileId}/${folder}/${randomUUID()}.jpg`;
  const { error } = await service().storage.from(bucket).upload(path, await readFile(file), { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`seedMedia ${bucket}/${path}: ${error.message}`);
  return { path, url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` };
}

/** Pro for tests that need more than one AI draft: a team-granted entitlement. */
export async function grantPro(profileId: string): Promise<void> {
  const { error } = await service().from("entitlements").insert({ profile_id: profileId, product: "pro", source: "team", status: "active" });
  if (error) throw new Error(`grantPro: ${error.message}`);
}

/** Makes an existing account a team member with this role. */
export async function addTeamMember(email: string, role: Database["public"]["Enums"]["team_role"]): Promise<string> {
  const db = service();
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`addTeamMember: no account ${email}`);
  const { error: memberError } = await db.from("team_members").upsert({ user_id: user.id, role });
  if (memberError) throw new Error(`addTeamMember: ${memberError.message}`);
  return user.id;
}

/**
 * Signs the browser in without an e-mail: a magic-link token from the admin API, opened on our own
 * confirm route, which puts the session in first-party cookies and continues to `next`.
 */
export async function signIn(page: Page, email: string, next: string): Promise<void> {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink ${email}: ${error.message}`);
  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "magiclink", next });
  await page.goto(`/api/auth/confirm?${params.toString()}`);
}

/** How many calls the mock Messages API got for this tag. */
export async function mockCalls(tag: string): Promise<number> {
  const response = await fetch(`http://127.0.0.1:${MOCK_ANTHROPIC_PORT}/__calls?tag=${encodeURIComponent(tag)}`);
  const { count } = (await response.json()) as { count: number };
  return count;
}

export interface CapturedMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  locale: "de" | "en" | "ar";
  tag: string;
  file: string;
}

/** E-mails the capture sender wrote (EMAIL_CAPTURE_DIR), oldest first, filtered by recipient and tag. */
export async function readCapturedMail({ to, tag }: { to?: string | undefined; tag?: string | undefined } = {}): Promise<CapturedMail[]> {
  const dir = process.env.EMAIL_CAPTURE_DIR ?? join(process.cwd(), ".mail");
  const files = await readdir(dir).catch(() => [] as string[]);
  const mails = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(async (file) => ({ ...(JSON.parse(await readFile(join(dir, file), "utf8")) as Omit<CapturedMail, "file">), file })),
  );
  return mails.filter((mail) => (to === undefined || mail.to.toLowerCase() === to.toLowerCase()) && (tag === undefined || mail.tag === tag));
}

/** The AI kill switch (only `@global` tests call it, and they restore it in afterAll). */
export async function setAiEnabled(on: boolean): Promise<void> {
  const { error } = await service().from("ai_settings").update({ enabled: on }).eq("id", true);
  if (error) throw new Error(`setAiEnabled: ${error.message}`);
}
