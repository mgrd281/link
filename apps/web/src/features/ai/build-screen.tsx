"use client";

import { isKind, type Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { Button, cn, Icon, IconButton, Skeleton, toast } from "@linkyo/ui";
import { ArrowRight, CircleAlert, Sparkles, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { accountStore } from "@/features/account/store";
import { readTryDraft } from "@/features/account/try-draft";
import { storePreparedImage } from "@/features/app/media-upload";
import { useSite, type SiteDoc } from "@/features/app/site-context";
import { useScrolled } from "@/features/app/use-scrolled";
import { formatEuro, PRICES } from "@/features/payments/prices";
import { Link, useRouter } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";
import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/config";

import { addSources, BuildInput, emptyInputs, QuotaLine, type BuildErrors, type BuildInputs } from "./build-input";
import { DraftChip } from "./draft-phone";
import type { AiErrorCode } from "./events";
import { ProSheet } from "./pro-sheet";
import { needsPro, useAiQuota, type AiQuota } from "./quota";
import { DraftReview, type ReviewDraft } from "./review";
import { isLive } from "./run-reducer";
import { AiRunView, RunAnnouncer } from "./run-view";
import { anyReadable, pastedLinks, sourceChip } from "./source-lines";
import { wholeSeconds } from "./timeline";
import { rememberAppliedDraft, useAiRun } from "./use-ai-run";

type Locale = "de" | "en" | "ar";

/** The message of a run-ending error; quota depends on the plan (Pro: until next month, no offer). */
function useErrorText() {
  const t = useTranslations("app.ai.errors");
  const format = useFormatter();
  return (code: AiErrorCode, quota: AiQuota | null) => {
    if (code !== "quota") return t(code);
    if (quota?.plan === "pro") {
      return t("quotaPro", { count: quota.allowance, date: quota.resetsAt ? format.dateTime(new Date(quota.resetsAt), { day: "numeric", month: "long" }) : "" });
    }
    return t("quotaFree");
  };
}

/** The standalone way out ("Continue without AI"): body-coloured, bold, with an arrow. */
function WithoutAi({ href, className }: { href: string; className?: string }) {
  const t = useTranslations("app.ai");
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-touch-target items-center gap-2 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring",
        className,
      )}
    >
      {t("continueWithout")}
      <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
    </Link>
  );
}

/**
 * Build with AI (`/app/build`): a full-screen task, outside the dashboard's rail, black and grey.
 *
 *  - input: the owner's links, a sentence, a name, a photo for colours, the page's language, and the
 *    quota line, all before anything starts (no surprise afterwards);
 *  - running: the run as it happens (AiRunView); the Build button became Stop in place, so focus
 *    stays on it; Stop keeps what was built;
 *  - review: the draft with its blocks, other looks and what was read; Use this page, New draft,
 *    Discard. Using it replaces the page in one undoable step and never publishes it by itself: from
 *    the welcome flow the owner first picks the name and address of their page.
 */
export function BuildScreen() {
  const t = useTranslations("app.ai");
  const tApp = useTranslations("app");
  const tRun = useTranslations("ai.run");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();
  const params = useSearchParams();
  const { account, site, doc, dispatch, latest } = useSite();
  const quotaView = useAiQuota({ account: account.id, fresh: true });
  const { quota } = quotaView;
  const { state, start, stop, reset } = useAiRun({ endpoint: "/api/ai/runs" });
  const scrolled = useScrolled();
  const errorText = useErrorText();

  const welcome = !site.onboarded;
  const back = welcome ? "/app/welcome" : "/app";
  const without = welcome ? "/app/welcome?manual=1" : "/app/editor";
  // A link from the homepage or the welcome flow fills in the first source.
  const [link] = useState(() => params.get("link") ?? readTryDraft()?.aiLink ?? undefined);
  const [inputs, setInputs] = useState<BuildInputs>(() => emptyInputs(locale, link));
  const [errors, setErrors] = useState<BuildErrors>({});
  const [proOpen, setProOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [quotaNote, setQuotaNote] = useState(false);
  const [edited, setEdited] = useState<{ page: Page; theme: CreatorThemeConfig } | null>(null);
  const aboutRef = useRef<HTMLTextAreaElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Whether the Build/Stop button had focus last (it may be gone by the time the draft is ready).
  const primaryFocused = useRef(false);

  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      primaryFocused.current = event.target === primary.current;
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);

  const phase = state.phase;
  const stoppedWithBlocks = phase === "stopped" && state.blocks.length > 0;
  const reviewing = phase === "review" || stoppedWithBlocks;

  // The draft is ready: focus goes to its heading, but only if it was still on Stop (never from a
  // field the owner went to). The quota is asked again (the run may have counted).
  useEffect(() => {
    if (!reviewing) return;
    // The review starts at its top: the summary and, on phones, the phone above it.
    window.scrollTo({ top: 0 });
    if (primaryFocused.current) heading.current?.focus({ preventScroll: true });
  }, [reviewing]);
  const ended = phase === "review" || phase === "stopped" || phase === "error";
  const { refresh } = quotaView;
  useEffect(() => {
    if (ended) void refresh();
  }, [ended, refresh]);

  const pro = quota?.plan === "pro";
  const zero = quota !== null && quota.left <= 0;

  const begin = () => {
    let next = inputs;
    if (inputs.pending.trim()) {
      const added = addSources(inputs, inputs.pending);
      next = added.inputs;
      setInputs(next);
      if (added.error) {
        setErrors({ ...errors, sources: added.error });
        return;
      }
    }
    if (needsPro(quota)) {
      setProOpen(true);
      return;
    }
    if (zero) return;
    const chips = next.sources.map(sourceChip).filter((chip) => chip !== null);
    const about = next.about.trim();
    // Without a source the server can read, the sentence is what the AI works from.
    if (!about && !anyReadable(chips)) {
      setErrors({ ...errors, about: true });
      aboutRef.current?.focus();
      return;
    }
    setErrors({});
    setEdited(null);
    setQuotaNote(false);
    const name = next.name.trim();
    start({
      mode: welcome ? "welcome" : "dashboard",
      pageLocale: next.pageLocale,
      ownerLocale: locale,
      about,
      ...(name ? { name } : {}),
      kind: isKind(site.kind) ? site.kind : null,
      sources: chips.map((chip) => chip.input),
      pasted: pastedLinks(next.pasted),
      photo: next.photo?.colors ?? null,
    });
    // The run starts at the top of the screen: the strip, the phone, the steps.
    window.scrollTo({ top: 0 });
  };

  // Autostart once: a link from the homepage or the welcome flow that the server can read, with a
  // draft left. Instagram and co (nothing to read) open the form with the sentence to write.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !link || quotaView.status === "loading") return;
    if (!quotaView.enabled || !quota || quota.left <= 0) return;
    const chips = inputs.sources.map(sourceChip).filter((chip) => chip !== null);
    // Started from a callback once the screen is on (the run's first state is not set during an effect).
    const timer = window.setTimeout(() => {
      auto.current = true;
      if (anyReadable(chips)) begin();
      else aboutRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
    // `begin` reads the inputs of this render; this runs once, when the quota is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotaView.status]);

  const again = () => {
    if (needsPro(quota)) {
      setProOpen(true);
      return;
    }
    if (pro && zero) {
      setQuotaNote(true);
      return;
    }
    reset();
  };

  const discard = () => {
    reset();
    toast({ title: t("discarded") });
  };

  // The draft as reviewed: the finished one, or what a stop kept; the picked photo is its picture.
  const draft = useMemo<ReviewDraft | null>(() => {
    const source = state.result ?? (stoppedWithBlocks && state.stopped?.page && state.stopped.theme ? { page: state.stopped.page, theme: state.stopped.theme, kind: state.stopped.kind } : null);
    if (!source) return null;
    const avatar = inputs.photo ? { src: inputs.photo.prepared.src, alt: "", tone: inputs.photo.prepared.tone } : doc.profile.avatar;
    return { page: { ...source.page, profile: { ...source.page.profile, username: account.username, avatar } }, theme: source.theme, kind: source.kind };
  }, [state.result, state.stopped, stoppedWithBlocks, inputs.photo, doc.profile.avatar, account.username]);

  const apply = async () => {
    if (!draft || applying) return;
    const use = edited ?? { page: draft.page, theme: draft.theme };
    setApplying(true);
    let avatar = doc.profile.avatar;
    if (inputs.photo) {
      try {
        const stored = await storePreparedImage(inputs.photo.prepared);
        avatar = { src: stored.src, alt: "", tone: stored.tone };
      } catch {
        setApplying(false);
        toast({ title: tApp("form.imageErrors.upload"), tone: "danger" });
        return;
      }
    }
    const before = latest();
    const applied: SiteDoc = { profile: { ...use.page.profile, username: account.username, avatar }, blocks: use.page.blocks, sizes: {}, theme: use.theme };
    dispatch({ type: "replace", doc: applied });
    if (draft.kind && isKind(draft.kind)) {
      const kind = draft.kind;
      // `kind` only: using a draft never marks the welcome as done (the address is picked first).
      accountStore.updateSite((current) => ({ ...current, kind }));
    }
    const runId = state.result?.runId ?? state.stopped?.runId;
    if (runId && supabaseEnabled) void browserSupabase().rpc("ai_mark_applied", { run: runId });
    if (welcome) {
      rememberAppliedDraft({ before, applied });
      router.push("/app/welcome?from=ai");
      return;
    }
    toast({
      title: t("applied"),
      tone: "success",
      action: {
        label: tApp("undo"),
        // The draft is undone as one step; after more changes, the page as it was comes back.
        onAction: () => dispatch(latest() === applied ? { type: "undo" } : { type: "replace", doc: before }),
      },
    });
    router.push("/app/editor");
  };

  const unavailable = quotaView.status === "off" && phase === "input";
  const loading = quotaView.status === "loading" && phase === "input";
  const showFooter = !reviewing && !unavailable;
  const quotaId = "ai-quota-line";
  const stopCountsId = "ai-stop-counts";

  // The one button at the bottom: Build, then Stop (the same element, so focus stays), then Try again.
  const button =
    phase === "input" ? (
      <Button
        ref={primary}
        variant="primary"
        size="cta"
        className="w-full sm:w-auto"
        disabled={loading || (pro && zero)}
        aria-describedby={pro && zero ? quotaId : undefined}
        onClick={begin}
      >
        {t("start")}
      </Button>
    ) : isLive(state) ? (
      <Button
        ref={primary}
        variant="tinted"
        size="cta"
        className="w-full sm:w-auto"
        aria-disabled={phase === "stopping" || undefined}
        aria-describedby={stopCountsId}
        onClick={() => {
          if (phase === "running") stop();
        }}
      >
        {phase === "stopping" ? tRun("stopping") : tRun("stop")}
      </Button>
    ) : (
      <Button ref={primary} variant="primary" size="cta" className="w-full sm:w-auto" onClick={() => reset()}>
        {t("actions.retry")}
      </Button>
    );

  const owner = { username: account.username, name: inputs.name.trim() || doc.profile.displayName, avatar: inputs.photo ? { src: inputs.photo.prepared.src, alt: "" } : doc.profile.avatar };
  const result = state.result;

  const review =
    reviewing && draft ? (
      <DraftReview
        kind="ai"
        draft={draft}
        before={site.onboarded ? { page: { profile: doc.profile, blocks: doc.blocks }, theme: doc.theme } : null}
        notes={state.notes}
        sources={state.sources}
        headingRef={heading}
        onChange={setEdited}
        chip={
          <DraftChip>
            <Icon icon={Sparkles} size="sm" />
            {tRun("draftChip")}
          </DraftChip>
        }
        summary={
          <>
            {result ? <p>{t("review.summary", { seconds: wholeSeconds(result.ms), blocks: result.page.blocks.length, fixed: result.fixed })}</p> : <p>{tRun("stopped", { count: state.blocks.length })}</p>}
            {result ? <p>{t("review.expires", { date: format.dateTime(new Date(result.expiresAt), { day: "numeric", month: "long" }) })}</p> : null}
            <p className="flex items-center gap-2 font-medium text-fg">
              <Icon icon={Sparkles} size="sm" className="shrink-0" />
              {t("review.disclosure")}
            </p>
          </>
        }
        above={site.onboarded ? <p className="text-small text-fg-secondary">{t("actions.applyHint")}</p> : null}
        actions={
          <div className="mx-auto grid max-w-prose grid-cols-1 gap-2 lg:mx-0">
            <Button variant="primary" size="cta" className="w-full" loading={applying} onClick={() => void apply()}>
              {t("actions.apply")}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {/* Equal halves: the quieter actions use the smaller type, so "New draft · 4 left" fits a phone. */}
              <Button variant="tinted" size="lg" className="min-w-0 px-3 text-small" onClick={again}>
                {quota && quota.left > 0 ? t("actions.againLeft", { count: quota.left }) : t("actions.again")}
              </Button>
              <Button variant="ghost" size="lg" className="min-w-0 px-3 text-small" onClick={discard}>
                {t("actions.discard")}
              </Button>
            </div>
            {quotaNote && quota ? (
              <p role="status" className="text-small text-fg-secondary">
                {errorText("quota", quota)}
              </p>
            ) : null}
          </div>
        }
        below={
          paymentsEnabled ? (
            <Link
              href="/service"
              className="inline-flex min-h-touch-target items-center gap-2 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring"
            >
              {t("service", { price: formatEuro(PRICES["service-start"].amountCents, locale) })}
              <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
            </Link>
          ) : null
        }
      />
    ) : undefined;

  return (
    // data-console="frame": part of the dashboard, black and grey from the first paint (ADR 0062).
    <div data-console="frame" data-build-screen className="flex min-h-dvh flex-col bg-canvas text-fg">
      <header data-scrolled={scrolled ? "" : undefined} className={cn("sticky top-0 layer-sticky h-16 bg-canvas", scrolled && !isLive(state) && "border-b border-line")}>
        <div className="mx-auto flex h-full max-w-content items-center gap-2 pr-[max(var(--spacing-2),env(safe-area-inset-right))] pl-[max(var(--spacing-2),env(safe-area-inset-left))] md:px-6">
          <IconButton icon={X} label={t("header.close")} onClick={() => router.push(back)} />
          <h1 className="min-w-0 flex-1 truncate text-body-lg font-semibold">{t("header.title")}</h1>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tinted px-3 py-1 text-caption font-semibold text-tinted-fg">
            <Icon icon={Sparkles} size="sm" />
            {t("header.label")}
          </span>
        </div>
      </header>

      <main id="main" className="flex flex-1 flex-col">
        {unavailable ? (
          <div className="mx-auto grid w-full max-w-prose grid-cols-1 content-start gap-6 px-4 pt-8 pb-12 md:px-8">
            <div className="grid justify-items-start gap-4 rounded-lg border border-line bg-surface p-6">
              <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
                <Icon icon={Sparkles} size="lg" />
              </span>
              <p className="text-body">{t("unavailable")}</p>
              <WithoutAi href={without} />
            </div>
          </div>
        ) : phase === "input" ? (
          <div className="mx-auto grid w-full max-w-prose grid-cols-1 content-start gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
            <div className="grid grid-cols-1 gap-2">
              <h2 className="text-h1 tracking-tight rtl:tracking-normal">{t("entry.title")}</h2>
              <p className="text-body text-fg-secondary">{t("entry.lead")}</p>
              {quota?.used === 0 ? <p className="text-small text-fg-secondary">{t("intro")}</p> : null}
            </div>
            {loading ? (
              <div className="grid grid-cols-1 gap-4" aria-hidden>
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </div>
            ) : (
              <BuildInput inputs={inputs} onChange={setInputs} errors={errors} onErrors={setErrors} aboutRef={aboutRef} />
            )}
          </div>
        ) : (
          // The screen's own announcer (below) speaks for the run: its live regions exist before it starts.
          <AiRunView state={state} source="live" tone="console" announce={false} owner={owner} review={review} className="flex-1" />
        )}

        {!unavailable && (phase === "error" || (phase === "stopped" && !stoppedWithBlocks)) ? (
          <div className="mx-auto w-full max-w-content px-4 pt-2 pb-6 md:px-8">
            {phase === "error" && state.error ? (
              <div role="alert" className="grid max-w-prose gap-2 rounded-lg border border-line-strong bg-surface p-5">
                <p className="flex items-center gap-2 text-body font-semibold">
                  <Icon icon={CircleAlert} size="md" className="shrink-0 text-danger-strong" />
                  {t("errors.title")}
                </p>
                <p className="text-body">{errorText(state.error, quota)}</p>
                <p className="text-small text-fg-secondary">{tRun("notCounted")}</p>
                {state.error === "quota" && !pro ? (
                  <Button variant="tinted" className="justify-self-start" onClick={() => setProOpen(true)}>
                    {t("pro.get")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="grid max-w-prose gap-2 rounded-lg border border-line bg-surface p-5">
                <p className="text-body font-semibold">{tRun("stopped", { count: 0 })}</p>
                <p className="text-small text-fg-secondary">{tRun("notCounted")}</p>
              </div>
            )}
          </div>
        ) : null}
        {state.offline ? (
          <p role="status" className="mx-auto w-full max-w-content px-4 pb-4 text-small font-medium md:px-8">
            {t("errors.offline")}
          </p>
        ) : null}
      </main>

      {showFooter ? (
        <footer className="sticky bottom-0 layer-sticky border-t border-line bg-canvas pt-3 pr-[env(safe-area-inset-right)] pb-[max(var(--spacing-3),env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)]">
          {/* The same column as the content above it (the form, or the run's timeline). */}
          <div className={cn("mx-auto grid grid-cols-1 gap-2 px-4 md:px-8", phase === "input" ? "max-w-prose" : "max-w-content")}>
            {phase === "input" ? <QuotaLine quota={quota} id={quotaId} /> : null}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              {button}
              {isLive(state) ? (
                <p id={stopCountsId} className="text-small text-fg-secondary">
                  {tRun("stopCounts")}
                </p>
              ) : (
                <WithoutAi href={without} className="self-center sm:self-auto" />
              )}
            </div>
          </div>
        </footer>
      ) : null}

      {/* Present (and empty) from the first paint: the steps' log and the end's status sentence. */}
      <RunAnnouncer state={state} />
      <ProSheet open={proOpen} onOpenChange={setProOpen} />
    </div>
  );
}
