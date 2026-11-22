"use client";

import { NO_IMAGE, type Page, type Profile } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { Button, cn, Icon } from "@linkyo/ui";
import { CirclePlay, FlaskConical, Sparkles } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { tokens } from "@linkyo/tokens";

import { Tabs } from "@/features/app/tabs";
import { useMediaQuery } from "@/features/app/use-media-query";

import { DRAFT_PHONE_HEIGHT, DraftChip, DraftColumns, DraftPhone } from "./draft-phone";
import { AI_STEPS } from "./events";
import { RunLog } from "./run-log";
import { currentStep, draftOf, isLive, type AiStepId, type RunState } from "./run-reducer";
import { StatusStrip } from "./status-strip";
import { NotesList, SourceList, templateLabel, Timeline, useNow } from "./timeline";

/** The look of a page before the AI chose one: black and white, so the colours arrive with the look. */
const NEUTRAL_THEME: CreatorThemeConfig = { template: "mono" };
/** From the lg breakpoint the timeline and the phone sit side by side (in rem, as the generated CSS). */
const WIDE_QUERY = `(width >= ${tokens.breakpoint.lg / 16}rem)`;

export interface RunOwner {
  /** The page's address (shown on the draft as it will be). */
  username: string;
  /** A name to show until the AI's profile arrives. */
  name?: string | undefined;
  /** The picture on the draft (the owner's photo, or the one picked for the colours). */
  avatar?: Profile["avatar"] | undefined;
}

/** The draft so far as a page for the phone: the AI's profile on the owner's address and picture. */
export function draftPage(state: RunState, owner: RunOwner, fallbackLocale: "de" | "en" | "ar"): { page: Page; theme: CreatorThemeConfig } {
  const draft = draftOf(state);
  const locale = state.result?.page.profile.locale ?? state.pageLocale ?? fallbackLocale;
  const avatar = owner.avatar ?? state.result?.page.profile.avatar ?? { src: NO_IMAGE, alt: "" };
  const profile: Profile = {
    ...(state.result?.page.profile ?? {}),
    username: owner.username,
    displayName: [draft.profile?.displayName, owner.name, owner.username].find((name) => name !== undefined && name.trim() !== "") ?? owner.username,
    bio: draft.profile?.bio ?? "",
    ...(draft.profile?.tagline ? { tagline: draft.profile.tagline } : {}),
    ...(draft.profile?.location ? { location: draft.profile.location } : {}),
    avatar,
    verified: false,
    locale,
  };
  return { page: { profile, blocks: draft.blocks }, theme: draft.theme ?? NEUTRAL_THEME };
}

/** The two rows a phone's sheet shows: the step before and the one the run is on. */
function peekRows(state: RunState): AiStepId[] {
  const step = currentStep(state) ?? AI_STEPS[AI_STEPS.length - 1] ?? "check";
  const index = AI_STEPS.indexOf(step);
  return AI_STEPS.slice(Math.max(0, index - 1), Math.max(0, index - 1) + 2);
}

function PeekTimeline({ state, now }: { state: RunState; now: number }) {
  const t = useTranslations("ai.run.sheet");
  const [all, setAll] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-2">
      <Timeline state={state} now={now} rows={all ? undefined : peekRows(state)} />
      <Button variant="ghost" size="sm" className="justify-self-start" aria-expanded={all} onClick={() => setAll(!all)}>
        {t("all")}
      </Button>
    </div>
  );
}

type SheetTab = "steps" | "read" | "why";

/**
 * An AI run as it happens, from its events only: the status strip, the timeline (with the sources it
 * read and the AI's reasons) and the draft in a phone. Shared by the dashboard's build screen, the
 * homepage replay (a recording or test data, always labelled as such) and the team console.
 *
 * - `source`: anything but "live" shows the recording or test-data chip; no prop hides it.
 * - `tone`: "console" sits in the black-and-grey dashboard; "brand" on teal pages (no data-console).
 * - `onStop`: a Stop button under the timeline; without it there is none (replays, or a host whose own
 *   button turns into Stop).
 * - `announce`: false writes nothing to any live region (no log, status or alert), for replays.
 * - `review`: what shows once the draft is ready (or stopped with blocks), in place of the run.
 */
export function AiRunView({
  state,
  source,
  recordedAt,
  shortenedMs,
  tone,
  onStop,
  announce,
  owner,
  review,
  stickyStrip = true,
  className,
}: {
  state: RunState;
  source: "live" | "recording" | "fixture";
  recordedAt?: string | undefined;
  shortenedMs?: number | null | undefined;
  tone: "console" | "brand";
  onStop?: (() => void) | undefined;
  announce: boolean;
  owner?: RunOwner | undefined;
  review?: ReactNode;
  stickyStrip?: boolean | undefined;
  className?: string | undefined;
}) {
  const t = useTranslations("ai.run");
  const format = useFormatter();
  const locale = useLocale() as "de" | "en" | "ar";
  const live = isLive(state);
  const now = useNow(live);
  const wide = useMediaQuery(WIDE_QUERY);
  const [tab, setTab] = useState<SheetTab>("steps");
  const { page, theme } = draftPage(state, owner ?? { username: "draft" }, locale);
  const showReview = review !== undefined && (state.phase === "review" || (state.phase === "stopped" && state.blocks.length > 0));
  const newest = state.blocks.at(-1)?.id ?? null;

  const chip =
    source === "live" ? null : (
      <div className="mx-auto flex w-full max-w-content flex-wrap items-center gap-2 px-4 pt-4 md:px-8">
        <p data-run-source={source} className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-caption font-semibold">
          <Icon icon={source === "recording" ? CirclePlay : FlaskConical} size="sm" />
          {source === "recording"
            ? t("recordingChip", { date: recordedAt ? format.dateTime(new Date(recordedAt), { day: "numeric", month: "long", year: "numeric" }) : "" })
            : t("fixtureChip")}
        </p>
        {typeof shortenedMs === "number" ? <p className="text-caption text-fg-secondary">{t("shortened", { seconds: Math.round(shortenedMs / 1000) })}</p> : null}
      </div>
    );

  const phone = (
    <>
      <DraftChip>
        <Icon icon={Sparkles} size="sm" />
        {t("draftChip")}
      </DraftChip>
      <DraftPhone page={page} theme={theme} label={t("phone")} busy={live && state.look !== null} followId={live ? newest : null} className={DRAFT_PHONE_HEIGHT.run} />
    </>
  );

  const stop = onStop ? (
    <div className="grid grid-cols-1 gap-2">
      <Button
        variant="tinted"
        size="lg"
        className="justify-self-start"
        aria-disabled={state.phase === "stopping" || undefined}
        onClick={() => {
          if (state.phase === "running") onStop();
        }}
      >
        {state.phase === "stopping" ? t("stopping") : t("stop")}
      </Button>
      <p className="text-small text-fg-secondary">{t("stopCounts")}</p>
    </div>
  ) : null;

  const why = state.notes.length > 0 ? <NotesList notes={state.notes} /> : null;
  const read = state.sources.length > 0 ? <SourceList sources={state.sources} /> : null;
  const tabs: { value: SheetTab; label: string }[] = [
    { value: "steps", label: t("sheet.steps") },
    ...(read ? [{ value: "read" as const, label: t("sheet.read") }] : []),
    ...(why ? [{ value: "why" as const, label: t("sheet.why") }] : []),
  ];

  return (
    <div data-console={tone === "console" ? "local" : undefined} data-ai-run data-phase={state.phase} className={cn("min-w-0 text-fg", className)}>
      {chip}
      {showReview ? (
        review
      ) : (
        <>
          <StatusStrip state={state} now={now} sticky={stickyStrip} />
          <DraftColumns phone={phone}>
            {wide ? (
              <>
                <Timeline state={state} now={now} />
                {stop}
                {why ? (
                  <section className="grid grid-cols-1 gap-3">
                    <h2 className="text-small font-semibold text-fg-secondary">{t("sheet.why")}</h2>
                    {why}
                  </section>
                ) : null}
              </>
            ) : (
              // Phones: a sheet under the phone, peeking at two rows of the timeline.
              <div className="grid grid-cols-1 gap-4 rounded-t-xl border border-line bg-surface p-4">
                {/* Only tabs with something in them: "What we read" once sources are in, "Why" once the AI said why. */}
                <Tabs
                  label={t("sheet.steps")}
                  value={tabs.some((option) => option.value === tab) ? tab : "steps"}
                  onValueChange={setTab}
                  tabs={tabs}
                >
                  {(value) => (value === "read" ? read : value === "why" ? why : <PeekTimeline state={state} now={now} />)}
                </Tabs>
                {stop}
              </div>
            )}
          </DraftColumns>
        </>
      )}
      {announce ? <RunAnnouncer state={state} /> : null}
    </div>
  );
}

/**
 * What a run says to screen readers: the polite log of its steps (at most 12 sentences) and one
 * status sentence at its end (ready, or stopped). A host that has a run on its screen before the run
 * starts mounts this there, so the live regions exist (empty) before anything is said; AiRunView
 * mounts it itself with `announce`.
 */
export function RunAnnouncer({ state }: { state: RunState }) {
  const t = useTranslations("ai.run");
  const now = useNow(isLive(state));
  const final =
    state.phase === "review" && state.result
      ? t("announce.ready", { blocks: state.result.page.blocks.length, template: templateLabel(state.result.theme) })
      : state.phase === "stopped"
        ? t("stopped", { count: state.blocks.length })
        : "";
  return (
    <>
      <RunLog state={state} now={now} />
      <p role="status" className="sr-only">
        {final}
      </p>
    </>
  );
}
