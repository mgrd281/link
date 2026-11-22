"use client";

import type { CreatorKind, Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { useCallback, useEffect, useReducer, useRef } from "react";

import type { SiteDoc } from "@/features/app/site-context";
import { accessToken } from "@/lib/supabase/access-token";

import { AI_STEPS, type AiErrorCode, type AiRunEvent } from "./events";
import { initialRunState, runReducer, type RunState } from "./run-reducer";
import { readRunEvents } from "./sse-client";

/**
 * Starts an AI run and follows it: `POST endpoint` answers a stream of server-sent events, each one
 * goes through `runReducer`. The run lives on the server, not in this tab, so:
 *  - a stream that breaks before the end is replaced by polling `GET <pollBase>/<id>` every 2 s
 *    (the screen says so with `app.ai.errors.offline`) until the run has a result;
 *  - Stop asks the server (`POST <pollBase>/<id>/stop`); the run keeps what it built and ends itself.
 * Used by the dashboard's build screen (`/api/ai/runs`) and the team console (its own endpoint).
 */

export const POLL_MS = 2000;

/**
 * A draft used from the welcome flow goes back to the welcome's "you" step, which publishes the page;
 * its toast with Undo is shown there, so the page as it was before the draft waits here meanwhile.
 */
let appliedFromWelcome: { before: SiteDoc; applied: SiteDoc } | null = null;
export function rememberAppliedDraft(handoff: { before: SiteDoc; applied: SiteDoc }): void {
  appliedFromWelcome = handoff;
}
export function takeAppliedDraft(): { before: SiteDoc; applied: SiteDoc } | null {
  const handoff = appliedFromWelcome;
  appliedFromWelcome = null;
  return handoff;
}
const DAY_MS = 86_400_000;
const DRAFT_DAYS = 7;

const ERROR_CODES: readonly AiErrorCode[] = ["quota", "busy", "budget", "limit", "failures", "refused", "timeout", "nothing", "invalid", "server", "disabled"];
const errorCodeOf = (value: unknown): AiErrorCode => (typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value) ? (value as AiErrorCode) : "server");

interface PolledRun {
  status?: string;
  progress?: unknown;
  counted?: boolean;
  errorCode?: string | null;
  result?: { page?: Page; theme?: CreatorThemeConfig; kind?: CreatorKind; notes?: unknown } | null;
}

/** What a polled run says, as the events the stream would have sent (progress steps, then the end). */
export function eventsFromPoll(runId: string, run: PolledRun, now: number, startedAt: number | null): AiRunEvent[] {
  const events: AiRunEvent[] = [];
  if (Array.isArray(run.progress)) {
    for (const entry of run.progress as { key?: unknown; state?: unknown; count?: unknown; ms?: unknown }[]) {
      if (!(AI_STEPS as readonly unknown[]).includes(entry.key) || typeof entry.state !== "string") continue;
      if (!["start", "done", "skip", "fail"].includes(entry.state)) continue;
      events.push({ type: "step", key: entry.key as (typeof AI_STEPS)[number], state: entry.state as "start" | "done" | "skip" | "fail", ...(typeof entry.ms === "number" ? { ms: entry.ms } : {}) });
    }
  }
  const result = run.result ?? null;
  if (run.status === "succeeded" && result?.page && result.theme && result.kind) {
    if (Array.isArray(result.notes)) events.push({ type: "notes", notes: result.notes as Extract<AiRunEvent, { type: "notes" }>["notes"] });
    events.push({
      type: "done",
      runId,
      page: result.page,
      theme: result.theme,
      kind: result.kind,
      fixed: 0,
      dropped: 0,
      fallback: false,
      counted: run.counted === true,
      expiresAt: new Date(now + DRAFT_DAYS * DAY_MS).toISOString(),
      ms: startedAt === null ? 0 : now - startedAt,
    });
  } else if (run.status === "stopped") {
    events.push({ type: "stopped", runId, page: result?.page ?? null, theme: result?.theme ?? null, kind: result?.kind ?? null, counted: run.counted === true });
  } else if (run.status === "failed" || run.status === "refused" || run.status === "succeeded") {
    events.push({ type: "error", code: run.status === "refused" ? "refused" : errorCodeOf(run.errorCode), counted: false });
  }
  return events;
}

const terminal = (event: AiRunEvent) => event.type === "done" || event.type === "stopped" || event.type === "error";

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function useAiRun(options: { endpoint: string; pollBase?: string }): { state: RunState; start: (body: unknown) => void; stop: () => void; reset: () => void } {
  const { endpoint, pollBase = "/api/ai/runs" } = options;
  const [state, dispatch] = useReducer(runReducer, undefined, initialRunState);
  // One generation per run: anything that belongs to an older run (a late answer, a poll) is ignored.
  const generation = useRef(0);
  const runId = useRef<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const stopWanted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const sendStop = useCallback(
    async (id: string) => {
      try {
        await fetch(`${pollBase}/${encodeURIComponent(id)}/stop`, { method: "POST", headers: await authHeaders() });
      } catch {
        // The run ends on its own; a lost stop request leaves it running to the end, never stuck.
      }
    },
    [pollBase],
  );

  const poll = useCallback(
    (run: number, id: string) => {
      clearTimer();
      timer.current = window.setTimeout(() => {
        void (async () => {
          if (run !== generation.current) return;
          try {
            const response = await fetch(`${pollBase}/${encodeURIComponent(id)}`, { headers: await authHeaders(), cache: "no-store" });
            if (run !== generation.current) return;
            if (response.status === 404 || response.status === 401) {
              dispatch({ type: "event", event: { type: "error", code: "server", counted: false }, at: Date.now() });
              return;
            }
            if (response.ok) {
              const events = eventsFromPoll(id, (await response.json()) as PolledRun, Date.now(), startedAt.current);
              for (const event of events) dispatch({ type: "event", event, at: Date.now() });
              if (events.some(terminal)) return;
            }
          } catch {
            // Still offline: try again.
          }
          if (run === generation.current) poll(run, id);
        })();
      }, POLL_MS);
    },
    [pollBase],
  );

  const start = useCallback(
    (body: unknown) => {
      generation.current += 1;
      const run = generation.current;
      controller.current?.abort();
      clearTimer();
      const abort = new AbortController();
      controller.current = abort;
      runId.current = null;
      stopWanted.current = false;
      const at = Date.now();
      startedAt.current = at;
      const request = body && typeof body === "object" ? (body as { pageLocale?: unknown; photo?: unknown }) : {};
      const locale = request.pageLocale;
      const photo = request.photo as { vibrant?: unknown; dominant?: unknown } | null | undefined;
      dispatch({
        type: "start",
        at,
        pageLocale: locale === "de" || locale === "en" || locale === "ar" ? locale : undefined,
        photo: photo && typeof photo.vibrant === "string" && typeof photo.dominant === "string" ? { vibrant: photo.vibrant, dominant: photo.dominant } : null,
      });
      const fail = (code: AiErrorCode) => {
        if (run === generation.current) dispatch({ type: "event", event: { type: "error", code, counted: false }, at: Date.now() });
      };
      void (async () => {
        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeaders()) },
            body: JSON.stringify(body),
            signal: abort.signal,
          });
        } catch {
          if (!abort.signal.aborted) fail("server");
          return;
        }
        if (run !== generation.current) return;
        // The route answers 404 when the AI is off, 401/400 for a request it cannot take; all else streams.
        if (!response.ok || !response.body || !(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
          fail(response.status === 404 ? "disabled" : "server");
          return;
        }
        const outcome = await readRunEvents(response.body, (event) => {
          if (run !== generation.current) return;
          if (event.type === "run") {
            runId.current = event.id;
            if (stopWanted.current) void sendStop(event.id);
          }
          dispatch({ type: "event", event, at: Date.now() });
        });
        if (run !== generation.current || abort.signal.aborted || outcome === "ended") return;
        // The stream broke before the end: the run goes on on the server; fetch its result.
        const id = runId.current;
        if (!id) {
          fail("server");
          return;
        }
        dispatch({ type: "offline", offline: true });
        poll(run, id);
      })();
    },
    [endpoint, poll, sendStop],
  );

  const stop = useCallback(() => {
    stopWanted.current = true;
    dispatch({ type: "stopRequested" });
    const id = runId.current;
    if (id) void sendStop(id);
  }, [sendStop]);

  const reset = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    clearTimer();
    runId.current = null;
    dispatch({ type: "reset" });
  }, []);

  // Leaving the screen ends this tab's part (the stream and the polling), never the run itself.
  useEffect(
    () => () => {
      generation.current += 1;
      controller.current?.abort();
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { state, start, stop, reset };
}
