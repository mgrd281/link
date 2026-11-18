import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

/**
 * The team area. Roles map to permissions in one place, so the UI (and, in Phase 1, the database's
 * row-level security policies) enforce exactly the same rules.
 */
export const ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "pages.create",
  "pages.edit",
  "pages.publish",
  "pages.delete",
  "creators.verify",
  "invites.manage",
  "team.manage",
  "activity.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: ["pages.create", "pages.edit", "pages.publish", "pages.delete", "creators.verify", "invites.manage", "activity.view"],
  editor: ["pages.create", "pages.edit", "activity.view"],
  viewer: ["activity.view"],
};

export const can = (role: Role | null, permission: Permission) => role !== null && ROLE_PERMISSIONS[role].includes(permission);

export interface Member {
  email: string;
  name: string;
  role: Role;
  addedAt: string;
}

export type Locale = "de" | "en" | "ar";

/** A page the team prepares for a creator, before it is published for them to claim. */
export interface PreparedDraft {
  slug: string;
  /** Who it is for, per language (the list and the preview label). */
  name: Partial<Record<Locale, string>>;
  username: string;
  /** One page per language; the creator gets the one for the language they sign up in. */
  pages: Partial<Record<Locale, Page>>;
  theme: CreatorThemeConfig;
  /** The emails the creator gave the team (kept in the team area; published only as SHA-256). */
  invites: string[];
  /** A copy of a published page: how many invites it already has (they stay valid on publish). */
  publishedInvites?: number | undefined;
  /** Verified by the team: the badge stays when the creator takes the page over. */
  verified: boolean;
  status: "draft" | "ready";
  createdBy: string;
  updatedAt: string;
}

export const LOCALES: readonly Locale[] = ["de", "en", "ar"];

/** The name to show for a draft or published page: the current language first, then any. */
export const nameIn = (name: Partial<Record<Locale, string>>, locale: string) => name[locale as Locale] ?? Object.values(name).find(Boolean) ?? "";

export interface ActivityEvent {
  id: string;
  at: string;
  actor: string;
  action: "team.setup" | "member.add" | "member.role" | "member.remove" | "page.create" | "page.copy" | "page.edit" | "page.verify" | "page.unverify" | "page.ready" | "page.draft" | "page.export" | "page.delete" | "page.language" | "invite.add" | "invite.remove";
  target: string;
}

export interface AdminDb {
  version: 1;
  /** Proof the team code was entered (from /api/admin/verify; never the code itself). */
  token?: string | undefined;
  members: Member[];
  drafts: Record<string, PreparedDraft>;
  activity: ActivityEvent[];
}
