import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { findPrepared } from "@/features/previews/claim";
import { fromJson, toJson } from "@/lib/supabase/json";
import type { Db } from "@/lib/supabase/server";

import { firstSite } from "../site-builders";

/** How a new page starts (an example's kind and look); sent at sign-up, kept in the user's metadata. */
export const startSchema = z.object({ kind: z.string().max(40), theme: z.record(z.string(), z.unknown()), displayName: z.string().max(60).optional() });

/**
 * A new account's first page, made once, right after its first sign-in (code or emailed link):
 * the page the team prepared for this email if there is one, else a starter page in the account's
 * language (with the example it came from). Does nothing when the account already has a page.
 */
export async function ensureFirstSite(service: Db, user: User): Promise<void> {
  const { data: existing } = await service.from("sites").select("profile_id").eq("profile_id", user.id).maybeSingle();
  if (existing) return;
  const { data: profile } = await service.from("profiles").select("username, locale").eq("id", user.id).maybeSingle();
  if (!profile) return;
  const meta: Record<string, unknown> = user.user_metadata;
  const email = user.email ?? "";
  const locale = profile.locale === "en" || profile.locale === "ar" ? profile.locale : "de";
  const invite = typeof meta.invite === "string" ? meta.invite : undefined;
  const claim = findPrepared({ email, username: profile.username, invite, locale });
  const start = startSchema.safeParse(meta.start);
  const site = firstSite({
    username: profile.username,
    email,
    locale,
    prepared: claim.kind === "match" ? { page: claim.page, theme: claim.theme } : undefined,
    start: claim.kind !== "match" && start.success ? { kind: start.data.kind, theme: fromJson<CreatorThemeConfig>(toJson(start.data.theme)), displayName: start.data.displayName } : undefined,
  });
  const { error } = await service.from("sites").insert({
    profile_id: user.id,
    kind: site.kind ?? null,
    onboarded: site.onboarded,
    theme: toJson(site.theme),
    page: toJson(site.page),
    legal: toJson(site.legal),
    prepared: site.prepared ? toJson(site.prepared) : null,
  });
  if (error) console.error("first site failed", error.message);
  // The team's verified badge carries over with a prepared page.
  if (claim.kind === "match" && claim.page.profile.verified) await service.from("profiles").update({ verified: true }).eq("id", user.id);
}
