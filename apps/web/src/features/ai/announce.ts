import { AI_STEPS } from "./events";
import { initialRunState, type AiStepId, type RunState, type StepStatus } from "./run-reducer";

/**
 * What a screen reader hears while an AI run works (WCAG 4.1.3 status messages, 2.2.2): steps, never
 * tokens, blocks, sources or seconds. Pure: it compares two moments of a run and says what is new.
 *
 * Per run at most: "read" starts and ends; "details" starts; "colors" starts (or its skip sentence);
 * "plan" starts and ends, with up to two "still planning" sentences in between (30 s and 60 s into
 * the planning); "look" ends; "write" starts; "check" starts and ends. That is 12. The run view adds
 * one status sentence at the end (ready or stopped), or one alert for an error: 14 in all.
 *
 * Compared with the empty run (`spokenSoFar`), it gives everything said so far, in the order it was
 * said, and that list only grows: the log renders it, so no sentence is ever said twice.
 */

export type Announcement =
  | { kind: "stepStart"; step: AiStepId; current: number; total: number }
  | { kind: "stepDone"; step: AiStepId }
  | { kind: "colorsSkip" }
  | { kind: "stillPlanning"; seconds: number };

/** A moment of a run: its state and the time it was looked at (epoch ms). */
export interface RunMoment {
  state: RunState;
  at: number;
}

/** "Still planning" after this many seconds of planning (at most these two). */
export const STILL_PLANNING_AT = [30, 60] as const;

/** Steps whose start is said ("Step 4 of 7: the AI is planning your page."). */
const SAY_START: readonly AiStepId[] = ["read", "details", "colors", "plan", "write", "check"];
/** Steps whose end is said, with their result ("Planned in 38 s."). */
const SAY_DONE: readonly AiStepId[] = ["read", "plan", "look", "check"];

const ended = (status: StepStatus) => status === "done" || status === "skipped" || status === "failed";

/** A stable name for one announcement (the log's key). */
export const announcementKey = (said: Announcement): string =>
  said.kind === "stepStart" ? `start-${said.step}` : said.kind === "stepDone" ? `done-${said.step}` : said.kind === "colorsSkip" ? "colors-skip" : `planning-${String(said.seconds)}`;

/** The planning seconds that passed between two moments (capped at the planning's end). */
function planningCrossed(prev: RunMoment, next: RunMoment): number[] {
  const plan = next.state.steps.plan;
  const from = next.state.planStartedAt;
  if (from === null || plan.state === "pending" || plan.state === "skipped") return [];
  const until = plan.state === "running" ? next.at : (plan.endedAt ?? next.at);
  const before = (prev.at - from) / 1000;
  const after = (Math.min(next.at, until) - from) / 1000;
  return STILL_PLANNING_AT.filter((seconds) => before < seconds && after >= seconds);
}

export function announcementsFor(prev: RunMoment, next: RunMoment): Announcement[] {
  const said: Announcement[] = [];
  // Nothing is said before a run starts.
  if (next.state.phase === "input" || next.state.startedAt === null) return said;
  // A new run is compared with an empty one, never with the run before it.
  const base = prev.state.startedAt === next.state.startedAt ? prev.state : initialRunState();
  const total = AI_STEPS.length;
  AI_STEPS.forEach((step, index) => {
    const before = base.steps[step].state;
    const after = next.state.steps[step].state;
    if (before !== after && before === "pending" && SAY_START.includes(step)) {
      if (step === "colors" && after === "skipped") said.push({ kind: "colorsSkip" });
      else said.push({ kind: "stepStart", step, current: index + 1, total });
    }
    if (step === "plan") for (const seconds of planningCrossed(prev, next)) said.push({ kind: "stillPlanning", seconds });
    // A step is said "done" only when it finished as planned: skipped and failed steps are not results.
    if (!ended(before) && after === "done" && SAY_DONE.includes(step)) said.push({ kind: "stepDone", step });
  });
  return said;
}

/** Everything said about this run up to `at`, in order (empty before the run starts). */
export function spokenSoFar(state: RunState, at: number): Announcement[] {
  if (state.startedAt === null) return [];
  return announcementsFor({ state: initialRunState(), at: state.startedAt }, { state, at });
}
