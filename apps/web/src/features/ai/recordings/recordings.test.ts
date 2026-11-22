import { pageSchema } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { AI_STEPS } from "../events";
import { initialRunState, runReducer, stepsFinished, type RunState } from "../run-reducer";
import { FIXTURES, readRecording, RECORDINGS } from "./index";
import type { Recording } from "./types";

/** Feeds a recording's events through the run reducer, at their recorded offsets. */
function feed(recording: Recording): RunState {
  let state = runReducer(initialRunState(), { type: "start", at: 0, pageLocale: recording.locale });
  for (const { at, event } of recording.events) state = runReducer(state, { type: "event", event, at });
  return state;
}

const fixtures = Object.entries(FIXTURES).map(([locale, recording]) => [locale, recording] as const);

describe("recordings", () => {
  it("holds no real recording in phase 1, so the homepage's AI tab stays hidden", () => {
    expect(RECORDINGS).toEqual({});
  });

  it("has German and Arabic test data, each marked as a fixture in its own language", () => {
    expect(fixtures.map(([locale]) => locale).sort()).toEqual(["ar", "de"]);
    for (const [locale, recording] of fixtures) {
      expect(recording.kind).toBe("fixture");
      expect(recording.locale).toBe(locale);
      expect(Date.parse(recording.recordedAt)).not.toBeNaN();
    }
  });

  it.each(fixtures)("%s: every event is accepted by the run reducer, which ends in review with all seven steps finished", (_locale, recording) => {
    const state = feed(recording);
    const done = recording.events.at(-1)?.event;
    expect(done?.type).toBe("done");
    if (done?.type !== "done") return;
    expect(state.phase).toBe("review");
    expect(state.result).toBe(done);
    expect(stepsFinished(state)).toBe(AI_STEPS.length);
    expect(state.blocks).toEqual(done.page.blocks);
    expect(state.blocks.length).toBeGreaterThan(0);
    expect(state.sources.length).toBeGreaterThan(0);
    expect(state.notes.length).toBeGreaterThan(0);
    // Every block arrived before `done`, in page order, and the finished page is a valid page.
    const streamed = recording.events.flatMap(({ event }) => (event.type === "block" ? [event.block] : []));
    expect(streamed).toEqual(done.page.blocks);
    expect(pageSchema.safeParse(done.page).success).toBe(true);
    expect(done.page.profile.locale).toBe(recording.locale);
    expect(done.page.blocks.every((block) => block.origin === "ai")).toBe(true);
  });

  it.each(fixtures)("%s: offsets only go forward, and the run starts at 0", (_locale, recording) => {
    expect(recording.events[0]?.at).toBe(0);
    const offsets = recording.events.map((entry) => entry.at);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it("refuses a file that does not look like a recording", () => {
    const good = FIXTURES.de;
    expect(() => readRecording(null)).toThrow();
    expect(() => readRecording({ ...good, kind: "live" })).toThrow(/kind/);
    expect(() => readRecording({ ...good, locale: "fr" })).toThrow(/locale/);
    expect(() => readRecording({ ...good, recordedAt: "yesterday" })).toThrow(/recordedAt/);
    expect(() => readRecording({ ...good, events: [{ at: 5, event: { type: "run" } }, { at: 1, event: { type: "step" } }] })).toThrow(/event/);
    expect(readRecording(good)).toEqual(good);
  });
});
