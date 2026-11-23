"use client";

import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { accessToken } from "@/lib/supabase/access-token";
import { browserSupabase } from "@/lib/supabase/browser";
import type { Json } from "@/lib/supabase/database.types";
import { signPaths, type PrivateBucket } from "@/lib/supabase/signed";

/**
 * The team console's orders, proposals and contract requests on real data: reads go through the
 * team functions of the billing migration (each checks the caller's permission in SQL); actions that
 * touch Stripe or send e-mail go through our API routes with the member's session.
 */

export type OrderStatus = "paid" | "awaiting_briefing" | "queued" | "in_progress" | "delivered" | "revision_requested" | "completed" | "refunded" | "withdrawn";
export type OrderScope = "open" | "mine" | "delivered" | "all";
export type OrderPackage = "start" | "premium";
type Locale = "de" | "en" | "ar";

const STATUSES: readonly OrderStatus[] = ["paid", "awaiting_briefing", "queued", "in_progress", "delivered", "revision_requested", "completed", "refunded", "withdrawn"];

export interface QueueOrder {
  id: string;
  number: string;
  package: OrderPackage;
  status: OrderStatus;
  withdrawalPending: boolean;
  customer: { id: string | null; username: string | null; email: string };
  orderedAt: string;
  /** The deadline that counts now: a revision's due date, else the ready date. */
  due: string | null;
  assignee: { id: string; label: string } | null;
  revisionsLeft: number;
}

export interface Kit {
  bioInstagram: string;
  bioTiktok: string;
  postingPlan: { week: number; idea: string }[];
}

export interface TeamProposal {
  id: string;
  round: number;
  status: "draft" | "delivered" | "applied" | "superseded";
  page: Page;
  theme: CreatorThemeConfig;
  kind: string | null;
  message: string | null;
  request: string | null;
  extras: Kit | null;
  storyPaths: string[];
  aiAssisted: boolean;
  updatedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderEvent {
  id: number;
  at: string;
  kind: string;
  actor: string | null;
  details: Record<string, unknown>;
}

export interface TeamOrder {
  id: string;
  number: string;
  package: OrderPackage;
  status: OrderStatus;
  locale: Locale;
  amountCents: number;
  earlyStart: boolean;
  withdrawalPending: boolean;
  customer: { id: string | null; username: string | null; email: string; name: string | null };
  orderedAt: string;
  promisedDueAt: string | null;
  dueAt: string | null;
  revisionDueAt: string | null;
  briefing: { links: string[]; photos: string[]; wishes: string; pageLocale: Locale } | null;
  assignee: { id: string; label: string } | null;
  revisionsAllowed: number;
  revisionsUsed: number;
  revisionsLeft: number;
  deliveredAt: string | null;
  refundedAt: string | null;
  events: OrderEvent[];
  proposals: TeamProposal[];
  site: { kind: string | null; page: Page; theme: CreatorThemeConfig } | null;
}

export type ContractRequest =
  | {
      kind: "withdrawal";
      id: string;
      receivedAt: string;
      name: string;
      email: string;
      contract: string;
      matched: boolean;
      suspect: boolean;
      decision: "accepted" | "rejected" | null;
      /** What the team set to refund with its decision (an order's withdrawal). */
      refundCents: number | null;
      /** Set once nothing is left to do: for an accepted withdrawal, when its refund is on record. */
      handledAt: string | null;
      note: string | null;
      refundDueAt: string;
      account: { id: string; username: string | null; email: string | null } | null;
      order: { id: string; number: string; amountCents: number; earlyStart: boolean; status: OrderStatus; withdrawalPending: boolean } | null;
      entitlement: { id: string; subscription: string | null; status: string } | null;
      invoice: { amountCents: number } | null;
    }
  | {
      kind: "cancellation";
      id: string;
      receivedAt: string;
      name: string;
      cancellationKind: "ordinary" | "extraordinary";
      reason: string | null;
      accountEmail: string;
      wantedDate: string | null;
      matched: boolean;
      suspect: boolean;
      decision: "scheduled" | "ended" | "rejected" | "resumed" | null;
      effectiveAt: string | null;
      handledAt: string | null;
      note: string | null;
      account: { id: string; username: string | null; email: string | null } | null;
      entitlement: { id: string; subscription: string | null; status: string; cancelAtPeriodEnd: boolean; cancelAt: string | null } | null;
    };

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const status = (value: unknown): OrderStatus => STATUSES.find((candidate) => candidate === value) ?? "paid";
const pkg = (value: unknown): OrderPackage => (value === "premium" ? "premium" : "start");
const locale = (value: unknown): Locale => (value === "en" || value === "ar" ? value : "de");
const person = (value: unknown) => {
  const row = obj(value);
  return str(row.id) ? { id: String(row.id), label: str(row.label) ?? "" } : null;
};

/** A stored kit, when it has the fields the editor and the customer need. */
export function readKit(value: unknown): Kit | null {
  const row = obj(value);
  if (!("bioInstagram" in row) && !("bioTiktok" in row) && !("postingPlan" in row)) return null;
  const plan = Array.isArray(row.postingPlan) ? row.postingPlan.map(obj) : [];
  return {
    bioInstagram: str(row.bioInstagram) ?? "",
    bioTiktok: str(row.bioTiktok) ?? "",
    postingPlan: [1, 2, 3, 4].map((week) => ({ week, idea: str(plan.find((entry) => entry.week === week)?.idea) ?? "" })),
  };
}

/** Both bios, all four weeks and three story pictures: what Premium needs before delivery. */
export function kitComplete(kit: Kit | null, stories: readonly string[]): boolean {
  if (!kit) return false;
  return Boolean(kit.bioInstagram.trim() && kit.bioTiktok.trim() && kit.postingPlan.length === 4 && kit.postingPlan.every((entry) => entry.idea.trim()) && stories.length === 3);
}

export function readQueue(value: Json | null): QueueOrder[] {
  return (Array.isArray(value) ? value : []).map(obj).flatMap((row) => {
    const id = str(row.id);
    if (!id) return [];
    const customer = obj(row.customer);
    return [
      {
        id,
        number: str(row.number) ?? "",
        package: pkg(row.package),
        status: status(row.status),
        withdrawalPending: row.withdrawalPending === true,
        customer: { id: str(customer.id), username: str(customer.username), email: str(customer.email) ?? "" },
        orderedAt: str(row.orderedAt) ?? "",
        due: str(row.revisionDueAt) ?? str(row.dueAt) ?? str(row.promisedDueAt),
        assignee: person(row.assignee),
        revisionsLeft: num(row.revisionsLeft),
      },
    ];
  });
}

function readProposal(value: unknown): TeamProposal | null {
  const row = obj(value);
  const id = str(row.id);
  if (!id) return null;
  const proposalStatus = row.status === "delivered" || row.status === "applied" || row.status === "superseded" ? row.status : "draft";
  return {
    id,
    round: num(row.round),
    status: proposalStatus,
    page: row.page as Page,
    theme: row.theme as CreatorThemeConfig,
    kind: str(row.kind),
    message: str(row.message),
    request: str(row.request),
    extras: readKit(row.extras),
    storyPaths: Array.isArray(row.storyPaths) ? row.storyPaths.filter((path): path is string => typeof path === "string") : [],
    aiAssisted: row.aiAssisted === true,
    updatedAt: str(row.updatedAt),
    deliveredAt: str(row.deliveredAt),
  };
}

export function readOrder(value: Json | null): TeamOrder | null {
  const row = obj(value);
  const id = str(row.id);
  if (!id) return null;
  const customer = obj(row.customer);
  const briefing = row.briefing ? obj(row.briefing) : null;
  const site = row.site ? obj(row.site) : null;
  const strings = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : []);
  return {
    id,
    number: str(row.number) ?? "",
    package: pkg(row.package),
    status: status(row.status),
    locale: locale(row.locale),
    amountCents: num(row.amountCents),
    earlyStart: row.earlyStart === true,
    withdrawalPending: row.withdrawalPending === true,
    customer: { id: str(customer.id), username: str(customer.username), email: str(customer.email) ?? "", name: str(customer.name) },
    orderedAt: str(row.orderedAt) ?? "",
    promisedDueAt: str(row.promisedDueAt),
    dueAt: str(row.dueAt),
    revisionDueAt: str(row.revisionDueAt),
    briefing: briefing ? { links: strings(briefing.links), photos: strings(briefing.photos), wishes: str(briefing.wishes) ?? "", pageLocale: locale(briefing.pageLocale) } : null,
    assignee: person(row.assignee),
    revisionsAllowed: num(row.revisionsAllowed),
    revisionsUsed: num(row.revisionsUsed),
    revisionsLeft: num(row.revisionsLeft),
    deliveredAt: str(row.deliveredAt),
    refundedAt: str(row.refundedAt),
    events: (Array.isArray(row.events) ? row.events : []).map(obj).map((event) => ({
      id: num(event.id),
      at: str(event.at) ?? "",
      kind: str(event.kind) ?? "note",
      actor: str(event.actor),
      details: obj(event.details),
    })),
    proposals: (Array.isArray(row.proposals) ? row.proposals : []).map(readProposal).filter((proposal): proposal is TeamProposal => proposal !== null),
    site: site?.page ? { kind: str(site.kind), page: site.page as Page, theme: site.theme as CreatorThemeConfig } : null,
  };
}

export function readContracts(value: Json | null): ContractRequest[] {
  return (Array.isArray(value) ? value : []).map(obj).flatMap((row): ContractRequest[] => {
    const id = str(row.id);
    if (!id) return [];
    const accountRow = row.account ? obj(row.account) : null;
    const account = accountRow && str(accountRow.id) ? { id: String(accountRow.id), username: str(accountRow.username), email: str(accountRow.email) } : null;
    const entitlementRow = row.entitlement ? obj(row.entitlement) : null;
    if (row.kind === "withdrawal") {
      const orderRow = row.order ? obj(row.order) : null;
      const invoiceRow = row.invoice ? obj(row.invoice) : null;
      return [
        {
          kind: "withdrawal",
          id,
          receivedAt: str(row.receivedAt) ?? "",
          name: str(row.name) ?? "",
          email: str(row.email) ?? "",
          contract: str(row.contract) ?? "",
          matched: row.matched === true,
          suspect: row.suspect === true,
          decision: row.decision === "accepted" || row.decision === "rejected" ? row.decision : null,
          refundCents: typeof row.refundCents === "number" ? row.refundCents : null,
          handledAt: str(row.handledAt),
          note: str(row.note),
          refundDueAt: str(row.refundDueAt) ?? "",
          account,
          order:
            orderRow && str(orderRow.id)
              ? {
                  id: String(orderRow.id),
                  number: str(orderRow.number) ?? "",
                  amountCents: num(orderRow.amountCents),
                  earlyStart: orderRow.earlyStart === true,
                  status: status(orderRow.status),
                  withdrawalPending: orderRow.withdrawalPending === true,
                }
              : null,
          entitlement: entitlementRow && str(entitlementRow.id) ? { id: String(entitlementRow.id), subscription: str(entitlementRow.subscription), status: str(entitlementRow.status) ?? "" } : null,
          invoice: invoiceRow ? { amountCents: num(invoiceRow.amountCents) } : null,
        },
      ];
    }
    const decision = row.decision === "scheduled" || row.decision === "ended" || row.decision === "rejected" || row.decision === "resumed" ? row.decision : null;
    return [
      {
        kind: "cancellation",
        id,
        receivedAt: str(row.receivedAt) ?? "",
        name: str(row.name) ?? "",
        cancellationKind: row.cancellationKind === "extraordinary" ? "extraordinary" : "ordinary",
        reason: str(row.reason),
        accountEmail: str(row.accountEmail) ?? "",
        wantedDate: str(row.wantedDate),
        matched: row.matched === true,
        suspect: row.suspect === true,
        decision,
        effectiveAt: str(row.effectiveAt),
        handledAt: str(row.handledAt),
        note: str(row.note),
        account,
        entitlement:
          entitlementRow && str(entitlementRow.id)
            ? {
                id: String(entitlementRow.id),
                subscription: str(entitlementRow.subscription),
                status: str(entitlementRow.status) ?? "",
                cancelAtPeriodEnd: entitlementRow.cancelAtPeriodEnd === true,
                cancelAt: str(entitlementRow.cancelAt),
              }
            : null,
      },
    ];
  });
}

// ─── Reads ──────────────────────────────────────────────────────────────────────────────────

export async function loadQueue(scope: OrderScope): Promise<QueueOrder[]> {
  const { data, error } = await browserSupabase().rpc("admin_orders", { scope });
  if (error) throw new Error(error.message);
  return readQueue(data);
}

export async function loadOrder(id: string): Promise<TeamOrder | null> {
  const { data, error } = await browserSupabase().rpc("admin_order", { target: id });
  if (error) {
    if (error.message.includes("linkyo:notFound")) return null;
    throw new Error(error.message);
  }
  return readOrder(data);
}

export async function loadContracts(): Promise<ContractRequest[]> {
  const { data, error } = await browserSupabase().rpc("admin_contract_requests");
  if (error) throw new Error(error.message);
  return readContracts(data);
}

export interface AiStatus {
  enabled: boolean;
  runs: number;
  spentMicros: number;
}

export async function loadAiStatus(): Promise<AiStatus> {
  const { data, error } = await browserSupabase().rpc("admin_ai_status");
  if (error) throw new Error(error.message);
  const row = obj(data);
  const today = obj(row.today);
  return { enabled: row.enabled === true, runs: num(today.runs), spentMicros: num(today.spentMicros) };
}

/** Signed addresses (10 minutes) of private pictures: briefing photos, story pictures. */
export const signedUrls = (bucket: PrivateBucket, paths: readonly string[]): Promise<Map<string, string>> => signPaths(bucket, paths);

/**
 * Deletes a story picture that was taken out of a draft (the team's own right on the bucket). The
 * caller checks first that no other proposal of the order still lists it (`storyRemovable`).
 */
export async function removeStoryFile(path: string): Promise<void> {
  const { error } = await browserSupabase().storage.from("deliverables").remove([path]);
  if (error) throw new Error(error.message);
}

// ─── Actions ────────────────────────────────────────────────────────────────────────────────

/** "Assign to me": the database checks `pages.edit` and moves a queued order to "in progress". */
export async function assignToMe(id: string): Promise<void> {
  const { error } = await browserSupabase().rpc("admin_assign_order", { target: id });
  if (error) throw new Error(error.message);
}

export async function setAiEnabled(enabled: boolean): Promise<void> {
  const { error } = await browserSupabase().rpc("admin_set_ai_enabled", { enabled });
  if (error) throw new Error(error.message);
}

/** Saves the round's draft proposal (never the customer's page). */
export async function saveProposal(input: {
  orderId: string;
  page: Page;
  theme: CreatorThemeConfig;
  kind?: string | null | undefined;
  message?: string | undefined;
  extras?: Kit | null | undefined;
  stories?: readonly string[] | undefined;
}): Promise<string> {
  const { data, error } = await browserSupabase().rpc("admin_save_proposal", {
    target: input.orderId,
    page: input.page as unknown as Json,
    theme: input.theme as unknown as Json,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.message !== undefined ? { message: input.message } : {}),
    ...(input.extras ? { extras: input.extras as unknown as Json } : {}),
    ...(input.stories ? { stories: [...input.stories] } : {}),
  });
  if (error) throw new Error(error.message);
  return data;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

/** A POST to one of our routes with the session's token; throws ApiError with the route's code. */
export async function post(path: string, body: object = {}): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = obj(await response.json().catch(() => ({})));
  if (!response.ok) throw new ApiError(str(data.error) ?? "server", response.status);
  return data;
}

export const deliverProposal = (orderId: string, proposalId: string) => post(`/api/admin/orders/${orderId}/deliver`, { proposalId });
export const refundOrder = (orderId: string) => post(`/api/admin/orders/${orderId}/refund`);
export const decideContract = (kind: "withdrawal" | "cancellation", id: string, body: { action: string; note?: string; refundCents?: number }) =>
  post(`/api/admin/contracts/${kind}/${id}`, body);
