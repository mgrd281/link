import type { AiRunEvent } from "./events";
import type { RecordedEvent, Recording } from "./recordings/types";

/**
 * Plays a recorded AI run back with its real timing (the homepage's recording, the design page's test
 * data). Every event keeps the offset it had in the run, with one exception that is always reported:
 * the planning wait (the AI thinking, often half a minute or more) is cut to a few seconds, and the
 * run view says so with the real figure ("Wait shortened (actual: 36 s)"). Pure scheduling with an
 * injectable clock, so it is tested without waiting.
 */

/** The planning wait a replay shows (the rest of it is cut and reported). */
export const SHORT_PLAN_MS = 3000;

export interface ReplayClock {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const TIMERS: ReplayClock = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

export interface ReplaySchedule {
  /** The events with the offsets they play at. */
  events: RecordedEvent[];
  /** The real planning wait (ms) when the replay shortens it, else null. */
  shortenedMs: number | null;
  /** When the last event plays (ms after the start). */
  durationMs: number;
}

const isPlanStart = (event: AiRunEvent): boolean => event.type === "step" && event.key === "plan" && event.state === "start";

/**
 * The replay's timetable: the recorded offsets, except that the wait after "planning started" is cut
 * to `shortenPlanToMs` and everything after it moves up by the same amount.
 */
export function replaySchedule(recording: Recording, shortenPlanToMs = SHORT_PLAN_MS): ReplaySchedule {
  const { events } = recording;
  const start = events.findIndex((entry) => isPlanStart(entry.event));
  const planStart = events[start];
  const afterPlan = events[start + 1];
  const wait = planStart && afterPlan ? afterPlan.at - planStart.at : 0;
  const cut = wait > shortenPlanToMs ? wait - shortenPlanToMs : 0;
  const scheduled = events.map((entry, index) => (cut > 0 && index > start ? { at: entry.at - cut, event: entry.event } : entry));
  // A recording whose file was already shortened keeps its real figure.
  const shortenedMs = cut > 0 ? (recording.planShortenedFromMs ?? wait) : recording.planShortenedFromMs;
  return { events: scheduled, shortenedMs, durationMs: scheduled.at(-1)?.at ?? 0 };
}

export interface ReplayOptions {
  /** Each event when its time comes (events with the same offset arrive together, in order). */
  onEvent: (event: AiRunEvent, index: number) => void;
  /** After the last event. Not called when the replay is aborted. */
  onEnd?: () => void;
  clock?: ReplayClock;
  /** Aborting stops the replay at once: no further event, no `onEnd`. */
  signal?: AbortSignal;
  shortenPlanToMs?: number;
}

/** Starts a replay; returns its timetable (with the shortened wait to report). */
export function replay(recording: Recording, { onEvent, onEnd, clock = TIMERS, signal, shortenPlanToMs = SHORT_PLAN_MS }: ReplayOptions): ReplaySchedule {
  const schedule = replaySchedule(recording, shortenPlanToMs);
  const { events } = schedule;
  if (signal?.aborted) return schedule;
  let handle: unknown = null;
  let index = 0;

  const next = () => {
    handle = null;
    const due = events[index]?.at;
    // Everything due at this offset plays now, in order.
    while (!signal?.aborted && index < events.length && events[index]?.at === due) {
      const entry = events[index];
      if (entry) onEvent(entry.event, index);
      index += 1;
    }
    if (signal?.aborted) return;
    const following = events[index];
    if (!following) {
      onEnd?.();
      return;
    }
    handle = clock.setTimeout(next, following.at - (due ?? 0));
  };

  signal?.addEventListener(
    "abort",
    () => {
      if (handle !== null) clock.clearTimeout(handle);
      handle = null;
    },
    { once: true },
  );
  handle = clock.setTimeout(next, events[0]?.at ?? 0);
  return schedule;
}
