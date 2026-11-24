import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { NO_IMAGE } from "@linkyo/blocks";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { handle } from "../../../../e2e/mocks/anthropic.handler.mjs";
import type { AiRunEvent } from "../events";
import type { PipelineInput } from "../request";

import { ClaudeCallError, createPlanCaller, type PlanCall, type PlanCaller } from "./claude";
import type { LimitsClient, ReserveResult } from "./limits-client";
import { runPipeline, type PipelineDeps, type SourceReader } from "./pipeline";
import { createSseSink } from "./sse";

// The pipeline with injected limits and sources, and the real SDK against the local mock.

let server: Server;

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-local-test");
  vi.stubEnv("ANTHROPIC_BASE_URL", `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`);
  vi.stubEnv("VERCEL", "");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PASTED = ["https://instagram.com/lio.vance", "https://soundcloud.com/lio-vance", "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "https://www.eventim.de/artist/lio-vance/", "https://lio-vance.de/booking"];

const input = (fixture: string, tag: string, overrides: Partial<PipelineInput> = {}): PipelineInput => ({
  route: "welcome",
  pageLocale: "de",
  ownerLocale: "de",
  about: `Ich bin Lio, ich mache elektronische Musik und lege in Clubs auf. DJ & Producer aus Berlin. [[fixture:${fixture}#${tag}]]`,
  name: "Lio",
  kind: null,
  sources: ["https://instagram.com/lio.vance"],
  pasted: PASTED,
  photo: { vibrant: "#C2410C", dominant: "#1C1917", mode: "dark" },
  ...overrides,
});

interface FakeLimits extends LimitsClient {
  reserveCalls: Parameters<LimitsClient["reserve"]>[0][];
  settleCalls: Parameters<LimitsClient["settle"]>[0][];
  stop: boolean;
  disabled: string[];
}

function fakeLimits(reserve: ReserveResult = { ok: true, id: "run-1", plan: "free", allowance: 1, used: 0, left: 1 }): FakeLimits {
  const limits: FakeLimits = {
    reserveCalls: [],
    settleCalls: [],
    stop: false,
    disabled: [],
    reserve(args) {
      limits.reserveCalls.push(args);
      return Promise.resolve(reserve);
    },
    recordProgress: () => Promise.resolve(),
    stopRequested: () => Promise.resolve(limits.stop),
    settle(args) {
      limits.settleCalls.push(args);
      return Promise.resolve();
    },
    disable(reason) {
      limits.disabled.push(reason);
      return Promise.resolve();
    },
  };
  return limits;
}

/** The real caller, recording effort and cap of every call. */
function recordingCaller(): PlanCaller & { calls: Pick<PlanCall, "effort" | "maxTokens">[] } {
  const real = createPlanCaller();
  const calls: Pick<PlanCall, "effort" | "maxTokens">[] = [];
  return {
    calls,
    call(call) {
      calls.push({ effort: call.effort, maxTokens: call.maxTokens });
      return real.call(call);
    },
  };
}

const noSources: SourceReader = { read: vi.fn(() => Promise.reject(new Error("nothing is read in these tests"))) };

const spotifyDetails = () => Promise.resolve(new Map([["https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", { title: "Nachtstrom EP", author: "Lio Vance", image: "https://i.scdn.co/image/cover" }]]));

function run(fixture: string, tag: string, options: { input?: Partial<PipelineInput>; limits?: FakeLimits; emit?: (event: AiRunEvent, events: AiRunEvent[], limits: FakeLimits) => void; deps?: Partial<PipelineDeps> } = {}) {
  const events: AiRunEvent[] = [];
  const limits = options.limits ?? fakeLimits();
  const claude = recordingCaller();
  const log = vi.fn();
  const promise = runPipeline(
    { input: input(fixture, tag, options.input), account: "user-1", ipHash: "hash-1", owner: { username: "lio-vance", avatar: { src: NO_IMAGE, alt: "" } } },
    {
      emit: (event) => {
        events.push(event);
        options.emit?.(event, events, limits);
      },
      limits,
      claude,
      sources: noSources,
      enrich: spotifyDetails,
      stopPollMs: 25,
      log,
      ...options.deps,
    },
  );
  return { promise, events, limits, claude, log };
}

const label = (event: AiRunEvent) => (event.type === "step" ? `step ${event.key} ${event.state}` : event.type);

describe("AI pipeline", { timeout: 20_000 }, () => {
  it("de-music: the events arrive in order, the run is reserved once and settled once, counted, with its cost", async () => {
    const { promise, events, limits, claude, log } = run("de-music", "p-order");
    const outcome = await promise;
    expect(outcome).toEqual({ status: "succeeded", runId: "run-1", counted: true });
    expect(events.map(label)).toEqual([
      "run",
      "step read start",
      "source",
      "step read done",
      "step details start",
      "step details done",
      "step colors done",
      "step plan start",
      "step plan done",
      "step look start",
      "look",
      "step look done",
      "profile",
      "step write start",
      "block",
      "block",
      "block",
      "block",
      "notes",
      "step write done",
      "step check start",
      "step check done",
      "done",
    ]);
    expect(events[0]).toEqual({ type: "run", id: "run-1", plan: "free", left: 1 });
    expect(events[2]).toEqual({ type: "source", id: "S1", kind: "instagram", label: "instagram.com/lio.vance", status: "handleOnly", counts: { links: 1 } });
    expect(events[3]).toMatchObject({ counts: { links: 5, profiles: 2 } });
    expect(events.find((event) => event.type === "look")).toMatchObject({ kind: "music", theme: { template: "nocturne", accent: "#C2410C" } });

    expect(limits.reserveCalls).toHaveLength(1);
    expect(limits.reserveCalls[0]).toMatchObject({ account: "user-1", ipHash: "hash-1", route: "welcome", worstMicros: 1_050_000, promptVersion: "core-v5", schemaVersion: "plan-v4" });
    expect(limits.settleCalls).toHaveLength(1);
    const settled = limits.settleCalls[0];
    expect(settled).toMatchObject({ run: "run-1", status: "succeeded", counted: true, costMicros: Math.ceil(812 * 4 + 3605 * 0.2 + 2911 * 20) });
    expect(settled?.details).toMatchObject({ model: "claude-opus-5-5", served_by: "claude-opus-5-5", effort: "medium", stop_reason: "end_turn", calls: 1, blocks: 4, dropped: 0, input_tokens: 812, cache_read_tokens: 3605, output_tokens: 2911 });
    expect(claude.calls).toEqual([{ effort: "medium", maxTokens: 16_000 }]);

    const done = events.at(-1);
    expect(done?.type).toBe("done");
    if (done?.type !== "done") return;
    expect(done.page.blocks.map((block) => block.type)).toEqual(["socials", "music", "link", "link"]);
    expect(done.page.blocks.every((block) => block.origin === "ai")).toBe(true);
    expect(done.page.profile).toMatchObject({ displayName: "Lio Vance", tagline: "DJ und Producer aus Berlin", aiFields: ["displayName", "tagline", "bio"] });
    expect(done).toMatchObject({ runId: "run-1", kind: "music", counted: true, fallback: false, dropped: 0 });
    expect(Date.parse(done.expiresAt) - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
    expect((settled?.draft as { page: unknown }).page).toEqual(done.page);

    // One log line, without content.
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toMatchObject({ evt: "ai_run", id: "run-1", status: "succeeded", blocks: 4, prompt: "core-v5", plan: "plan-v4" });
    expect(line).not.toMatch(/Lio|instagram|spotify|Berlin|https?:/);
  });

  it("refusal: an error event, refused and not counted", async () => {
    const { promise, events, limits } = run("refusal", "p-refusal");
    expect(await promise).toMatchObject({ status: "refused", counted: false, code: "refused" });
    expect(events.at(-1)).toEqual({ type: "error", code: "refused", counted: false });
    expect(limits.settleCalls).toEqual([expect.objectContaining({ status: "refused", counted: false, draft: null })]);
  });

  it("invalid-then-repair: a second call at low effort with 8,000 tokens, then done", async () => {
    const { promise, events, claude, limits } = run("invalid-then-repair", "p-repair");
    expect(await promise).toMatchObject({ status: "succeeded", counted: true });
    expect(claude.calls).toEqual([
      { effort: "medium", maxTokens: 16_000 },
      { effort: "low", maxTokens: 8_000 },
    ]);
    expect(events.at(-1)?.type).toBe("done");
    expect(limits.settleCalls[0]?.details.calls).toBe(2);
  });

  it("max-tokens: the follow-up keeps the route's effort and cap", async () => {
    const { promise, claude } = run("max-tokens", "p-max");
    expect(await promise).toMatchObject({ status: "succeeded" });
    expect(claude.calls).toEqual([
      { effort: "medium", maxTokens: 16_000 },
      { effort: "medium", maxTokens: 16_000 },
    ]);
  });

  it("a stop before any text ends the run as stopped, without blocks and not counted", async () => {
    const limits = fakeLimits();
    limits.stop = true;
    const { promise, events } = run("slow", "p-stop-early", { limits });
    expect(await promise).toEqual({ status: "stopped", runId: "run-1", counted: false });
    expect(events.at(-1)).toEqual({ type: "stopped", runId: "run-1", page: null, theme: null, kind: null, counted: false });
    expect(limits.settleCalls).toEqual([expect.objectContaining({ status: "stopped", counted: false, draft: null })]);
  });

  // ai-1: 18 such stops (525,000 micro-dollars each, the call's cap) used up the $10 day for everyone.
  it("a stop books what the call can have cost by then, not the call's cap", async () => {
    const limits = fakeLimits();
    limits.stop = true;
    const { promise } = run("slow", "p-stop-cost", { limits });
    expect(await promise).toMatchObject({ status: "stopped", counted: false });
    const cost = limits.settleCalls[0]?.costMicros ?? Number.NaN;
    // Stopped within a second of the call: its input (812 + 3,605 cached, or the estimate if the answer had not begun) and a second of output at most.
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThanOrEqual(20_000 * 6.25 + 300 * 25);
    expect(cost).toBeLessThan(525_000 / 4);
  });

  it("a stopped call: the input its stream reported and the output of the seconds it ran, to the micro-dollar", async () => {
    let clock = 1_700_000_000_000;
    const limits = fakeLimits();
    const events: AiRunEvent[] = [];
    // A stream that reports its input, runs two seconds and is then cut off by the stop.
    const claude: PlanCaller = {
      call: (call) =>
        new Promise((_resolve, reject) => {
          call.signal.addEventListener("abort", () => {
            clock += 2_000;
            reject(new ClaudeCallError("aborted", false, "APIUserAbortError", { input: 812, cacheRead: 3_605, cacheWrite: 0, attempts: 1 }));
          });
          limits.stop = true;
        }),
    };
    const outcome = await runPipeline(
      { input: input("slow", "p-stop-exact"), account: "user-1", ipHash: "hash-1", owner: { username: "lio-vance" } },
      { emit: (event) => events.push(event), limits, claude, sources: noSources, enrich: null, stopPollMs: 5, log: vi.fn(), now: () => clock },
    );
    expect(outcome).toEqual({ status: "stopped", runId: "run-1", counted: false });
    expect(limits.settleCalls).toHaveLength(1);
    expect(limits.settleCalls[0]?.costMicros).toBe(Math.ceil(812 * 5 + 3_605 * 0.5 + 2 * 300 * 25));
    expect(limits.settleCalls[0]?.details).toMatchObject({ calls: 1, input_tokens: 812, cache_read_tokens: 3_605, output_tokens: 0, ms_model: 2_000 });
  });

  it("a connection time-out still books the call's worst case (a retry may have run unseen)", async () => {
    const limits = fakeLimits();
    const claude: PlanCaller = { call: () => Promise.reject(new ClaudeCallError("timeout", false, "APIConnectionTimeoutError")) };
    const outcome = await runPipeline(
      { input: input("slow", "p-timeout-cost"), account: "user-1", ipHash: "hash-1", owner: { username: "lio-vance" } },
      { emit: () => undefined, limits, claude, sources: noSources, enrich: null, stopPollMs: 25, log: vi.fn() },
    );
    expect(outcome).toMatchObject({ status: "failed", code: "timeout", counted: false });
    expect(limits.settleCalls[0]?.costMicros).toBe(16_000 * 25 + 20_000 * 6.25);
  });

  it("a stop after the first block keeps that block and counts", async () => {
    const { promise, events, limits } = run("de-music", "p-stop-late", {
      emit: (event, _events, fake) => {
        if (event.type === "block") fake.stop = true;
      },
    });
    expect(await promise).toEqual({ status: "stopped", runId: "run-1", counted: true });
    const stopped = events.at(-1);
    expect(stopped?.type).toBe("stopped");
    if (stopped?.type !== "stopped") return;
    expect(stopped.counted).toBe(true);
    expect(stopped.page?.blocks[0]?.type).toBe("socials");
    expect(stopped.page?.blocks.length).toBeLessThan(4);
    expect(limits.settleCalls).toEqual([expect.objectContaining({ status: "stopped", counted: true })]);
  });

  it("a browser that goes away after the first block does not decide the run: it still succeeds and saves", async () => {
    const sink = createSseSink();
    let cancelled = false;
    const { promise, limits } = run("de-music", "p-cancel", {
      emit: (event) => {
        sink.emit(event);
        if (event.type === "block" && !cancelled) {
          cancelled = true;
          void sink.stream.cancel();
        }
      },
    });
    expect(await promise).toMatchObject({ status: "succeeded", counted: true });
    expect(sink.closed).toBe(true);
    expect(limits.settleCalls).toEqual([expect.objectContaining({ status: "succeeded", counted: true })]);
    expect(limits.settleCalls[0]?.draft).not.toBeNull();
  });

  it("a refused reservation is one error event and nothing else: no call, no settle", async () => {
    const limits = fakeLimits({ ok: false, reason: "budget" });
    const { promise, events, claude } = run("de-music", "p-budget", { limits });
    expect(await promise).toMatchObject({ status: "rejected", code: "budget" });
    expect(events).toEqual([{ type: "error", code: "budget", counted: false }]);
    expect(claude.calls).toEqual([]);
    expect(limits.settleCalls).toEqual([]);
  });

  it("an address over its daily runs is reported as 'limit'", async () => {
    const { promise, events } = run("de-music", "p-ip", { limits: fakeLimits({ ok: false, reason: "ip" }) });
    await promise;
    expect(events).toEqual([{ type: "error", code: "limit", counted: false }]);
  });

  it("a team run reserves for the team member and the order, and drafts with 32,000 tokens at high effort", async () => {
    const limits = fakeLimits({ ok: true, id: "run-team", plan: "team", allowance: null, used: null, left: null });
    const events: AiRunEvent[] = [];
    const claude = recordingCaller();
    const outcome = await runPipeline(
      { input: input("de-music", "p-team", { route: "team", photo: null }), account: "member-1", ipHash: "member-hash", order: "order-1", owner: { username: "lio-vance" } },
      { emit: (event) => events.push(event), limits, claude, sources: noSources, enrich: null, stopPollMs: 25, log: vi.fn() },
    );
    expect(outcome).toMatchObject({ status: "succeeded", counted: true });
    expect(claude.calls).toEqual([{ effort: "high", maxTokens: 32_000 }]);
    expect(limits.reserveCalls[0]).toMatchObject({ account: "member-1", actor: "member-1", order: "order-1", route: "team", worstMicros: 1_850_000 });
    expect(events[0]).toEqual({ type: "run", id: "run-team", plan: "team", left: null });
    expect(events.find((event) => event.type === "step" && event.key === "details")).toEqual({ type: "step", key: "details", state: "skip" });
  });

  it("nothing to build from (no link, no profile text, no sentence): an error, no call, not counted", async () => {
    const reader: SourceReader = { read: (source, options) => Promise.resolve({ id: options.id, kind: source.kind, label: source.label, status: "failed", links: [] }) };
    const { promise, events, claude, limits } = run("en-sparse", "p-nothing", { input: { about: "", sources: ["https://sam-rivers.example.com"], pasted: [] }, deps: { sources: reader } });
    expect(await promise).toMatchObject({ status: "failed", counted: false, code: "nothing" });
    expect(events.at(-1)).toEqual({ type: "error", code: "nothing", counted: false });
    expect(events.find((event) => event.type === "source")).toMatchObject({ kind: "website", status: "failed" });
    expect(claude.calls).toEqual([]);
    expect(limits.settleCalls).toHaveLength(1);
    expect(limits.settleCalls[0]).toMatchObject({ status: "failed", counted: false, details: { error_code: "nothing" } });
  });

  it("a spend-limit answer turns the AI off and ends the run as 'budget', not counted", async () => {
    const { promise, events, limits } = run("status-spend", "p-spend");
    expect(await promise).toMatchObject({ status: "failed", code: "budget", counted: false });
    expect(limits.disabled).toEqual(["spend limit"]);
    expect(events.at(-1)).toEqual({ type: "error", code: "budget", counted: false });
  });
});
