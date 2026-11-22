import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { PAGE_PLAN_JSON_SCHEMA } from "@linkyo/blocks/ai-plan";

import { assertAnthropicBaseUrl } from "./config";
import { costMicros, servedByFallback } from "./cost";
import { CATALOGUE_AND_EXAMPLE_V1, SYSTEM_CORE_V1, type PromptText } from "./prompts";
import type { Effort } from "./repair";

/**
 * The one place that talks to the Claude API (the static guard keeps the SDK here). One streamed
 * Messages call per draft with structured output (the PagePlan JSON schema), adaptive thinking (always
 * on for this model; `effort` is the only control), refusal fallback on, and no tools. The system
 * prompt is two blocks, the second one cached. Errors come back as the SDK's typed classes and are
 * mapped to the run's codes here, never by reading messages.
 */

export const MODEL = "claude-opus-5-5";
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** A client for this server, after checking where ANTHROPIC_BASE_URL points (key and URL come from the environment). */
export function createClaudeClient(): Anthropic {
  assertAnthropicBaseUrl();
  return new Anthropic({ maxRetries: 1, timeout: 190_000 });
}

export interface PlanCall {
  effort: Effort;
  maxTokens: number;
  content: PromptText[];
  /** Deadline and stop flag together; never the browser's request signal. */
  signal: AbortSignal;
  /** Each piece of answer text as it arrives (the first one ends the planning phase). */
  onText?: (delta: string) => void;
}

export interface PlanCallResult {
  /** All text blocks joined (a fallback model continues the same answer; `fallback` blocks are skipped). */
  text: string;
  stopReason: string | null;
  /** The model that served the answer (a fallback model after a refusal). */
  model: string;
  fallback: boolean;
  costMicros: number;
  usage: { input: number; cacheRead: number; cacheWrite: number; output: number };
  requestId: string | null;
}

export type ClaudeErrorCode = "busy" | "budget" | "timeout" | "server" | "aborted";

/** A failed call, already mapped: `spendLimit` means Anthropic's spend limit was reached (turn AI off). */
export class ClaudeCallError extends Error {
  constructor(
    readonly code: ClaudeErrorCode,
    readonly spendLimit: boolean,
    /** The SDK's error class name, for the log (never the message: it can echo input). */
    readonly errorName: string,
  ) {
    super(code);
    this.name = "ClaudeCallError";
  }
}

/** The request body, exactly: model, cap, refusal fallback, effort and schema, the two system blocks, one user turn. */
export function planRequest(call: Pick<PlanCall, "effort" | "maxTokens" | "content">): BetaMessageStreamParams {
  return {
    model: MODEL,
    max_tokens: call.maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: call.effort, format: { type: "json_schema", schema: PAGE_PLAN_JSON_SCHEMA } },
    system: [
      { type: "text", text: SYSTEM_CORE_V1 },
      { type: "text", text: CATALOGUE_AND_EXAMPLE_V1, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: call.content }],
  };
}

const nameOf = (error: unknown): string => (error instanceof Error ? error.constructor.name : typeof error);

/** Maps a thrown error to the run's codes. Most specific class first. */
export function claudeError(error: unknown, aborted: boolean): ClaudeCallError {
  if (error instanceof ClaudeCallError) return error;
  const name = nameOf(error);
  if (error instanceof Anthropic.APIUserAbortError || aborted) return new ClaudeCallError("aborted", false, name);
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ClaudeCallError("timeout", false, name);
  if (error instanceof Anthropic.RateLimitError) {
    const spend = error.errorCode === "enforced_spend_limit_reached";
    return new ClaudeCallError(spend ? "budget" : "busy", spend, name);
  }
  if (error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) return new ClaudeCallError("busy", false, name);
  if (error instanceof Anthropic.APIError && error.status === 529) return new ClaudeCallError("busy", false, name);
  return new ClaudeCallError("server", false, name);
}

export interface PlanCaller {
  call: (call: PlanCall) => Promise<PlanCallResult>;
}

/** Streams one plan. Throws `ClaudeCallError`. */
export function createPlanCaller(client?: Anthropic): PlanCaller {
  let made = client;
  return {
    async call(call) {
      try {
        made ??= createClaudeClient();
        const stream = made.beta.messages.stream(planRequest(call), { signal: call.signal });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") call.onText?.(event.delta.text);
        }
        const message = await stream.finalMessage();
        const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
        const usage = message.usage;
        return {
          text,
          stopReason: message.stop_reason,
          model: message.model,
          fallback: servedByFallback(usage),
          costMicros: costMicros(message.model, usage),
          usage: {
            input: usage.input_tokens,
            cacheRead: usage.cache_read_input_tokens ?? 0,
            cacheWrite: usage.cache_creation_input_tokens ?? 0,
            output: usage.output_tokens,
          },
          requestId: stream.request_id ?? null,
        };
      } catch (error) {
        throw claudeError(error, call.signal.aborted);
      }
    },
  };
}
