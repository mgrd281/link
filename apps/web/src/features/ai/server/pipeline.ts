import { pageSchema, type Block, type CreatorKind, type Page, type Profile } from "@linkyo/blocks";
import { PAGE_PLAN_VERSION, type AiBlock, type PagePlan } from "@linkyo/blocks/ai-plan";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import type { LinkMetadata } from "@/features/app/metadata";
import type { Json } from "@/lib/supabase/database.types";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { checkFreeText, factsFrom, languageWarning, type Facts } from "../content-rules";
import type { AiCounts, AiErrorCode, AiRunEvent, AiStepKey, AiStepState } from "../events";
import { DRAFT_DAYS, MAX_CALLS, MAX_TOKENS, reserveMicros } from "../limits";
import { createBlockMapper, normalizeBlock, normalizePlan, planProfile, planTheme, planToPage, type BlockMapper, type PageDraft, type PlanContext } from "../plan-to-page";
import type { PipelineInput } from "../request";
import { createPlanScanner } from "../scanner";

import { buildBundle, bundleCounts, bundleHasContent, promptSources, redactContacts, withMetadata, type SourceBundle, type SourceResult } from "./bundle";
import { ClaudeCallError, type PlanCall, type PlanCaller, type PlanCallResult } from "./claude";
import { enrichLinks } from "./enrich";
import type { LimitsClient, ProgressEntry, SettleDetails } from "./limits-client";
import { followUpTurn, PROMPT_VERSION, userTurn } from "./prompts";
import { followUpFits, followUpSettings, parsePlanText, planProblems, ROUTE_EFFORT, type Effort } from "./repair";
import { classifySource, type ClassifiedSource } from "./sources/classify";
import { readLinkInBio } from "./sources/linkinbio";
import { readTikTok } from "./sources/tiktok";
import { readWebsite } from "./sources/website";

/**
 * One AI draft, start to end. Every dependency is injected (limits, source readers, the Claude
 * caller, the clock), so tests run it without a database or network:
 *
 *  1. reserve — the run's only `ai_reserve_run` (quota, address, budget, concurrency); a refusal is
 *     an `error` event and nothing else happens;
 *  2. read the sources (≤ 12 s together), one `source` event each; 3. nothing to build from → `nothing`;
 *  4. details from the platforms (titles, covers); 5. colours (measured in the browser);
 *  6. plan: one streamed Claude call; the scanner shows the look, the profile and each block as soon
 *     as its JSON closes; the stop flag is polled every 2 s;
 *  7. check: the whole answer is rebuilt and validated; a hard failure gets the one follow-up call;
 *  8. save: the draft is stored with the settled run and counted, then `done`.
 * Failures, refusals, time-outs and a stop before the first block never count. The browser's
 * connection does not matter: events go to `emit`, which never throws; the result is in the database.
 */

const DAY_MS = 86_400_000;
/** A run must end inside the function's 300 s; this leaves time to save. */
export const RUN_DEADLINE_MS = 285_000;
export const SOURCES_BUDGET_MS = 12_000;
export const STOP_POLL_MS = 2_000;

export interface PipelineRun {
  input: PipelineInput;
  /** The account the run belongs to (for a team run: the team member). */
  account: string;
  /** The caller's daily-salted address hash (team runs: the team member's). */
  ipHash: string;
  /** Team runs: the order. */
  order?: string | undefined;
  /** The page's owner: their address and picture go on the draft; their current name is a fallback. */
  owner: { username: string; currentName?: string | undefined; avatar?: Profile["avatar"] | undefined };
}

export interface SourceReader {
  read: (source: ClassifiedSource, options: { id: string; locale: PipelineInput["ownerLocale"] }) => Promise<SourceResult>;
}

export interface PipelineDeps {
  emit: (event: AiRunEvent) => void;
  limits: LimitsClient;
  claude: PlanCaller;
  sources?: SourceReader;
  /** Platform details for media links; null skips the step (AI_ENRICH_OFF=1 in e2e). */
  enrich?: ((links: SourceBundle["links"]) => Promise<Map<string, LinkMetadata>>) | null;
  now?: () => number;
  /** When the run must end (epoch ms). */
  deadline?: number;
  stopPollMs?: number;
  sourcesBudgetMs?: number;
  /** One line per run, without content (default: stdout). */
  log?: (line: string) => void;
}

export type PipelineStatus = "succeeded" | "stopped" | "failed" | "refused" | "rejected";

export interface PipelineOutcome {
  status: PipelineStatus;
  runId: string | null;
  counted: boolean;
  code?: AiErrorCode;
}

/** The readers of the real sources. */
export const productionSources: SourceReader = {
  read(source, options) {
    switch (source.kind) {
      case "website":
        return readWebsite(source, options);
      case "linkinbio":
        return readLinkInBio(source, options);
      case "tiktok":
        return readTikTok(source, { id: options.id });
      default:
        return Promise.resolve({ id: options.id, kind: source.kind, label: source.label, status: "handleOnly", self: { url: source.url }, links: [] });
    }
  },
};

const LABELS = {
  de: { video: de.dashboard.types.video, music: de.dashboard.types.music, event: de.dashboard.types.events },
  en: { video: en.dashboard.types.video, music: en.dashboard.types.music, event: en.dashboard.types.events },
  ar: { video: ar.dashboard.types.video, music: ar.dashboard.types.music, event: ar.dashboard.types.events },
} as const;

/** What one call may cost at most (its output cap and the input estimate, at the worst prices). */
const callWorstMicros = (maxTokens: number) => Math.ceil(maxTokens * 25 + 20_000 * 6.25);

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T> =>
  new Promise<T>((resolve) => {
    const timer = setTimeout(
      () => {
        resolve(fallback());
      },
      Math.max(0, ms),
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback());
      },
    );
  });

/** Notes for the owner, without addresses, e-mails or phone numbers that are not in the sources. */
const cleanNotes = (notes: PagePlan["notes"], facts: Facts): PagePlan["notes"] =>
  notes.map((note) => ({ ...note, text: checkFreeText(note.text, facts).text })).filter((note) => note.text.length > 0);

/** The streamed preview: look, profile and blocks as they arrive (the final page replaces them). */
class LiveDraft {
  kind: CreatorKind | null = null;
  theme: CreatorThemeConfig | null = null;
  profile: Profile | null = null;
  notes: PagePlan["notes"] = [];
  blocks: Block[] = [];
  lookShown = false;
  profileShown = false;
  writing = false;
  notesShown = false;
  private mapper: BlockMapper | null = null;

  constructor(
    private readonly ctx: PlanContext,
    private readonly emit: (event: AiRunEvent) => void,
    private readonly step: (key: AiStepKey, state: AiStepState, extra?: { ms?: number; counts?: AiCounts }) => void,
    private readonly fallbackKind: CreatorKind,
  ) {}

  onTheme(theme: PagePlan["theme"]) {
    if (this.lookShown) return;
    this.theme = planTheme(theme, this.ctx.photo);
    this.showLook(this.kind ?? this.fallbackKind, this.theme);
  }

  showLook(kind: CreatorKind, theme: CreatorThemeConfig) {
    this.lookShown = true;
    this.emit({ type: "look", kind, theme });
    this.step("look", "done");
  }

  onProfile(profile: PagePlan["profile"]) {
    if (this.profileShown) return;
    this.profile = planProfile(profile, this.ctx).profile;
    this.showProfile(this.profile);
  }

  showProfile(profile: Profile) {
    this.profileShown = true;
    this.emit({
      type: "profile",
      profile: { displayName: profile.displayName, ...(profile.tagline ? { tagline: profile.tagline } : {}), ...(profile.bio ? { bio: profile.bio } : {}), ...(profile.location ? { location: profile.location } : {}) },
    });
  }

  onBlock(index: number, block: AiBlock) {
    if (!this.writing) {
      this.writing = true;
      this.step("write", "start");
    }
    this.mapper ??= createBlockMapper(this.ctx, this.profile?.displayName ?? this.ctx.owner.name ?? this.ctx.owner.username);
    const result = this.mapper.map(block, index);
    if ("drop" in result) {
      this.emit({ type: "drop", index, reason: result.drop });
      return;
    }
    for (const made of result.blocks) {
      this.emit({ type: "block", index: this.blocks.length, block: made });
      this.blocks.push(made);
    }
  }

  onInvalid(path: string, value: unknown) {
    const index = /^\$\.blocks\[(\d+)\]$/.exec(path)?.[1];
    if (index === undefined) return;
    const block = normalizeBlock(value);
    if (block) this.onBlock(Number(index), block);
    else this.emit({ type: "drop", index: Number(index), reason: "invalid" });
  }

  onNotes(notes: PagePlan["notes"]) {
    if (this.notesShown) return;
    this.notesShown = true;
    this.notes = cleanNotes(notes, this.ctx.facts);
    if (this.notes.length) this.emit({ type: "notes", notes: this.notes });
  }

  /** Whatever the stream did not show (an answer that only parsed after repair) is shown from the final draft. */
  complete(draft: PageDraft) {
    if (!this.lookShown) {
      this.step("look", "start");
      this.showLook(draft.kind, draft.theme);
    }
    if (!this.profileShown) this.showProfile(draft.page.profile);
    if (!this.writing) {
      this.writing = true;
      this.step("write", "start");
    }
    if (!this.notesShown) {
      this.notesShown = true;
      if (draft.notes.length) this.emit({ type: "notes", notes: draft.notes });
    }
  }

  /** The blocks streamed so far as a page (for a stopped run), or null when there are none. */
  partial(): { page: Page; theme: CreatorThemeConfig; kind: CreatorKind } | null {
    if (this.blocks.length === 0) return null;
    const profile = this.profile ?? planProfile({ displayName: "", tagline: "", bio: "", location: "" }, this.ctx).profile;
    const page = pageSchema.safeParse({ profile, blocks: this.blocks });
    if (!page.success) return null;
    return { page: page.data, theme: this.theme ?? {}, kind: this.kind ?? this.fallbackKind };
  }
}

const defaultLog = (line: string) => {
  process.stdout.write(`${line}\n`);
};

export async function runPipeline(run: PipelineRun, deps: PipelineDeps): Promise<PipelineOutcome> {
  const now = deps.now ?? Date.now;
  const started = now();
  const deadlineAt = deps.deadline ?? started + RUN_DEADLINE_MS;
  const { input } = run;
  const log = deps.log ?? defaultLog;
  const emit = (event: AiRunEvent) => {
    try {
      deps.emit(event);
    } catch {
      // Delivery never decides the run.
    }
  };

  const stats = {
    calls: 0,
    cost: 0,
    model: null as string | null,
    servedBy: null as string | null,
    effort: null as Effort | null,
    stopReason: null as string | null,
    fallback: false,
    input: 0,
    cacheRead: 0,
    cacheWrite: 0,
    output: 0,
    sources: 0,
    msSources: 0,
    msModel: 0,
    blocks: 0,
    dropped: 0,
    fixed: 0,
    requestId: null as string | null,
    errorName: null as string | null,
    warning: false,
  };

  const writeLog = (status: string, runId: string | null, code?: AiErrorCode) => {
    log(
      JSON.stringify({
        evt: "ai_run",
        id: runId,
        route: input.route,
        status,
        ...(code ? { code } : {}),
        model: stats.model,
        servedBy: stats.servedBy,
        effort: stats.effort,
        stop: stats.stopReason,
        calls: stats.calls,
        in: stats.input,
        cacheRead: stats.cacheRead,
        cacheWrite: stats.cacheWrite,
        out: stats.output,
        costMicros: stats.cost,
        ms: { sources: stats.msSources, model: stats.msModel, total: now() - started },
        sources: stats.sources,
        blocks: stats.blocks,
        dropped: stats.dropped,
        fixed: stats.fixed,
        plan: PAGE_PLAN_VERSION,
        prompt: PROMPT_VERSION,
        ...(stats.errorName ? { error: stats.errorName } : {}),
        ...(stats.warning ? { warning: "language" } : {}),
        ...(stats.requestId && code ? { requestId: stats.requestId } : {}),
      }),
    );
  };

  // 1 · Reserve: the only reservation of the run.
  let reservation;
  try {
    reservation = await deps.limits.reserve({
      account: run.account,
      ipHash: run.ipHash,
      route: input.route,
      worstMicros: reserveMicros(input.route),
      promptVersion: PROMPT_VERSION,
      schemaVersion: PAGE_PLAN_VERSION,
      ...(input.route === "team" ? { actor: run.account } : {}),
      ...(run.order ? { order: run.order } : {}),
    });
  } catch (error) {
    stats.errorName = error instanceof Error ? error.constructor.name : "unknown";
    emit({ type: "error", code: "server", counted: false });
    writeLog("rejected", null, "server");
    return { status: "rejected", runId: null, counted: false, code: "server" };
  }
  if (!reservation.ok) {
    const code: AiErrorCode = reservation.reason === "ip" ? "limit" : reservation.reason;
    emit({ type: "error", code, counted: false });
    writeLog("rejected", null, code);
    return { status: "rejected", runId: null, counted: false, code };
  }
  const runId = reservation.id;
  emit({ type: "run", id: runId, plan: reservation.plan, left: reservation.left });

  // Progress for reconnecting or polling clients: content-free, in order.
  const progress = new Map<string, ProgressEntry>();
  let recording: Promise<void> = Promise.resolve();
  const step = (key: AiStepKey, state: AiStepState, extra: { ms?: number; counts?: AiCounts } = {}) => {
    emit({ type: "step", key, state, ...extra });
    const count = extra.counts ? Object.values(extra.counts).find((value) => typeof value === "number") : undefined;
    progress.set(key, { key, state, ...(count !== undefined ? { count } : {}), ...(extra.ms !== undefined ? { ms: extra.ms } : {}) });
    const snapshot = [...progress.values()];
    recording = recording.then(() => deps.limits.recordProgress(runId, snapshot)).catch(() => undefined);
  };

  const stop = new AbortController();
  /** Read through a function: the flag changes while the run awaits. */
  const stopRequested = () => stop.signal.aborted;
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(
    () => {
      deadline.abort();
    },
    Math.max(0, deadlineAt - now()),
  );
  const poll = setInterval(() => {
    deps.limits.stopRequested(runId).then(
      (requested) => {
        if (requested) stop.abort();
      },
      () => undefined,
    );
  }, deps.stopPollMs ?? STOP_POLL_MS);

  const details = (code?: AiErrorCode): SettleDetails => ({
    model: stats.model,
    served_by: stats.servedBy,
    effort: stats.effort,
    stop_reason: stats.stopReason,
    error_code: code ?? null,
    calls: stats.calls,
    sources: stats.sources,
    blocks: stats.blocks,
    dropped: stats.dropped,
    fixed: stats.fixed,
    ms_sources: stats.msSources,
    ms_model: stats.msModel,
    ms_total: now() - started,
    input_tokens: stats.input,
    cache_read_tokens: stats.cacheRead,
    cache_write_tokens: stats.cacheWrite,
    output_tokens: stats.output,
  });

  /** Ends the run uncounted with an error. */
  const fail = async (code: AiErrorCode, status: "failed" | "refused" = "failed"): Promise<PipelineOutcome> => {
    await recording;
    try {
      await deps.limits.settle({ run: runId, status, counted: false, costMicros: stats.cost, details: details(code), draft: null });
    } catch {
      // The cleanup job ends a run that could not be settled (as failed, uncounted).
    }
    emit({ type: "error", code, counted: false });
    writeLog(status, runId, code);
    return { status, runId, counted: false, code };
  };

  let live: LiveDraft | null = null;

  /** Ends the run as stopped: it keeps (and counts) only blocks that already arrived. */
  const stopped = async (): Promise<PipelineOutcome> => {
    await recording;
    const kept = live?.partial() ?? null;
    const counted = kept !== null;
    stats.blocks = kept?.page.blocks.length ?? 0;
    try {
      await deps.limits.settle({
        run: runId,
        status: "stopped",
        counted,
        costMicros: stats.cost,
        details: details(),
        draft: kept ? ({ ...kept, notes: live?.notes ?? [] } as unknown as Json) : null,
      });
    } catch {
      return fail("server");
    }
    emit({ type: "stopped", runId, page: kept?.page ?? null, theme: kept?.theme ?? null, kind: kept?.kind ?? null, counted });
    writeLog("stopped", runId);
    return { status: "stopped", runId, counted };
  };

  const signal = AbortSignal.any([deadline.signal, stop.signal]);

  /** One Claude call, with its cost booked; a thrown error is mapped to the run's outcome. */
  const call = async (request: Omit<PlanCall, "signal">): Promise<PlanCallResult | PipelineOutcome> => {
    stats.calls += 1;
    stats.effort = request.effort;
    const began = now();
    try {
      const result = await deps.claude.call({ ...request, signal });
      stats.msModel += now() - began;
      stats.cost += result.costMicros;
      stats.model = stats.model ?? result.model;
      stats.servedBy = result.model;
      stats.fallback ||= result.fallback;
      stats.stopReason = result.stopReason;
      stats.input += result.usage.input;
      stats.cacheRead += result.usage.cacheRead;
      stats.cacheWrite += result.usage.cacheWrite;
      stats.output += result.usage.output;
      stats.requestId = result.requestId;
      return result;
    } catch (error) {
      stats.msModel += now() - began;
      const mapped = error instanceof ClaudeCallError ? error : new ClaudeCallError("server", false, "unknown");
      // An aborted or timed-out stream is billed for what it produced; without its usage the call's
      // worst case is booked. A refused request (429, 5xx) produced nothing.
      if (mapped.code === "aborted" || mapped.code === "timeout") stats.cost += callWorstMicros(request.maxTokens);
      stats.errorName = mapped.errorName;
      if (mapped.code === "aborted") return stopRequested() ? stopped() : fail("timeout");
      if (mapped.spendLimit) {
        try {
          await deps.limits.disable("spend limit");
        } catch {
          // The team sees the spend limit at Anthropic as well.
        }
      }
      return fail(mapped.code);
    }
  };

  try {
    // 2 · Read the sources.
    step("read", "start");
    const readStarted = now();
    const reader = deps.sources ?? productionSources;
    const budget = deps.sourcesBudgetMs ?? SOURCES_BUDGET_MS;
    const results = await Promise.all(
      input.sources.map((raw, index): Promise<SourceResult> => {
        const id = `S${String(index + 1)}`;
        const source = classifySource(raw);
        if (!source) return Promise.resolve({ id, kind: "pasted", label: raw.slice(0, 80), status: "skipped", reason: "notAllowed", links: [] });
        const base = { id, kind: source.kind, label: source.label };
        if (source.pasteOnly) return Promise.resolve({ ...base, status: "skipped", reason: "paste", links: [] });
        if (!source.readable) return Promise.resolve({ ...base, status: "handleOnly", self: { url: source.url }, links: [] });
        const timedOut = (): SourceResult => ({ ...base, status: "failed", reason: "timeout", self: { url: source.url }, links: [] });
        return withTimeout(reader.read(source, { id, locale: input.ownerLocale }), budget - (now() - readStarted), timedOut);
      }),
    );
    for (const result of results) {
      const links = result.links.length + (result.self ? 1 : 0);
      emit({ type: "source", id: result.id, kind: result.kind, label: result.label, status: result.status, ...(result.reason ? { reason: result.reason } : {}), counts: { links } });
    }
    let bundle = buildBundle(results, input.pasted);
    stats.sources = results.length;
    stats.msSources = now() - readStarted;
    step("read", "done", { counts: bundleCounts(bundle) });
    if (stopRequested()) return await stopped();

    // 3 · Nothing to build from.
    if (!bundleHasContent(bundle) && input.about.trim().length === 0) return await fail("nothing");

    // 4 · Details from the platforms.
    let metadata = new Map<string, LinkMetadata>();
    if (deps.enrich === null) step("details", "skip");
    else {
      step("details", "start");
      metadata = await (deps.enrich ?? ((links: SourceBundle["links"]) => enrichLinks(links)))(bundle.links).catch(() => new Map<string, LinkMetadata>());
      bundle = withMetadata(bundle, metadata);
      step("details", "done", { counts: { media: metadata.size } });
    }

    // 5 · Colours: measured in the browser; nothing to do here.
    step("colors", input.photo ? "done" : "skip");

    // What the model sees, and what its answer is checked against.
    const sources = promptSources(bundle);
    // Only words the model was given count as facts (not the link ids "L1"…"L40": their digits are ours).
    const words = (value: string | boolean | undefined) => (typeof value === "string" ? [value] : []);
    const facts = factsFrom([
      redactContacts(input.about),
      input.name ? redactContacts(input.name) : undefined,
      ...Object.values(sources.profile),
      ...sources.links.flatMap((link) => [...words(link.title), ...words(link.label), ...words(link.author), ...words(link.host), ...words(link.path)]),
    ]);
    const ctx: PlanContext = {
      links: new Map(bundle.links.map((link) => [link.id, { url: link.url, type: link.type, platform: link.platform, title: link.title, affiliateHint: link.affiliateHint }])),
      metadata,
      owner: { name: input.name, currentName: run.owner.currentName, username: run.owner.username, avatar: run.owner.avatar },
      pageLocale: input.pageLocale,
      photo: input.photo ? { vibrant: input.photo.vibrant, dominant: input.photo.dominant } : null,
      facts,
      labels: LABELS[input.pageLocale],
    };

    // 6 · Plan: one streamed call.
    const draftLive = new LiveDraft(ctx, emit, step, input.kind ?? "other");
    live = draftLive;
    const scanner = createPlanScanner({
      onKind: (kind) => {
        draftLive.kind = kind;
      },
      onTheme: (theme) => {
        draftLive.onTheme(theme);
      },
      onProfile: (profile) => {
        draftLive.onProfile(profile);
      },
      onBlock: (index, block) => {
        draftLive.onBlock(index, block);
      },
      onNotes: (notes) => {
        draftLive.onNotes(notes);
      },
      onInvalid: (path, value) => {
        draftLive.onInvalid(path, value);
      },
    });
    const content = userTurn(input, bundle);
    step("plan", "start");
    const planStarted = now();
    let planning = true;
    const first = await call({
      effort: ROUTE_EFFORT[input.route],
      maxTokens: MAX_TOKENS[input.route],
      content,
      onText: (delta) => {
        if (planning) {
          planning = false;
          step("plan", "done", { ms: now() - planStarted });
          step("look", "start");
        }
        scanner.push(delta);
      },
    });
    if (!("text" in first)) return first;
    scanner.end();
    if (first.stopReason === "refusal") return await fail("refused", "refused");

    // 7 · Check: rebuild from the whole answer; one follow-up call for a hard failure.
    const assess = (result: PlanCallResult) => {
      const parsed = parsePlanText(result.text);
      const normalized = parsed ? normalizePlan(parsed.value) : null;
      let draft: PageDraft | null = null;
      if (normalized) {
        try {
          draft = planToPage(normalized, ctx);
        } catch {
          draft = null;
        }
      }
      const problems = planProblems({ stopReason: result.stopReason, unparseable: !normalized, draft, planBlocks: normalized?.blocks.length ?? 0, bundleLinks: bundle.links.length });
      return { draft, problems };
    };
    let attempt = assess(first);
    if (attempt.problems.length > 0) {
      if (stats.calls >= MAX_CALLS || !followUpFits(deadlineAt, now()) || stopRequested()) {
        return await (stopRequested() ? stopped() : fail("invalid"));
      }
      const settings = followUpSettings(input.route, attempt.problems);
      const second = await call({ ...settings, content: followUpTurn(input, bundle, first.text, attempt.problems) });
      if (!("text" in second)) return second;
      if (second.stopReason === "refusal") return await fail("refused", "refused");
      attempt = assess(second);
      if (attempt.problems.length > 0 || !attempt.draft) return await fail("invalid");
    }
    const draft = attempt.draft;
    if (!draft) return await fail("invalid");
    if (stopRequested()) return await stopped();

    draftLive.complete(draft);
    stats.blocks = draft.page.blocks.length;
    stats.dropped = draft.drops.length;
    stats.fixed = draft.fixed;
    step("write", "done", { counts: { blocks: stats.blocks } });
    step("check", "start");
    step("check", "done", { counts: { fixed: stats.fixed, dropped: stats.dropped } });
    // A warning only (names and brands stay in Latin letters): logged, the draft is kept.
    stats.warning = languageWarning(input.pageLocale, [draft.page.profile.bio, ...draft.page.blocks.map((block) => ("title" in block && typeof block.title === "string" ? block.title : ""))]);

    // 8 · Save, counted.
    await recording;
    const notes = cleanNotes(draft.notes.length ? draft.notes : draftLive.notes, facts);
    try {
      await deps.limits.settle({
        run: runId,
        status: "succeeded",
        counted: true,
        costMicros: stats.cost,
        details: details(),
        draft: { page: draft.page, theme: draft.theme, kind: draft.kind, notes } as unknown as Json,
      });
    } catch {
      return await fail("server");
    }
    emit({
      type: "done",
      runId,
      page: draft.page,
      theme: draft.theme,
      kind: draft.kind,
      fixed: draft.fixed,
      dropped: draft.drops.length,
      fallback: stats.fallback,
      counted: true,
      expiresAt: new Date(now() + DRAFT_DAYS * DAY_MS).toISOString(),
      ms: now() - started,
    });
    writeLog("succeeded", runId);
    return { status: "succeeded", runId, counted: true };
  } catch (error) {
    stats.errorName = error instanceof Error ? error.constructor.name : "unknown";
    return await fail("server");
  } finally {
    clearInterval(poll);
    clearTimeout(deadlineTimer);
  }
}
