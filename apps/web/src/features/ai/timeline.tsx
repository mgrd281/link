"use client";

import { creatorTokens } from "@linkyo/tokens";
import { isTemplate, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cn, Icon, Spinner } from "@linkyo/ui";
import { Check, Circle, CircleDot, Globe, Lightbulb, Link2, ListOrdered, Minus, Palette, PenLine, SearchX, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AI_STEPS } from "./events";
import { shownState, stepDuration, type AiStepId, type RunNote, type RunPhoto, type RunSource, type RunState, type StepState, type StepStatus } from "./run-reducer";
import { sourceStatusLine } from "./source-lines";

/**
 * The run's seven steps as a list: a status glyph with its state in words (never colour alone), the
 * step's name, what it found, and how long it took. Shared by the build screen, the homepage replay
 * and the team console; semantic colour roles only, so it is grey in the dashboard and teal outside.
 */

/** The time now, once a second while `active` (the elapsed time and the running step's duration). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    // A quarter second first (a run just started), then once a second.
    const first = window.setTimeout(() => setNow(Date.now()), 250);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [active]);
  return now;
}

/** Western digits in every language (the app's numbers are Latin in Arabic too). */
const latn = (locale: string) => `${locale}-u-nu-latn`;

/** "1.2 s", "23 s", "1:05": short durations keep a decimal, long ones read as minutes. */
export function formatDuration(ms: number, locale: string): string {
  const seconds = ms / 1000;
  if (seconds >= 60) return formatClock(ms);
  return new Intl.NumberFormat(latn(locale), { style: "unit", unit: "second", unitDisplay: "narrow", maximumFractionDigits: seconds < 10 ? 1 : 0 }).format(seconds);
}

/** The elapsed time as a clock, "0:23" (always left to right, like any clock). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, "0")}`;
}

/** Whole seconds for sentences ("Planned in 38 s"); at least 1. */
export const wholeSeconds = (ms: number): number => Math.max(1, Math.round(ms / 1000));

/** Where the draft's accent comes from: the template, the photo, or a colour picked by name. */
export function accentSource(theme: CreatorThemeConfig, photo: RunPhoto | null): "template" | "photo" | "swatch" {
  const accent = theme.accent?.toLowerCase();
  if (!accent) return "template";
  if (photo && (accent === photo.vibrant.toLowerCase() || accent === photo.dominant.toLowerCase())) return "photo";
  return "swatch";
}

export const templateLabel = (theme: CreatorThemeConfig | null | undefined): string => {
  const id = theme?.template;
  return id && isTemplate(id) ? creatorTokens.templates[id].label : creatorTokens.templates.mono.label;
};

/** A step's name and the line under it, from the run's own counts. */
export function useStepText() {
  const t = useTranslations("ai.run");
  const name = (step: AiStepId) => t(`steps.${step}.name`);
  const detail = (step: AiStepId, state: RunState, now: number): string | null => {
    const entry = state.steps[step];
    const counts = entry.counts ?? {};
    switch (step) {
      case "read":
        return entry.state === "done" ? t("steps.read.done", { links: counts.links ?? 0, profiles: counts.profiles ?? 0 }) : null;
      case "details":
        if (entry.state === "skipped") return t("steps.details.skip");
        return entry.state === "done" ? t("steps.details.done", { count: counts.media ?? 0 }) : null;
      case "colors":
        return entry.state === "skipped" ? t("steps.colors.skip") : null;
      case "plan": {
        const ms = stepDuration(entry, now);
        return entry.state === "done" && ms !== null ? t("steps.plan.done", { seconds: wholeSeconds(ms) }) : null;
      }
      case "look":
        return state.look ? t("steps.look.done", { template: templateLabel(state.look.theme), accent: t(`accent.${accentSource(state.look.theme, state.photo)}`) }) : null;
      case "write": {
        if (entry.state === "pending") return null;
        const count = entry.state === "done" ? (counts.blocks ?? state.blocks.length) : state.blocks.length;
        return count > 0 ? t("steps.write.done", { count }) : null;
      }
      case "check":
        return entry.state === "done" ? t("steps.check.done", { fixed: counts.fixed ?? state.result?.fixed ?? 0, dropped: counts.dropped ?? state.result?.dropped ?? 0 }) : null;
    }
  };
  return { name, detail };
}

/**
 * A step's state as a glyph and a word. The word is for screen readers, except while running with
 * reduced motion: then the spinner gives way to a still dot and the word shows.
 */
export function StepGlyph({ status }: { status: StepStatus }) {
  const t = useTranslations("ai.run.state");
  const word = t(status);
  const glyph = (icon: LucideIcon, className?: string) => <Icon icon={icon} size="md" className={className} />;
  return (
    <span className="flex min-w-6 shrink-0 items-center gap-2">
      {/* Keyed by state: the new glyph fades in where the old one was. */}
      <span key={status} className="grid size-6 place-items-center motion-safe:animate-fade-in">
        {status === "pending" ? glyph(Circle, "text-fg-tertiary") : null}
        {status === "running" ? (
          <>
            {/* The spinner waits a moment before it shows (no flash for quick steps). */}
            <span className="motion-safe:animate-spinner-in motion-reduce:hidden">
              <Spinner className="size-icon-md text-fg" />
            </span>
            <span className="hidden motion-reduce:inline-flex">{glyph(CircleDot, "text-fg")}</span>
          </>
        ) : null}
        {status === "done" ? glyph(Check, "text-fg") : null}
        {status === "skipped" ? glyph(Minus, "text-fg-secondary") : null}
        {status === "failed" ? glyph(X, "text-danger-strong") : null}
      </span>
      <span className={cn("sr-only", status === "running" && "motion-reduce:not-sr-only motion-reduce:text-caption motion-reduce:font-medium motion-reduce:text-fg-secondary")}>{word}</span>
    </span>
  );
}

const SOURCE_ICONS: Record<RunSource["status"], LucideIcon> = { read: Check, handleOnly: Link2, skipped: Minus, failed: SearchX };

/** The sources the run read, as chips (addresses left to right in every language). */
export function SourceChips({ sources, className }: { sources: readonly RunSource[]; className?: string }) {
  const t = useTranslations("ai.run.source");
  if (sources.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {sources.map((source) => {
        const line = sourceStatusLine(source);
        return (
          <li key={source.id} className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption">
            <Icon icon={source.kind === "website" ? Globe : SOURCE_ICONS[source.status]} size="sm" className="shrink-0 text-fg-secondary" />
            <bdi dir="ltr" className="truncate font-medium">
              {source.label}
            </bdi>
            <span className="sr-only">: {t(line.key, line.values)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** What was read, one row per source with its honest line ("gelesen", "nur der Link", "robots.txt …"). */
export function SourceList({ sources }: { sources: readonly RunSource[] }) {
  const t = useTranslations("ai.run.source");
  return (
    <ul className="grid divide-y divide-line rounded-lg border border-line bg-surface">
      {sources.map((source) => {
        const line = sourceStatusLine(source);
        return (
          <li key={source.id} className="flex min-h-touch-target items-start gap-3 px-4 py-3">
            <Icon icon={source.kind === "website" ? Globe : SOURCE_ICONS[source.status]} size="md" className="mt-0.5 shrink-0 text-fg-secondary" />
            <span className="grid min-w-0 gap-0.5">
              <bdi dir="ltr" className="truncate text-small font-semibold">
                {source.label}
              </bdi>
              <span className="text-small text-fg-secondary">{t(line.key, line.values)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const NOTE_ICONS: Record<RunNote["topic"], LucideIcon> = { look: Palette, order: ListOrdered, copy: PenLine, missing: Lightbulb };

/** "Why like this?": the AI's short reasons, each with its topic's glyph and name. */
export function NotesList({ notes }: { notes: readonly RunNote[] }) {
  const t = useTranslations("app.ai.review.topics");
  return (
    <ul className="grid grid-cols-1 gap-3">
      {notes.map((note, index) => (
        <li key={`${note.topic}-${String(index)}`} className="flex items-start gap-3">
          <span className="grid size-control-sm shrink-0 place-items-center rounded-md bg-canvas-muted text-fg">
            <Icon icon={NOTE_ICONS[note.topic]} size="sm" />
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="text-caption font-semibold text-fg-secondary">{t(note.topic)}</span>
            <span dir="auto" className="text-small text-fg">
              {note.text}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function StepRow({ step, index, state, now, last }: { step: AiStepId; index: number; state: RunState; now: number; last: boolean }) {
  const locale = useLocale();
  const { name, detail } = useStepText();
  const entry: StepState = state.steps[step];
  const ms = entry.state === "pending" ? null : stepDuration(entry, now);
  const line = detail(step, state, now);
  const shown = shownState(state, step);
  return (
    <li data-step={step} data-state={entry.state} className={cn("flex min-h-touch-target items-start gap-3 px-4 py-3", !last && "border-b border-line")}>
      <StepGlyph status={shown} />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-baseline gap-3">
          <p className={cn("min-w-0 flex-1 text-body font-semibold", shown === "pending" && "text-fg-secondary")}>
            <span className="sr-only">{`${String(index + 1)}. `}</span>
            {name(step)}
          </p>
          {/* A step that took no measurable time (under 0.1 s) shows none, rather than "0 s". */}
          {ms !== null && (entry.state === "running" || (entry.state === "done" && ms >= 100)) ? (
            // The running step's clock ticks every second: seen, not read out.
            <span className="shrink-0 text-small text-fg-secondary tabular-nums" aria-hidden={entry.state === "running" ? true : undefined}>
              {formatDuration(ms, locale)}
            </span>
          ) : null}
        </div>
        {line ? <p className="text-small text-fg-secondary">{line}</p> : null}
        {step === "read" && state.sources.length > 0 ? <SourceChips sources={state.sources} className="pt-1" /> : null}
      </div>
    </li>
  );
}

/**
 * The seven steps. `peek` shows only the step the run is on and the one before (a phone's sheet
 * shows two rows); the whole list is one tap away.
 */
export function Timeline({ state, now, rows, className }: { state: RunState; now: number; rows?: readonly AiStepId[] | undefined; className?: string }) {
  const t = useTranslations("ai.run");
  const shown = rows ?? AI_STEPS;
  return (
    <ol aria-label={t("sheet.steps")} className={cn("grid rounded-lg border border-line bg-surface", className)}>
      {shown.map((step, i) => (
        <StepRow key={step} step={step} index={AI_STEPS.indexOf(step)} state={state} now={now} last={i === shown.length - 1} />
      ))}
    </ol>
  );
}
