import { MAX_TOKENS, REPAIR_MAX_TOKENS } from "../limits";
import type { PageDraft } from "../plan-to-page";
import type { AiRoute } from "../request";

import type { PlanProblem } from "./prompts";

/**
 * When an answer needs the run's one follow-up call, and how that call is made. Most problems are
 * fixed in code for free (lengths, casing, unknown links); only a hard failure costs a second call:
 * the answer was cut off (max_tokens), is not JSON, has no blocks although the sources had links, or
 * lost more than 30 % of its blocks. A run never makes more than two calls.
 */

export type Effort = "low" | "medium" | "high";

/** Effort per route: self-serve drafts at medium, the team's drafts at high. */
export const ROUTE_EFFORT: Readonly<Record<AiRoute, Effort>> = { welcome: "medium", dashboard: "medium", team: "high" };

/** A follow-up call needs at least this much time left before the run's deadline. */
export const FOLLOW_UP_MIN_MS = 70_000;
/** More than this share of the plan's blocks removed is a hard failure. */
export const MAX_DROPPED_SHARE = 0.3;

/** The answer's text as JSON, or null when it is not JSON. */
export function parsePlanText(text: string): { value: unknown } | null {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return null;
  }
}

export interface AnswerCheck {
  stopReason: string | null;
  /** The answer did not parse as JSON (or not as a plan object). */
  unparseable: boolean;
  /** The mapped draft, when there is one. */
  draft: PageDraft | null;
  /** How many blocks the plan had (before mapping). */
  planBlocks: number;
  /** How many links the sources had. */
  bundleLinks: number;
}

/** The hard problems of an answer (empty: it is good enough). Paths and codes only, no prose. */
export function planProblems(check: AnswerCheck): PlanProblem[] {
  if (check.stopReason === "max_tokens") return [{ path: "$", code: "max_tokens" }];
  if (check.unparseable || !check.draft) return [{ path: "$", code: "unparseable" }];
  const { draft } = check;
  if (draft.page.blocks.length === 0 && check.bundleLinks > 0) return [{ path: "$.blocks", code: "empty" }];
  if (check.planBlocks > 0 && draft.drops.length / check.planBlocks > MAX_DROPPED_SHARE) {
    return draft.drops.map((drop) => ({ path: `$.blocks[${String(drop.index)}]`, code: drop.reason }));
  }
  return [];
}

/**
 * The follow-up call's settings. A cut-off answer gets the same effort and output cap again (a lower
 * effort would undo why a team run uses "high"); a parse repair runs at "low" with a small cap.
 */
export function followUpSettings(route: AiRoute, problems: readonly PlanProblem[]): { effort: Effort; maxTokens: number } {
  if (problems.some((problem) => problem.code === "max_tokens")) return { effort: ROUTE_EFFORT[route], maxTokens: MAX_TOKENS[route] };
  return { effort: "low", maxTokens: REPAIR_MAX_TOKENS };
}

/** Is there time for a follow-up call? */
export const followUpFits = (deadline: number, now: number): boolean => deadline - now >= FOLLOW_UP_MIN_MS;
