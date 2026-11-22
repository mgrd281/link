"use client";

import { cn } from "@linkyo/ui";
import { useTranslations } from "next-intl";

import { AI_STEPS } from "./events";
import { currentStep, runElapsed, stepsFinished, type RunState } from "./run-reducer";
import { formatClock, StepGlyph, useStepText } from "./timeline";

/**
 * The run at a glance, flush under the screen's header (sticky `top-16`, solid ground): the step it
 * is on, the elapsed time and seven segments that fill from the start edge (the right in Arabic).
 * The time is for the eye (it changes every second); the bar tells screen readers the step.
 */
export function StatusStrip({ state, now, sticky = true }: { state: RunState; now: number; sticky?: boolean }) {
  const t = useTranslations("ai.run");
  const { name } = useStepText();
  const total = AI_STEPS.length;
  const finished = stepsFinished(state);
  const step = currentStep(state);
  const current = step ? AI_STEPS.indexOf(step) + 1 : total;
  const stopping = state.phase === "stopping";
  const label = stopping ? t("stopping") : step ? name(step) : name(AI_STEPS[total - 1] ?? "check");
  const progress = t("progress", { current, total });
  return (
    <div data-status-strip className={cn("border-b border-line bg-canvas", sticky && "sticky top-16 layer-sticky")}>
      <div className="mx-auto grid max-w-content gap-2 px-4 py-2 md:px-8">
        <div className="flex min-h-control-sm items-center gap-3">
          {step && state.phase !== "stopped" && state.phase !== "error" ? <StepGlyph status={stopping ? "running" : state.steps[step].state} /> : null}
          <p className="min-w-0 flex-1 truncate text-small font-semibold">{label}</p>
          <p aria-hidden className="shrink-0 text-small text-fg-secondary tabular-nums" dir="ltr">
            {formatClock(runElapsed(state, now))}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={t("sheet.steps")}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={finished}
            aria-valuetext={`${progress}: ${label}`}
            data-progress-track
            className="flex h-1 flex-1 gap-1"
          >
            {AI_STEPS.map((key, index) => (
              <span
                key={key}
                data-segment={index}
                data-filled={index < finished ? "" : undefined}
                className={cn("h-full flex-1 rounded-full transition-colors duration-standard ease-standard motion-reduce:transition-none", index < finished ? "bg-link" : "bg-tinted")}
              />
            ))}
          </div>
          <p aria-hidden className="shrink-0 text-caption text-fg-secondary tabular-nums">
            {progress}
          </p>
        </div>
      </div>
    </div>
  );
}
