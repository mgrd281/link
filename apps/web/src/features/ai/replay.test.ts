import { describe, expect, it } from "vitest";

import type { AiRunEvent } from "./events";
import { FIXTURES } from "./recordings";
import type { Recording } from "./recordings/types";
import { replay, replaySchedule, SHORT_PLAN_MS, type ReplayClock } from "./replay";

/** A clock that only moves when the test says so: every replay runs in no time. */
function fakeClock() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const clock: ReplayClock = {
    setTimeout: (callback, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
  };
  /** Runs every timer due up to `to`, in time order (timers set while running count too). */
  const advance = (to: number) => {
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].callback();
    }
    now = to;
  };
  return { clock, advance, now: () => now, pending: () => timers.size };
}

const step = (key: "read" | "plan" | "write", state: "start" | "done"): AiRunEvent => ({ type: "step", key, state });

/** A short run: the planning wait (1.5 s) is below the cut, so nothing changes. */
const SHORT: Recording = {
  kind: "fixture",
  locale: "de",
  recordedAt: "2026-11-22T10:00:00.000Z",
  planShortenedFromMs: null,
  events: [
    { at: 0, event: { type: "run", id: "r", plan: "free", left: 0 } },
    { at: 200, event: step("read", "start") },
    { at: 900, event: step("read", "done") },
    { at: 900, event: step("plan", "start") },
    { at: 2400, event: step("plan", "done") },
    { at: 2500, event: step("write", "start") },
  ],
};

/** The same with a 40 s planning wait. */
const LONG: Recording = {
  ...SHORT,
  events: SHORT.events.map((entry) => (entry.at >= 2400 ? { ...entry, at: entry.at + 38_500 } : entry)),
};

function play(recording: Recording, options: { abortAfter?: number } = {}) {
  const { clock, advance, now, pending } = fakeClock();
  const controller = new AbortController();
  const seen: { at: number; event: AiRunEvent; index: number }[] = [];
  let ended = 0;
  const schedule = replay(recording, {
    clock,
    signal: controller.signal,
    onEvent: (event, index) => {
      seen.push({ at: now(), event, index });
      if (options.abortAfter !== undefined && seen.length === options.abortAfter) controller.abort();
    },
    onEnd: () => {
      ended += 1;
    },
  });
  return { schedule, seen, advance, ended: () => ended, pending, controller };
}

describe("replaySchedule", () => {
  it("keeps every recorded offset when the planning wait is short", () => {
    const schedule = replaySchedule(SHORT);
    expect(schedule.events).toEqual(SHORT.events);
    expect(schedule.shortenedMs).toBeNull();
    expect(schedule.durationMs).toBe(2500);
  });

  it("cuts only the planning wait to 3 s and reports the real one", () => {
    const schedule = replaySchedule(LONG);
    expect(SHORT_PLAN_MS).toBe(3000);
    // Before and at "planning started": untouched.
    expect(schedule.events.slice(0, 4)).toEqual(LONG.events.slice(0, 4));
    // "Planning done" 3 s after it started, and everything after it moved up by the same amount.
    expect(schedule.events[4]?.at).toBe(900 + 3000);
    expect(schedule.events[5]?.at).toBe(900 + 3000 + 100);
    expect(schedule.shortenedMs).toBe(40_000);
    expect(schedule.durationMs).toBe(4000);
    expect(schedule.events.map((entry) => entry.event)).toEqual(LONG.events.map((entry) => entry.event));
  });

  it("reports the real wait a recording file already holds", () => {
    expect(replaySchedule({ ...SHORT, planShortenedFromMs: 41_000 }).shortenedMs).toBe(41_000);
    expect(replaySchedule({ ...LONG, planShortenedFromMs: 52_000 }).shortenedMs).toBe(52_000);
  });

  it("shortens the test data's long planning wait (the German and Arabic fixtures)", () => {
    for (const recording of [FIXTURES.de, FIXTURES.ar]) {
      if (!recording) throw new Error("fixture missing");
      const schedule = replaySchedule(recording);
      const start = recording.events.findIndex((entry) => entry.event.type === "step" && entry.event.key === "plan" && entry.event.state === "start");
      const startAt = recording.events[start]?.at ?? 0;
      expect(schedule.events[start + 1]?.at).toBe(startAt + SHORT_PLAN_MS);
      expect(schedule.shortenedMs).toBe((recording.events[start + 1]?.at ?? 0) - startAt);
      expect(schedule.durationMs).toBeLessThan(15_000);
    }
  });
});

describe("replay", () => {
  it("plays each event at its offset, events with the same offset together and in order, then ends", () => {
    const run = play(SHORT);
    run.advance(899);
    expect(run.seen.map((entry) => entry.at)).toEqual([0, 200]);
    run.advance(10_000);
    expect(run.seen.map((entry) => entry.at)).toEqual([0, 200, 900, 900, 2400, 2500]);
    expect(run.seen.map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(run.seen.map((entry) => entry.event)).toEqual(SHORT.events.map((entry) => entry.event));
    expect(run.ended()).toBe(1);
    expect(run.pending()).toBe(0);
  });

  it("plays the shortened planning wait and returns the figure to report", () => {
    const run = play(LONG);
    expect(run.schedule.shortenedMs).toBe(40_000);
    run.advance(60_000);
    expect(run.seen.map((entry) => entry.at)).toEqual([0, 200, 900, 900, 3900, 4000]);
    expect(run.ended()).toBe(1);
  });

  it("stops at once when aborted: no further event, no end, no timer left", () => {
    const run = play(SHORT, { abortAfter: 3 });
    run.advance(10_000);
    expect(run.seen).toHaveLength(3);
    expect(run.ended()).toBe(0);
    expect(run.pending()).toBe(0);

    const later = play(SHORT);
    later.advance(500);
    later.controller.abort();
    later.advance(10_000);
    expect(later.seen).toHaveLength(2);
    expect(later.ended()).toBe(0);
    expect(later.pending()).toBe(0);
  });

  it("does nothing when the signal is already aborted", () => {
    const { clock, advance, pending } = fakeClock();
    const controller = new AbortController();
    controller.abort();
    const seen: AiRunEvent[] = [];
    replay(SHORT, { clock, signal: controller.signal, onEvent: (event) => seen.push(event) });
    advance(10_000);
    expect(seen).toHaveLength(0);
    expect(pending()).toBe(0);
  });
});
