import type { AiRunEvent } from "../events";
import fixtureAr from "./fixture-ar.json";
import fixtureDe from "./fixture-de.json";
import type { RecordedEvent, Recording, RecordingLocale } from "./types";

export type { RecordedEvent, Recording, RecordingLocale } from "./types";

const LOCALES: readonly RecordingLocale[] = ["de", "en", "ar"];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * A recording file as the app reads it. JSON has no types, so its outline is checked here (kind,
 * language, date, offsets in order, each event with a type); what each event holds is the pipeline's
 * contract and is checked by recordings.test.ts against the run reducer.
 */
export function readRecording(value: unknown): Recording {
  if (!isObject(value)) throw new Error("recording: not an object");
  const { kind, locale, recordedAt, planShortenedFromMs, events } = value;
  if (kind !== "real" && kind !== "fixture") throw new Error("recording: kind");
  if (!LOCALES.includes(locale as RecordingLocale)) throw new Error("recording: locale");
  if (typeof recordedAt !== "string" || Number.isNaN(Date.parse(recordedAt))) throw new Error("recording: recordedAt");
  if (planShortenedFromMs !== null && typeof planShortenedFromMs !== "number") throw new Error("recording: planShortenedFromMs");
  if (!Array.isArray(events)) throw new Error("recording: events");
  let last = 0;
  const list = events.map((entry: unknown): RecordedEvent => {
    if (!isObject(entry) || typeof entry.at !== "number" || entry.at < last || !isObject(entry.event) || typeof entry.event.type !== "string") throw new Error("recording: event");
    last = entry.at;
    return { at: entry.at, event: entry.event as unknown as AiRunEvent };
  });
  return { kind, locale: locale as RecordingLocale, recordedAt, planShortenedFromMs, events: list };
}

/**
 * Real recordings of the production pipeline, one per language. Empty in phase 1: no real run has
 * been recorded yet, so the homepage's AI tab stays hidden (playground.tsx).
 */
export const RECORDINGS: Partial<Record<RecordingLocale, Recording>> = {};

/**
 * Test data for the design page: hand-written from the mock's de-music and ar-coach fixtures, with
 * the timings of a real run. Always labelled "Test data · not a real recording" where it plays.
 */
export const FIXTURES: Partial<Record<RecordingLocale, Recording>> = {
  de: readRecording(fixtureDe),
  ar: readRecording(fixtureAr),
};
