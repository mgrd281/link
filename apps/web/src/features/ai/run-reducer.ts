import type { Block, CreatorKind, Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { AI_STEPS, type AiCounts, type AiErrorCode, type AiRunEvent, type AiRunEventOf } from "./events";

/**
 * The state of one AI run as the browser sees it, built only from the events the server sent (or a
 * recording replays). Pure, so the dashboard's run view, the homepage replay and the team console
 * share it, and every rule below is unit-tested with the mock's real event lists.
 *
 *  - A step goes pending → running on its `start`, then done, skipped or failed on its end event.
 *  - "Look" starts and ends with the `look` event; "write" runs from the first block to `done`.
 *  - Blocks are placed by their index, so an event that arrives late still lands in its place.
 *  - `done` opens the review (a repeated `done` is ignored), `stopped` keeps the blocks that arrived,
 *    `error` ends the run. Nothing is accepted after the run ended.
 */

export type RunPhase = "input" | "running" | "stopping" | "stopped" | "review" | "error";
export type AiStepId = (typeof AI_STEPS)[number];
export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface StepState {
  state: StepStatus;
  counts?: AiCounts;
  /** How long the step took, as the server measured it (else from the times below). */
  ms?: number;
  /** When the browser saw it start and end (epoch ms), for the duration at the end of its row. */
  startedAt?: number;
  endedAt?: number;
}

export type RunSource = AiRunEventOf<"source">;
export type RunProfile = AiRunEventOf<"profile">["profile"];
export type RunNote = AiRunEventOf<"notes">["notes"][number];
export type RunDrop = AiRunEventOf<"drop">;
export type RunLocale = "de" | "en" | "ar";
export interface RunPhoto {
  vibrant: string;
  dominant: string;
}

export interface RunState {
  phase: RunPhase;
  runId: string | null;
  plan: "free" | "pro" | "team" | null;
  /** Drafts left after this one (null for team runs). */
  left: number | null;
  steps: Record<AiStepId, StepState>;
  sources: RunSource[];
  look: { kind: CreatorKind; theme: CreatorThemeConfig } | null;
  profile: RunProfile | null;
  /** The blocks that arrived, in page order. */
  blocks: Block[];
  drops: RunDrop[];
  notes: RunNote[];
  result: AiRunEventOf<"done"> | null;
  /** The `stopped` event, when the owner stopped the run. */
  stopped: AiRunEventOf<"stopped"> | null;
  error: AiErrorCode | null;
  startedAt: number | null;
  planStartedAt: number | null;
  /** When the run ended (done, stopped or error), so the elapsed time stands still. */
  endedAt: number | null;
  counted: boolean;
  /** The page's language (from the request), for the draft's direction and fonts. */
  pageLocale: RunLocale | null;
  /** The colours measured from the owner's photo (from the request), for the colours step and the look's accent. */
  photo: RunPhoto | null;
  /** The stream broke: the result is fetched in the background (`app.ai.errors.offline`). */
  offline: boolean;
  /** Index of each entry of `blocks` in the server's order (internal: keeps late blocks in place). */
  blockIndexes: number[];
}

export type RunAction =
  | { type: "event"; event: AiRunEvent; at: number }
  | { type: "start"; at: number; pageLocale?: RunLocale | undefined; photo?: RunPhoto | null | undefined }
  | { type: "stopRequested" }
  | { type: "offline"; offline: boolean }
  | { type: "reset" };

const pendingSteps = (): Record<AiStepId, StepState> => Object.fromEntries(AI_STEPS.map((key) => [key, { state: "pending" }])) as Record<AiStepId, StepState>;

export function initialRunState(): RunState {
  return {
    phase: "input",
    runId: null,
    plan: null,
    left: null,
    steps: pendingSteps(),
    sources: [],
    look: null,
    profile: null,
    blocks: [],
    drops: [],
    notes: [],
    result: null,
    stopped: null,
    error: null,
    startedAt: null,
    planStartedAt: null,
    endedAt: null,
    counted: false,
    pageLocale: null,
    photo: null,
    offline: false,
    blockIndexes: [],
  };
}

const isStep = (key: string): key is AiStepId => (AI_STEPS as readonly string[]).includes(key);
const ended = (status: StepStatus) => status === "done" || status === "skipped" || status === "failed";

/** A step moves forward only: a late `start` never reopens a finished step. */
function moveStep(steps: Record<AiStepId, StepState>, key: AiStepId, next: StepStatus, at: number, extra: { ms?: number | undefined; counts?: AiCounts | undefined } = {}): Record<AiStepId, StepState> {
  const current = steps[key];
  if (ended(current.state)) return steps;
  if (next === "running") {
    if (current.state === "running") return steps;
    return { ...steps, [key]: { ...current, state: "running", startedAt: at } };
  }
  const step: StepState = { ...current, state: next, endedAt: at, startedAt: current.startedAt ?? at };
  if (extra.ms !== undefined) step.ms = extra.ms;
  if (extra.counts) step.counts = extra.counts;
  return { ...steps, [key]: step };
}

/** Every step still running when the run ends gets this state (pending ones stay pending). */
function settleRunning(steps: Record<AiStepId, StepState>, to: StepStatus, at: number): Record<AiStepId, StepState> {
  let next = steps;
  for (const key of AI_STEPS) if (steps[key].state === "running") next = moveStep(next, key, to, at);
  return next;
}

/** Puts a block at its index in the page order (a block that arrives late still lands in its place). */
function placeBlock(state: RunState, index: number, block: Block): Pick<RunState, "blocks" | "blockIndexes"> {
  const at = state.blockIndexes.indexOf(index);
  if (at >= 0) {
    const blocks = [...state.blocks];
    blocks[at] = block;
    return { blocks, blockIndexes: state.blockIndexes };
  }
  const position = state.blockIndexes.findIndex((existing) => existing > index);
  const insert = position < 0 ? state.blocks.length : position;
  const blocks = [...state.blocks];
  const blockIndexes = [...state.blockIndexes];
  blocks.splice(insert, 0, block);
  blockIndexes.splice(insert, 0, index);
  return { blocks, blockIndexes };
}

const profileOf = (page: Page): RunProfile => {
  const { displayName, tagline, bio, location } = page.profile;
  return { displayName, ...(tagline ? { tagline } : {}), ...(bio ? { bio } : {}), ...(location ? { location } : {}) };
};

function onEvent(state: RunState, event: AiRunEvent, at: number): RunState {
  switch (event.type) {
    case "run":
      return { ...state, runId: event.id, plan: event.plan, left: event.left };
    case "step": {
      if (!isStep(event.key)) return state;
      const next: StepStatus = event.state === "start" ? "running" : event.state === "done" ? "done" : event.state === "skip" ? "skipped" : "failed";
      const steps = moveStep(state.steps, event.key, next, at, { ms: event.ms, counts: event.counts });
      if (steps === state.steps) return state;
      const planStartedAt = event.key === "plan" && next === "running" ? at : state.planStartedAt;
      return { ...state, steps, planStartedAt };
    }
    case "source": {
      const known = state.sources.findIndex((source) => source.id === event.id);
      const sources = known < 0 ? [...state.sources, event] : state.sources.map((source, i) => (i === known ? event : source));
      return { ...state, sources };
    }
    case "look": {
      let steps = moveStep(state.steps, "look", "running", at);
      steps = moveStep(steps, "look", "done", at);
      return { ...state, look: { kind: event.kind, theme: event.theme }, steps };
    }
    case "profile":
      return { ...state, profile: event.profile };
    case "block": {
      const steps = moveStep(state.steps, "write", "running", at);
      return { ...state, steps, ...placeBlock(state, event.index, event.block) };
    }
    case "drop": {
      if (state.drops.some((drop) => drop.index === event.index && drop.reason === event.reason)) return state;
      return { ...state, drops: [...state.drops, event] };
    }
    case "notes":
      return { ...state, notes: event.notes };
    case "done": {
      let steps = moveStep(state.steps, "write", "done", at, { counts: { blocks: event.page.blocks.length } });
      steps = settleRunning(steps, "done", at);
      return {
        ...state,
        phase: "review",
        result: event,
        runId: event.runId,
        counted: event.counted,
        steps,
        look: { kind: event.kind, theme: event.theme },
        profile: profileOf(event.page),
        blocks: event.page.blocks,
        blockIndexes: event.page.blocks.map((_, i) => i),
        endedAt: at,
        offline: false,
      };
    }
    case "stopped": {
      const kept = event.page?.blocks ?? state.blocks;
      return {
        ...state,
        phase: "stopped",
        stopped: event,
        runId: event.runId,
        counted: event.counted,
        steps: settleRunning(state.steps, "skipped", at),
        blocks: kept,
        blockIndexes: kept.map((_, i) => i),
        ...(event.page ? { profile: profileOf(event.page) } : {}),
        ...(event.theme && event.kind ? { look: { kind: event.kind, theme: event.theme } } : {}),
        endedAt: at,
        offline: false,
      };
    }
    case "error":
      return { ...state, phase: "error", error: event.code, counted: false, steps: settleRunning(state.steps, "failed", at), endedAt: at, offline: false };
  }
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "start":
      return { ...initialRunState(), phase: "running", startedAt: action.at, pageLocale: action.pageLocale ?? null, photo: action.photo ?? null };
    case "reset":
      return initialRunState();
    case "stopRequested":
      return state.phase === "running" ? { ...state, phase: "stopping" } : state;
    case "offline":
      return state.offline === action.offline || !isLive(state) ? state : { ...state, offline: action.offline };
    case "event":
      // Only a run in progress takes events: after it ended (a repeated `done`, a late block) nothing changes.
      return isLive(state) ? onEvent(state, action.event, action.at) : state;
  }
}

/** The run is in progress (started, not yet done, stopped or failed). */
export const isLive = (state: RunState): boolean => state.phase === "running" || state.phase === "stopping";

/** How many of the seven steps have finished (done, skipped or failed): the progress bar's value. */
export const stepsFinished = (state: RunState): number => AI_STEPS.filter((key) => ended(state.steps[key].state)).length;

/** The step the run is on: the first running one, else the first pending one (null when all ended). */
export function currentStep(state: RunState): AiStepId | null {
  return AI_STEPS.find((key) => state.steps[key].state === "running") ?? AI_STEPS.find((key) => state.steps[key].state === "pending") ?? null;
}

/** A step's duration in ms (the server's measure, else the browser's), or null while unknown. */
export function stepDuration(step: StepState, now: number): number | null {
  if (step.ms !== undefined) return step.ms;
  if (step.startedAt === undefined) return null;
  if (step.state === "running") return Math.max(0, now - step.startedAt);
  return step.endedAt !== undefined ? Math.max(0, step.endedAt - step.startedAt) : null;
}

/** The run's elapsed time in ms (stands still once it ended). */
export const runElapsed = (state: RunState, now: number): number => (state.startedAt === null ? 0 : Math.max(0, (state.endedAt ?? now) - state.startedAt));

/** The draft as far as it got: the finished page, the stopped one, or what streamed in so far. */
export function draftOf(state: RunState): { blocks: Block[]; profile: RunProfile | null; theme: CreatorThemeConfig | null; kind: CreatorKind | null } {
  if (state.result) return { blocks: state.result.page.blocks, profile: profileOf(state.result.page), theme: state.result.theme, kind: state.result.kind };
  return { blocks: state.blocks, profile: state.profile, theme: state.look?.theme ?? null, kind: state.look?.kind ?? null };
}

/** Feeds a whole list of events into a fresh run (tests, replays): `start` at the first event's time. */
export function runFromEvents(events: readonly AiRunEvent[], at: (index: number) => number = (index) => index): RunState {
  let state = runReducer(initialRunState(), { type: "start", at: at(0) });
  events.forEach((event, index) => {
    state = runReducer(state, { type: "event", event, at: at(index) });
  });
  return state;
}
