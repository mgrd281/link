import { createHash } from "node:crypto";

import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { PREVIEWS } from "./registry";

export const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

export type ClaimResult =
  | { kind: "match"; slug: string; username: string; theme: CreatorThemeConfig; page: Page }
  /** The address belongs to a page prepared for someone else. */
  | { kind: "reserved" }
  /** An invite link was used with an email that is not the invited one. */
  | { kind: "mismatch" }
  | { kind: "none" };

/**
 * A creator takes over the real page. "Live now" never carries over (it is a moment, not content);
 * a preview's example states (planned live, the verified look) are removed; the badge stays only
 * when the team verified the creator.
 */
export function forClaim(page: Page, options: { examples?: boolean | undefined; verified?: boolean | undefined } = {}): Page {
  return {
    profile: { ...page.profile, verified: options.verified === true },
    blocks: page.blocks.map((block) => (block.type === "live" ? { ...block, isLive: false, ...(options.examples ? { startsAt: undefined } : {}) } : block)),
  };
}

/**
 * Decides what a new account gets. Runs on the server only: the invite list (hashed emails) never
 * reaches the browser. In Phase 1 this runs after Supabase Auth has verified the email (Google or a
 * magic link), so only the real owner of the address can take the page over.
 */
export function findPrepared(input: { email: string; username: string; invite?: string | undefined; locale: string }): ClaimResult {
  const hash = emailHash(input.email);
  const entries = Object.entries(PREVIEWS);
  if (input.invite) {
    const invited = PREVIEWS[input.invite];
    if (invited && !(invited.invite?.emailSha256.includes(hash) ?? false)) return { kind: "mismatch" };
  }
  const found = entries.find(([, preview]) => preview.invite?.emailSha256.includes(hash));
  if (found) {
    const [slug, preview] = found;
    const page = preview.pages[input.locale as "de" | "en" | "ar"] ?? Object.values(preview.pages)[0];
    if (page) return { kind: "match", slug, username: preview.username, theme: preview.theme, page: forClaim({ ...page, profile: { ...page.profile, username: preview.username } }, { examples: preview.examples, verified: preview.verified }) };
  }
  const username = input.username.trim().toLowerCase();
  if (entries.some(([, preview]) => preview.invite && preview.username === username)) return { kind: "reserved" };
  return { kind: "none" };
}
