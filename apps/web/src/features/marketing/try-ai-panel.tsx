"use client";

import { cn, Icon } from "@linkyo/ui";
import { ArrowRight, ChevronDown, CircleCheck, Globe, Link2, Play, RotateCcw, Square } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type RefObject, type SubmitEvent } from "react";

import { saveTryDraft } from "@/features/account/try-draft";
import { AI_STEPS } from "@/features/ai/events";
import { RECORDINGS, type Recording, type RecordingLocale } from "@/features/ai/recordings";
import { replay, replaySchedule } from "@/features/ai/replay";
import { currentStep, initialRunState, isLive, runReducer, stepsFinished, type RunState } from "@/features/ai/run-reducer";
import { AiRunView, type RunOwner } from "@/features/ai/run-view";
import { sourceChip } from "@/features/ai/source-lines";
import { Timeline, useNow, useStepText } from "@/features/ai/timeline";
import { useRouter } from "@/i18n/navigation";

/**
 * "Try it" with AI: a recorded AI run plays on the real run view (the dashboard's own, in teal), and
 * one field takes the visitor's link for their own free first draft after sign-up. Nothing here calls
 * the AI: the run is a recording (or, on the design page, test data), always labelled as such by the
 * run view itself, and it writes nothing to any live region (a replay is not news).
 *
 * Shown on the homepage only with NEXT_PUBLIC_AI_TRY and a real recording in the visitor's language
 * (features.tsx); in phase 1 there is none, so the design page's specimen is the only place it plays.
 */

export type ReplayStatus = "ready" | "playing" | "done";

export interface RecordingReplay {
  recording: Recording;
  state: RunState;
  status: ReplayStatus;
  /** The real planning wait when the replay shortened it (the run view says so). */
  shortenedMs: number | null;
  play: () => void;
  stop: () => void;
}

/** The whole run at once, timed as the replay plays it (so durations read the same either way). */
function finishedRun(recording: Recording): RunState {
  let state = runReducer(initialRunState(), { type: "start", at: 0, pageLocale: recording.locale });
  for (const { at, event } of replaySchedule(recording).events) state = runReducer(state, { type: "event", event, at });
  return state;
}

/** The page's address and the source chip for the run view: the run's own (a made-up persona's). */
export function recordingOwner(recording: Recording): RunOwner {
  for (const { event } of [...recording.events].reverse()) if (event.type === "done") return { username: event.page.profile.username };
  return { username: "draft" };
}

/**
 * A recording, played through the run reducer. It shows the finished run until it plays; it plays
 * once by itself when half of `target` is on screen (never with reduced motion, which keeps the
 * finished run and the Play button); Stop shows the finished run at once, so nothing keeps moving.
 */
export function useRecordingReplay(recording: Recording, target: RefObject<HTMLElement | null>): RecordingReplay {
  const [state, setState] = useState(() => finishedRun(recording));
  const [status, setStatus] = useState<ReplayStatus>("ready");
  const [shortenedMs, setShortenedMs] = useState(() => replaySchedule(recording).shortenedMs);
  const controller = useRef<AbortController | null>(null);
  const touched = useRef(false);

  const start = useCallback(() => {
    controller.current?.abort();
    const run = new AbortController();
    controller.current = run;
    setState(runReducer(initialRunState(), { type: "start", at: Date.now(), pageLocale: recording.locale }));
    setStatus("playing");
    const schedule = replay(recording, {
      signal: run.signal,
      onEvent: (event) => {
        setState((current) => runReducer(current, { type: "event", event, at: Date.now() }));
      },
      onEnd: () => {
        setStatus("done");
      },
    });
    setShortenedMs(schedule.shortenedMs);
  }, [recording]);

  const play = useCallback(() => {
    touched.current = true;
    start();
  }, [start]);

  const stop = useCallback(() => {
    touched.current = true;
    controller.current?.abort();
    controller.current = null;
    setState(finishedRun(recording));
    setStatus("done");
  }, [recording]);

  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });
  useEffect(() => {
    const element = target.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (!touched.current) startRef.current();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      controller.current?.abort();
    };
  }, [target]);

  return { recording, state, status, shortenedMs, play, stop };
}

/**
 * The recorded run on the dashboard's run view, in teal: its source chip (always: "Recording …" or
 * "Test data …"), the status strip, the timeline and the draft in a phone. One round button plays,
 * stops or replays it (WCAG 2.2.2); the replay announces nothing.
 */
export function TryAiStage({ replay: run, className }: { replay: RecordingReplay; className?: string }) {
  const t = useTranslations("ai.run");
  const { recording, state, status, shortenedMs } = run;
  const label = status === "playing" ? t("stopReplay") : status === "done" ? t("replay") : t("play");
  return (
    <div data-ai-replay={status} className={cn("relative", className)}>
      <button
        type="button"
        onClick={status === "playing" ? run.stop : run.play}
        className="absolute end-4 top-3 layer-raised grid size-touch-target place-items-center rounded-full border border-line-strong bg-surface text-fg transition-[background-color,scale] duration-micro hover:bg-hover focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none md:end-8"
      >
        {/* Media controls keep their direction in Arabic (play points right, the circle turns one way). */}
        <Icon key={status} icon={status === "playing" ? Square : status === "done" ? RotateCcw : Play} size="sm" className={cn("motion-safe:animate-fade-in", status === "playing" && "fill-current")} />
        <span className="sr-only">{label}</span>
      </button>
      <AiRunView
        state={state}
        source={recording.kind === "real" ? "recording" : "fixture"}
        recordedAt={recording.recordedAt}
        shortenedMs={shortenedMs}
        tone="brand"
        announce={false}
        owner={recordingOwner(recording)}
        stickyStrip={false}
        // The chip row keeps clear of the round button at its end.
        className="[&>:first-child]:pe-16"
      />
    </div>
  );
}

/** The homepage stage: the recording of the visitor's language, played when it comes into view. */
export function TryAiPlayStage({ onState, className }: { onState?: (state: RunState) => void; className?: string }) {
  const locale = useLocale() as RecordingLocale;
  const recording = RECORDINGS[locale];
  return recording ? <PlayStage recording={recording} onState={onState} className={className} /> : null;
}

function PlayStage({ recording, onState, className }: { recording: Recording; onState?: ((state: RunState) => void) | undefined; className?: string | undefined }) {
  const root = useRef<HTMLDivElement>(null);
  const run = useRecordingReplay(recording, root);
  useEffect(() => {
    onState?.(run.state);
  }, [onState, run.state]);
  return (
    <div ref={root} className={className}>
      <TryAiStage replay={run} />
    </div>
  );
}

/** The run in seven segments, filling from the start edge (the right in Arabic); for the eye only. */
function MiniProgress({ finished }: { finished: number }) {
  return (
    <span aria-hidden className="flex h-1 w-16 shrink-0 gap-0.5">
      {AI_STEPS.map((step, index) => (
        <span key={step} className={cn("h-full flex-1 rounded-full transition-colors duration-standard ease-standard motion-reduce:transition-none", index < finished ? "bg-link" : "bg-tinted")} />
      ))}
    </span>
  );
}

/**
 * The AI tab's controls: "Your link" with the honest line for what was recognised (what we can read
 * from it, and what not), the recorded run in one line (seven segments, the step it is on, "All steps"
 * for the whole timeline), and "Build it with AI, free". The button keeps the link for after sign-up
 * (try-draft.ts) and opens sign-up; without a recognised link it goes back to the field and says so
 * there (the field's description; nothing is announced on its own).
 */
export function TryAiPanel({
  state,
  source,
  onKeep,
  className,
}: {
  /** The recorded run on the stage (null while it loads). */
  state: RunState | null;
  source: "recording" | "fixture";
  /** Saves the try draft with this link (the playground adds what the visitor built in the other tabs). */
  onKeep?: (aiLink: string) => void;
  className?: string;
}) {
  const t = useTranslations("marketing.try.ai");
  const tRun = useTranslations("ai.run");
  const tPlatform = useTranslations("app.ai.platform");
  const { name } = useStepText();
  const router = useRouter();
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [empty, setEmpty] = useState(false);
  const [all, setAll] = useState(false);
  const chip = sourceChip(value);
  const now = useNow(state !== null && isLive(state) && all);

  const total = AI_STEPS.length;
  const step = state ? currentStep(state) : null;
  const current = step ? AI_STEPS.indexOf(step) + 1 : total;
  const stepName = step ? name(step) : tRun("state.done");
  const progress = source === "recording" ? t("slot", { current, total, name: stepName }) : `${tRun("progress", { current, total })}: ${stepName}`;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chip) {
      setEmpty(true);
      field.current?.focus();
      return;
    }
    if (onKeep) onKeep(chip.input);
    else saveTryDraft({ name: "", links: [], aiLink: chip.input });
    router.push("/signup?ai=1");
  };

  const hintId = `${id}-hint`;
  const stepsId = `${id}-steps`;
  return (
    <form noValidate onSubmit={submit} className={cn("grid grid-cols-1 gap-3", className)}>
      <div className="grid gap-2">
        <label htmlFor={`${id}-link`} className="px-1 text-caption font-semibold text-fg-secondary">
          {t("field")}
        </label>
        <div
          className={cn(
            "flex h-control-lg items-center gap-3 rounded-lg border bg-canvas-muted px-4 transition-[border-color,background-color] duration-micro ease-standard hover:border-line-strong has-[input:focus-visible]:border-focus has-[input:focus-visible]:bg-surface has-[input:focus-visible]:focus-field",
            empty ? "border-danger-strong" : "border-transparent",
          )}
        >
          <Icon icon={chip?.kind === "website" ? Globe : Link2} size="md" className="shrink-0 text-fg-tertiary" />
          <input
            ref={field}
            id={`${id}-link`}
            value={value}
            onChange={(event) => {
              setValue(event.target.value.slice(0, 300));
              setEmpty(false);
            }}
            // An address reads left to right; the empty field's hint follows the page's language.
            dir={value ? "ltr" : undefined}
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("placeholder")}
            aria-invalid={empty || undefined}
            aria-describedby={hintId}
            className="h-full min-w-0 flex-1 bg-transparent text-body outline-hidden placeholder:text-fg-tertiary"
          />
        </div>
      </div>

      {/* One slot: what the field recognised (or that it needs a link), else the recorded run in one line. */}
      <div className="flex min-h-control-sm items-center gap-3 px-1">
        {empty ? (
          <p id={hintId} className="text-small font-semibold text-danger-strong">
            {t("empty")}
          </p>
        ) : chip ? (
          <p id={hintId} key={chip.line} className="flex items-start gap-2 text-small text-pretty text-fg-secondary motion-safe:animate-fade-in">
            <Icon icon={CircleCheck} size="sm" className="mt-0.5 shrink-0 text-link" />
            {chip.line === "linktree" ? tRun("source.paste") : tPlatform(chip.line)}
          </p>
        ) : state ? (
          <>
            <MiniProgress finished={stepsFinished(state)} />
            <p id={hintId} className="min-w-0 flex-1 truncate text-small text-fg-secondary">
              {progress}
            </p>
            <button
              type="button"
              aria-expanded={all}
              aria-controls={stepsId}
              onClick={() => {
                setAll(!all);
              }}
              className="-me-2 inline-flex min-h-touch-target shrink-0 items-center gap-1 rounded-full px-2 text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
            >
              {t("all")}
              <Icon icon={ChevronDown} size="sm" className={cn("transition-transform duration-standard ease-standard motion-reduce:transition-none", all && "rotate-180")} />
            </button>
          </>
        ) : (
          <span id={hintId} />
        )}
      </div>
      {state && all && !chip && !empty ? (
        <div id={stepsId} className="motion-safe:animate-fade-in">
          <Timeline state={state} now={now} />
        </div>
      ) : (
        <div id={stepsId} hidden />
      )}

      <div className="grid gap-1">
        <button
          type="submit"
          className="group inline-flex h-control-lg items-center justify-center gap-2 rounded-full bg-primary px-6 text-body font-semibold text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed active:bg-primary-pressed motion-reduce:active:scale-none lg:h-control-xl"
        >
          {t("cta")}
          <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
        </button>
        <p className="text-center text-caption text-fg-secondary">{t("hint")}</p>
      </div>
    </form>
  );
}
