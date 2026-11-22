"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

import { FIXTURES, type Recording, type RecordingLocale } from "@/features/ai/recordings";
import { TryAiPanel, TryAiStage, useRecordingReplay } from "@/features/marketing/try-ai-panel";

import { Section } from "./section";

/**
 * "Try it" with AI as it will look on the homepage once a real recording exists: the AI tab's
 * controls above the run view, which plays test data written from the mock's runs (German and Arabic;
 * English plays the German one). The run view labels it "Test data · not a real recording" at every
 * step and writes nothing to a live region. This page is the only place the replay renders in phase 1
 * (/design is not indexed); the homepage shows it only with a real recording.
 */
export function AiRunSection({ index }: { index: string }) {
  const t = useTranslations("marketing.try.ai");
  const locale = useLocale() as RecordingLocale;
  const recording = FIXTURES[locale] ?? FIXTURES.de;
  return (
    <Section id="ai-run" index={index} title={t("tabLabel")} description={t("lead")}>
      {recording ? <Specimen recording={recording} /> : null}
    </Section>
  );
}

function Specimen({ recording }: { recording: Recording }) {
  const stage = useRef<HTMLDivElement>(null);
  const run = useRecordingReplay(recording, stage);
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface">
      <TryAiPanel state={run.state} source={recording.kind === "real" ? "recording" : "fixture"} className="w-full max-w-prose p-4 md:p-6" />
      <div ref={stage} className="border-t border-line bg-canvas pb-6">
        <TryAiStage replay={run} />
      </div>
    </div>
  );
}
