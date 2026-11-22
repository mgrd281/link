import type { Block, CreatorKind, Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

/**
 * What an AI run streams to the browser (server-sent events, one JSON object per event). Shared by
 * the pipeline, the dashboard's run view and the homepage replay, so all three speak one contract.
 * Events carry real progress only: nothing is shown that the server did not do.
 */

/** The seven steps people see, in order. */
export const AI_STEPS = ["read", "details", "colors", "plan", "look", "write", "check"] as const;
/** `save` is internal (the draft is stored); it is never shown as a step. */
export type AiStepKey = (typeof AI_STEPS)[number] | "save";
export type AiStepState = "start" | "done" | "skip" | "fail";

export type AiErrorCode = "quota" | "busy" | "budget" | "limit" | "failures" | "refused" | "timeout" | "nothing" | "invalid" | "server" | "disabled";

export type AiSourceKind = "website" | "linkinbio" | "linktree" | "tiktok" | "instagram" | "youtube" | "x" | "social" | "pasted";
export type AiSourceStatus = "read" | "skipped" | "failed" | "handleOnly";
export type AiSourceReason = "robots" | "paste" | "notFound" | "timeout" | "tooLarge" | "notAllowed" | "blocked";

export interface AiCounts {
  links?: number;
  profiles?: number;
  media?: number;
  blocks?: number;
  fixed?: number;
  dropped?: number;
}

export type AiRunEvent =
  | { type: "run"; id: string; plan: "free" | "pro" | "team"; left: number | null }
  | { type: "step"; key: AiStepKey; state: AiStepState; ms?: number; counts?: AiCounts }
  | { type: "source"; id: string; kind: AiSourceKind; label: string; status: AiSourceStatus; reason?: AiSourceReason; counts?: AiCounts }
  | { type: "look"; kind: CreatorKind; theme: CreatorThemeConfig }
  | { type: "profile"; profile: { displayName: string; tagline?: string; bio?: string; location?: string } }
  | { type: "block"; index: number; block: Block }
  | { type: "drop"; index: number; reason: "unknownLink" | "duplicate" | "invalid" | "notSocial" }
  | { type: "notes"; notes: { topic: "look" | "order" | "copy" | "missing"; text: string }[] }
  | {
      type: "done";
      runId: string;
      page: Page;
      theme: CreatorThemeConfig;
      kind: CreatorKind;
      fixed: number;
      dropped: number;
      fallback: boolean;
      counted: boolean;
      expiresAt: string;
      ms: number;
    }
  | { type: "stopped"; runId: string; page: Page | null; theme: CreatorThemeConfig | null; kind: CreatorKind | null; counted: boolean }
  | { type: "error"; code: AiErrorCode; counted: false };

export type AiRunEventType = AiRunEvent["type"];
export type AiRunEventOf<T extends AiRunEventType> = Extract<AiRunEvent, { type: T }>;
