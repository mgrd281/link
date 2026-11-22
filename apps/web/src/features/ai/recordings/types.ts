import type { AiRunEvent } from "../events";

export type RecordingLocale = "de" | "en" | "ar";

/** One event of a run with its offset from the run's start, in milliseconds. */
export interface RecordedEvent {
  at: number;
  event: AiRunEvent;
}

/**
 * An AI run's event stream as it happened, replayed on the homepage (a real recording) or on the
 * design page (test data). `real` comes from the production pipeline with a fictional persona; a
 * `fixture` is hand-written from the mock's fixtures and is never shown to visitors as a recording.
 */
export interface Recording {
  kind: "real" | "fixture";
  locale: RecordingLocale;
  /** When the run happened (ISO), for the recording chip's date. */
  recordedAt: string;
  /** Set when the file itself already holds a shortened planning wait: the real wait, in ms. */
  planShortenedFromMs: number | null;
  events: RecordedEvent[];
}
