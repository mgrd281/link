import type { Kit, TeamOrder, TeamProposal } from "./orders-data";

/** The team's rules for one order, as plain functions (the screens only draw what they answer). */

/** The draft of the current round (round = revisions used), if there is one. */
export function currentDraft(order: Pick<TeamOrder, "proposals" | "revisionsUsed">): TeamProposal | null {
  return order.proposals.find((proposal) => proposal.round === order.revisionsUsed && proposal.status === "draft") ?? null;
}

const CLOSED: ReadonlySet<string> = new Set(["refunded", "withdrawn"]);

/** No work on an order that is refunded, withdrawn or has a withdrawal waiting. */
export const orderLocked = (order: Pick<TeamOrder, "status" | "withdrawalPending">): boolean => order.withdrawalPending || CLOSED.has(order.status);

/**
 * "Refund" on the order: not once it is closed, and not while a withdrawal waits. That refund is
 * decided in the contracts tab; from here it would be booked as the once-per-account money-back.
 */
export function refundState(order: Pick<TeamOrder, "status" | "withdrawalPending">): "open" | "withdrawal" | "closed" {
  if (CLOSED.has(order.status)) return "closed";
  return order.withdrawalPending ? "withdrawal" : "open";
}

/**
 * What "Create a draft with AI" does now: nothing (locked, no briefing, the round is delivered), ask
 * first (the round already has a draft, and the run would replace its page and look for good), or run.
 */
export function aiStart(order: Pick<TeamOrder, "status" | "withdrawalPending" | "briefing" | "proposals" | "revisionsUsed">): "blocked" | "confirm" | "go" {
  if (orderLocked(order) || !order.briefing) return "blocked";
  if (currentDraft(order)) return "confirm";
  return order.proposals.some((proposal) => proposal.round === order.revisionsUsed) ? "blocked" : "go";
}

/**
 * May a story picture's file be deleted when it is taken out of the draft? Only when no other
 * proposal of the order lists it: a new round starts with the delivered round's pictures, and those
 * stay downloadable from the proposal the customer already has.
 */
export function storyRemovable(order: Pick<TeamOrder, "proposals" | "revisionsUsed">, path: string): boolean {
  const draft = currentDraft(order);
  return !order.proposals.some((proposal) => proposal.id !== draft?.id && proposal.storyPaths.includes(path));
}

// ─── The proposal's message and kit ─────────────────────────────────────────────────────────

export interface ProposalMeta {
  message: string;
  kit: Kit;
  stories: string[];
}

/**
 * A change to the message or the kit, applied to what is on screen when it lands, not to what was
 * there when it started: a picture that finishes uploading must not bring back the text of a minute
 * ago and throw away what was typed meanwhile.
 */
export type MetaChange = (current: ProposalMeta) => ProposalMeta;

export const withMessage =
  (message: string): MetaChange =>
  (current) => ({ ...current, message });

export const withKit =
  (patch: Partial<Pick<Kit, "bioInstagram" | "bioTiktok">>): MetaChange =>
  (current) => ({ ...current, kit: { ...current.kit, ...patch } });

export const withIdea =
  (week: number, idea: string): MetaChange =>
  (current) => ({ ...current, kit: { ...current.kit, postingPlan: current.kit.postingPlan.map((entry) => (entry.week === week ? { ...entry, idea } : entry)) } });

/** At most three pictures; the same file is listed once. */
export const withStory =
  (path: string): MetaChange =>
  (current) => (current.stories.includes(path) || current.stories.length >= 3 ? current : { ...current, stories: [...current.stories, path] });

export const withoutStory =
  (path: string): MetaChange =>
  (current) => ({ ...current, stories: current.stories.filter((item) => item !== path) });
