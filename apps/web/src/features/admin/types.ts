import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

/**
 * The team area. Roles map to permissions in one place, so the UI and the database's team functions
 * and row-level security policies enforce exactly the same rules.
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
  "customers.view",
  "customers.export",
  "customers.manage",
  "customers.delete",
  "orders.view",
  "billing.view",
  "billing.manage",
  "security.view",
  "security.manage",
  "analytics.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Owners can do everything; admins everything but the team itself and deleting customers. Editors
 * build pages and work on page-service orders without seeing customers (no e-mail addresses);
 * viewers read everything but export nothing. Mirrored in `public.role_permissions`
 * (supabase/migrations/…_team.sql and …_admin_money.sql; the pgTAP matrix compares the counts).
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS.filter((permission) => permission !== "team.manage" && permission !== "customers.delete"),
  editor: ["pages.create", "pages.edit", "activity.view", "orders.view", "analytics.view"],
  viewer: ["activity.view", "customers.view", "orders.view", "billing.view", "security.view", "analytics.view"],
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
  action:
    | "team.setup"
    | "member.add"
    | "member.role"
    | "member.remove"
    | "page.create"
    | "page.copy"
    | "page.edit"
    | "page.verify"
    | "page.unverify"
    | "page.ready"
    | "page.draft"
    | "page.export"
    | "page.delete"
    | "page.language"
    | "invite.add"
    | "invite.remove"
    | "customer.plan"
    | "customer.trial"
    | "customer.cancel"
    | "customer.resume"
    | "customer.refund"
    | "customer.suspend"
    | "customer.unsuspend"
    | "customer.verify"
    | "customer.unverify"
    | "customer.signout"
    | "customer.note"
    | "customer.delete"
    | "ip.block"
    | "ip.unblock"
    // The invite program (ADR 0064): the database writes the same names on real accounts.
    | "referral.release"
    | "referral.revoke"
    | "referral.restore"
    | "reward.verification"
    | "reward.pro"
    | "reward.revoke"
    | "reward.restore"
    | "verification.request"
    | "verification.approve"
    | "verification.decline"
    // Orders, contracts and the AI switch (v7, ADR 0065/0066): written only by the database.
    | "order.assign"
    | "order.proposal"
    | "order.deliver"
    | "order.refund"
    | "withdrawal.accepted"
    | "withdrawal.rejected"
    | "withdrawal.handled"
    | "cancellation.scheduled"
    | "cancellation.ended"
    | "cancellation.rejected"
    | "cancellation.resumed"
    | "cancellation.handled"
    | "ai.enabled"
    | "ai.disabled";
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
