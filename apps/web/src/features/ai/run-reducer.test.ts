import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { NO_IMAGE } from "@linkyo/blocks";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { handle } from "../../../e2e/mocks/anthropic.handler.mjs";

import { AI_STEPS, type AiRunEvent } from "./events";
import type { PipelineInput } from "./request";
import { currentStep, draftOf, initialRunState, isLive, runFromEvents, runReducer, stepsFinished, type RunState } from "./run-reducer";
import { createPlanCaller } from "./server/claude";
import type { LimitsClient } from "./server/limits-client";
import { runPipeline, type SourceReader } from "./server/pipeline";

// Every mock fixture's real event list (the pipeline with injected limits, the real SDK against the
// in-process mock Messages API), fed through the reducer.

let server: Server;

const PASTED = ["https://instagram.com/lio.vance", "https://soundcloud.com/lio-vance", "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "https://www.eventim.de/artist/lio-vance/", "https://lio-vance.de/booking"];

const input = (fixture: string, tag: string, overrides: Partial<PipelineInput> = {}): PipelineInput => ({
  route: "welcome",
  pageLocale: "de",
  ownerLocale: "de",
  about: `Ich bin Lio, ich mache elektronische Musik und lege in Clubs auf. [[fixture:${fixture}#${tag}]]`,
  name: "Lio",
  kind: null,
  sources: [],
  pasted: PASTED,
  photo: null,
  ...overrides,
});

function limits(options: { stopAt?: (event: AiRunEvent) => boolean } = {}): LimitsClient & { observe: (event: AiRunEvent) => void } {
  let stop = false;
  return {
    observe: (event) => {
      if (options.stopAt?.(event)) stop = true;
    },
    reserve: () => Promise.resolve({ ok: true, id: "run-1", plan: "free", allowance: 1, used: 0, left: 1 }),
    recordProgress: () => Promise.resolve(),
    stopRequested: () => Promise.resolve(stop),
    settle: () => Promise.resolve(),
    disable: () => Promise.resolve(),
  };
}

const noSources: SourceReader = { read: () => Promise.reject(new Error("nothing is read in these tests")) };

async function events(fixture: string, overrides: Partial<PipelineInput> = {}, stopAt?: (event: AiRunEvent) => boolean): Promise<AiRunEvent[]> {
  const seen: AiRunEvent[] = [];
  const client = limits(stopAt ? { stopAt } : {});
  await runPipeline(
    { input: input(fixture, `reducer-${fixture}-${stopAt ? "stop" : "run"}`, overrides), account: "user-1", ipHash: "hash-1", owner: { username: "lio-vance", avatar: { src: NO_IMAGE, alt: "" } } },
    {
      emit: (event) => {
        seen.push(event);
        client.observe(event);
      },
      limits: client,
      claude: createPlanCaller(),
      sources: noSources,
      enrich: null,
      stopPollMs: 25,
      log: () => undefined,
    },
  );
  return seen;
}

const lists = new Map<string, AiRunEvent[]>();

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-local-test");
  vi.stubEnv("ANTHROPIC_BASE_URL", `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`);
  vi.stubEnv("VERCEL", "");
  const runs: [string, Promise<AiRunEvent[]>][] = [
    ["de-music", events("de-music")],
    ["ar-coach", events("ar-coach", { pageLocale: "ar", ownerLocale: "ar", about: "مدرّبة حياة في دبي [[fixture:ar-coach#reducer-ar]]" })],
    ["en-sparse", events("en-sparse", { pageLocale: "en", ownerLocale: "en", about: "I teach yoga in Leeds. [[fixture:en-sparse#reducer-en]]", pasted: [] })],
    ["refusal", events("refusal")],
    ["invalid-then-repair", events("invalid-then-repair")],
    ["max-tokens", events("max-tokens")],
    ["fallback", events("fallback")],
    // Stopped before any text: nothing kept.
    ["slow", events("slow", {}, (event) => event.type === "step" && event.key === "plan" && event.state === "start")],
    // Stopped after the first block: that block is kept.
    ["de-music-stopped", events("de-music", { about: "Lio. [[fixture:de-music#reducer-stop-late]]" }, (event) => event.type === "block")],
  ];
  for (const [name, list] of runs) lists.set(name, await list);
}, 30_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const list = (name: string): AiRunEvent[] => {
  const found = lists.get(name);
  if (!found) throw new Error(`no events for ${name}`);
  return found;
};

/** Times one second apart, so durations are known. */
const fed = (name: string): RunState => runFromEvents(list(name), (index) => 1_000 * index);

describe("runReducer with every fixture's events", () => {
  it.each(["de-music", "ar-coach", "en-sparse", "invalid-then-repair", "max-tokens", "fallback"])("%s ends in review, with every step finished and the final page's blocks", (name) => {
    const state = fed(name);
    const done = list(name).find((event) => event.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type !== "done") return;
    expect(state.phase).toBe("review");
    expect(state.result).toBe(done);
    expect(state.blocks).toEqual(done.page.blocks);
    expect(state.counted).toBe(true);
    expect(state.runId).toBe("run-1");
    expect(state.plan).toBe("free");
    expect(stepsFinished(state)).toBe(AI_STEPS.length);
    expect(currentStep(state)).toBeNull();
    for (const step of AI_STEPS) expect(["done", "skipped"]).toContain(state.steps[step].state);
    expect(state.look).toEqual({ kind: done.kind, theme: done.theme });
    expect(state.profile?.displayName).toBe(done.page.profile.displayName);
    expect(isLive(state)).toBe(false);
    expect(state.endedAt).not.toBeNull();
  });

  it("de-music: look, profile, four blocks in order, the notes, and the write and check counts", () => {
    const state = fed("de-music");
    expect(state.blocks).toHaveLength(4);
    expect(state.blocks.map((block) => block.origin)).toEqual(["ai", "ai", "ai", "ai"]);
    expect(state.look?.theme.template).toBe("nocturne");
    expect(state.notes.length).toBeGreaterThan(0);
    expect(state.steps.write).toMatchObject({ state: "done", counts: { blocks: 4 } });
    expect(state.steps.check.state).toBe("done");
    expect(state.steps.details.state).toBe("skipped");
    expect(state.steps.colors.state).toBe("skipped");
    // "Write" starts with the first block (the server says so just before it) and ends by done.
    const firstBlock = list("de-music").findIndex((event) => event.type === "block");
    const writeStart = list("de-music").findIndex((event) => event.type === "step" && event.key === "write" && event.state === "start");
    expect(writeStart).toBe(firstBlock - 1);
    expect(state.steps.write.startedAt).toBe(1_000 * writeStart);
    // A block alone starts it too (a recording that only has the blocks).
    const blocksOnly = runFromEvents(list("de-music").filter((event) => !(event.type === "step" && event.key === "write")), (index) => index);
    expect(blocksOnly.steps.write.state).toBe("done");
    expect(state.planStartedAt).toBe(1_000 * list("de-music").findIndex((event) => event.type === "step" && event.key === "plan" && event.state === "start"));
  });

  it("while it streams, the draft grows block by block and the run is live", () => {
    const events = list("de-music");
    let state = runReducer(initialRunState(), { type: "start", at: 0 });
    const counts: number[] = [];
    for (const [index, event] of events.entries()) {
      state = runReducer(state, { type: "event", event, at: index });
      if (event.type === "block") counts.push(draftOf(state).blocks.length);
      if (event.type !== "done") expect(isLive(state)).toBe(true);
    }
    expect(counts).toEqual([1, 2, 3, 4]);
  });

  it("refusal ends as an error, not counted, with nothing left running", () => {
    const state = fed("refusal");
    expect(state.phase).toBe("error");
    expect(state.error).toBe("refused");
    expect(state.counted).toBe(false);
    expect(AI_STEPS.some((step) => state.steps[step].state === "running")).toBe(false);
  });

  it("a stop before any text: stopped, no blocks, not counted", () => {
    const state = fed("slow");
    expect(state.phase).toBe("stopped");
    expect(state.blocks).toEqual([]);
    expect(state.counted).toBe(false);
  });

  it("a stop after the first block keeps the blocks that arrived", () => {
    const state = fed("de-music-stopped");
    const stopped = list("de-music-stopped").at(-1);
    expect(stopped?.type).toBe("stopped");
    expect(state.phase).toBe("stopped");
    expect(state.counted).toBe(true);
    expect(state.blocks.length).toBeGreaterThanOrEqual(1);
    if (stopped?.type === "stopped") expect(state.blocks).toEqual(stopped.page?.blocks);
  });

  it("a repeated done (or anything after the end) is ignored", () => {
    const state = fed("de-music");
    const done = list("de-music").find((event) => event.type === "done");
    if (done?.type !== "done") throw new Error("no done");
    const again = runReducer(state, { type: "event", event: { ...done, page: { ...done.page, blocks: [] } }, at: 99_000 });
    expect(again).toBe(state);
    expect(runReducer(state, { type: "event", event: { type: "error", code: "server", counted: false }, at: 99_000 })).toBe(state);
  });

  it("an out-of-order drop is kept once, and a late block lands at its index", () => {
    const events = list("de-music");
    const blocks = events.filter((event) => event.type === "block");
    const others = events.filter((event) => event.type !== "block" && event.type !== "done");
    const drop: AiRunEvent = { type: "drop", index: 9, reason: "duplicate" };
    // The drop comes before the first block and again later; blocks arrive 2, 0, 3, 1.
    const order = [blocks[2], blocks[0], blocks[3], blocks[1]].filter((event) => event !== undefined);
    const state = runFromEvents([...others, drop, ...order, drop]);
    expect(state.drops).toEqual([drop]);
    expect(state.blocks.map((block) => block.id)).toEqual(blocks.map((event) => event.block.id));
  });

  it("start, stopRequested and reset", () => {
    const started = runReducer(initialRunState(), { type: "start", at: 5, pageLocale: "ar", photo: { vibrant: "#c2410c", dominant: "#1c1917" } });
    expect(started).toMatchObject({ phase: "running", startedAt: 5, pageLocale: "ar", photo: { vibrant: "#c2410c" } });
    expect(currentStep(started)).toBe("read");
    const stopping = runReducer(started, { type: "stopRequested" });
    expect(stopping.phase).toBe("stopping");
    // Events still arrive while it stops.
    expect(runReducer(stopping, { type: "event", event: { type: "step", key: "read", state: "start" }, at: 6 }).steps.read.state).toBe("running");
    expect(runReducer(stopping, { type: "reset" })).toEqual(initialRunState());
    // Before a run starts, events change nothing.
    const idle = initialRunState();
    expect(runReducer(idle, { type: "event", event: { type: "step", key: "read", state: "start" }, at: 1 })).toBe(idle);
  });

  it("a step never goes back: a late start after its end is ignored", () => {
    let state = runReducer(initialRunState(), { type: "start", at: 0 });
    state = runReducer(state, { type: "event", event: { type: "step", key: "read", state: "done", counts: { links: 3, profiles: 1 } }, at: 1 });
    const late = runReducer(state, { type: "event", event: { type: "step", key: "read", state: "start" }, at: 2 });
    expect(late).toBe(state);
    expect(state.steps.read).toMatchObject({ state: "done", counts: { links: 3, profiles: 1 } });
  });
});

describe("shownState", () => {
  it("shows the step a live run waits on as working, and keeps the real state otherwise", async () => {
    const { initialRunState, shownState } = await import("./run-reducer");
    const base = initialRunState();
    const live = { ...base, phase: "running" as const, steps: { ...base.steps, read: { state: "done" as const } } };
    expect(shownState(live, "details")).toBe("running");
    expect(shownState(live, "check")).toBe("pending");
    expect(shownState({ ...live, phase: "review" as const }, "details")).toBe("pending");
  });
});
