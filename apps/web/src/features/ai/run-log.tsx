"use client";

import { useTranslations } from "next-intl";

import { announcementKey, spokenSoFar, type Announcement } from "./announce";
import { stepDuration, type RunState } from "./run-reducer";
import { useStepText, wholeSeconds } from "./timeline";

/**
 * The run's polite log for screen readers: present (and empty) before the run, then one sentence
 * when a step starts or ends, as `announcementsFor` decides (at most 12 per run). Nothing per block,
 * per source or per second. Visually hidden; the screen shows the same in the timeline.
 *
 * It renders everything said so far (`spokenSoFar`), a list that only grows during a run, so each
 * sentence is added once and read once.
 */
export function RunLog({ state, now }: { state: RunState; now: number }) {
  const t = useTranslations("ai.run");
  const { name, detail } = useStepText();

  const sentence = (said: Announcement): string => {
    switch (said.kind) {
      case "stepStart":
        return t("announce.stepStart", { current: said.current, total: said.total, name: name(said.step) });
      case "colorsSkip":
        return `${t("steps.colors.skip")}.`;
      case "stillPlanning":
        return t("announce.stillPlanning", { seconds: said.seconds });
      case "stepDone": {
        if (said.step === "plan") return `${t("steps.plan.done", { seconds: wholeSeconds(stepDuration(state.steps.plan, now) ?? 0) })}.`;
        const line = detail(said.step, state, now);
        return line ? `${name(said.step)}: ${line}.` : `${name(said.step)}.`;
      }
    }
  };

  return (
    <div role="log" aria-live="polite" aria-relevant="additions" className="sr-only">
      {spokenSoFar(state, now).map((said) => (
        <p key={announcementKey(said)}>{sentence(said)}</p>
      ))}
    </div>
  );
}
