import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { NO_IMAGE } from "@linkyo/blocks";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { handle } from "../../../e2e/mocks/anthropic.handler.mjs";

import { announcementKey, announcementsFor, spokenSoFar, STILL_PLANNING_AT, type Announcement, type RunMoment } from "./announce";
import type { AiRunEvent } from "./events";
import { initialRunState, runReducer, type RunState } from "./run-reducer";
import { createPlanCaller } from "./server/claude";
import { runPipeline } from "./server/pipeline";

// The screen-reader budget (WCAG 4.1.3, 2.2.2): a whole real run says at most 12 sentences in the
// log, and a long planning wait adds at most two.

let server: Server;
let deMusic: AiRunEvent[] = [];

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-local-test");
  vi.stubEnv("ANTHROPIC_BASE_URL", `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`);
  vi.stubEnv("VERCEL", "");
  const events: AiRunEvent[] = [];
  await runPipeline(
    {
      input: {
        route: "welcome",
        pageLocale: "de",
        ownerLocale: "de",
        about: "Ich bin Lio, DJ aus Berlin. [[fixture:de-music#announce]]",
        name: "Lio",
        kind: null,
        sources: [],
        pasted: ["https://instagram.com/lio.vance", "https://soundcloud.com/lio-vance", "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "https://www.eventim.de/artist/lio-vance/", "https://lio-vance.de/booking"],
        photo: { vibrant: "#c2410c", dominant: "#1c1917", mode: "dark" },
      },
      account: "user-1",
      ipHash: "hash-1",
      owner: { username: "lio-vance", avatar: { src: NO_IMAGE, alt: "" } },
    },
    {
      emit: (event) => events.push(event),
      limits: {
        reserve: () => Promise.resolve({ ok: true, id: "run-1", plan: "free", allowance: 1, used: 0, left: 1 }),
        recordProgress: () => Promise.resolve(),
        stopRequested: () => Promise.resolve(false),
        settle: () => Promise.resolve(),
        disable: () => Promise.resolve(),
      },
      claude: createPlanCaller(),
      sources: { read: () => Promise.reject(new Error("no reading")) },
      enrich: () => Promise.resolve(new Map()),
      stopPollMs: 25,
      log: () => undefined,
    },
  );
  deMusic = events;
}, 20_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Feeds the events one at a time (`gap` ms apart) and collects what each step adds to the log. */
function replay(events: readonly AiRunEvent[], gap: number): { said: Announcement[]; last: RunMoment } {
  let moment: RunMoment = { state: runReducer(initialRunState(), { type: "start", at: 0 }), at: 0 };
  const said: Announcement[] = announcementsFor({ state: initialRunState(), at: 0 }, moment);
  events.forEach((event, index) => {
    const at = (index + 1) * gap;
    const next: RunMoment = { state: runReducer(moment.state, { type: "event", event, at }), at };
    said.push(...announcementsFor(moment, next));
    moment = next;
  });
  return { said, last: moment };
}

describe("announcementsFor", () => {
  it("a whole de-music run says at most 12 sentences, each once, steps only", () => {
    const { said, last } = replay(deMusic, 400);
    expect(last.state.phase).toBe("review");
    expect(said.length).toBeGreaterThan(0);
    expect(said.length).toBeLessThanOrEqual(12);
    const keys = said.map(announcementKey);
    expect(new Set(keys).size).toBe(keys.length);
    // Nothing per block, per source or per second.
    expect(keys).toEqual(["start-read", "done-read", "start-details", "start-colors", "start-plan", "done-plan", "done-look", "start-write", "start-check", "done-check"]);
    // What the log renders at the end is exactly what was said along the way.
    expect(spokenSoFar(last.state, last.at)).toEqual(said);
  });

  it("the same run said in one batch (all events between two looks) says the same sentences", () => {
    const end = deMusic.reduce<RunState>((state, event, index) => runReducer(state, { type: "event", event, at: index }), runReducer(initialRunState(), { type: "start", at: 0 }));
    const said = announcementsFor({ state: initialRunState(), at: 0 }, { state: end, at: deMusic.length });
    expect(said.map(announcementKey)).toEqual(replay(deMusic, 1).said.map(announcementKey));
  });

  it("a 75 s planning wait adds at most two 'still planning' sentences, at 30 and 60 s", () => {
    let state = runReducer(initialRunState(), { type: "start", at: 0 });
    for (const event of deMusic.slice(0, deMusic.findIndex((item) => item.type === "step" && item.key === "plan" && item.state === "start") + 1)) {
      state = runReducer(state, { type: "event", event, at: 0 });
    }
    expect(state.steps.plan.state).toBe("running");
    const added: Announcement[] = [];
    for (let second = 1; second <= 75; second += 1) added.push(...announcementsFor({ state, at: (second - 1) * 1000 }, { state, at: second * 1000 }));
    expect(added).toEqual(STILL_PLANNING_AT.map((seconds) => ({ kind: "stillPlanning", seconds })));
    // Asked once for the whole wait (a slow tab), still at most two.
    expect(announcementsFor({ state, at: 0 }, { state, at: 75_000 })).toHaveLength(2);
    // And never again after the planning ended.
    const planned = runReducer(state, { type: "event", event: { type: "step", key: "plan", state: "done", ms: 75_000 }, at: 75_000 });
    expect(announcementsFor({ state: planned, at: 75_000 }, { state: planned, at: 200_000 })).toEqual([]);
    expect(spokenSoFar(planned, 200_000).filter((item) => item.kind === "stillPlanning")).toHaveLength(2);
  });

  it("says nothing before a run starts, and a new run starts from an empty log", () => {
    const idle = initialRunState();
    expect(announcementsFor({ state: idle, at: 0 }, { state: idle, at: 60_000 })).toEqual([]);
    expect(spokenSoFar(idle, 60_000)).toEqual([]);
    const { last } = replay(deMusic, 100);
    const fresh = runReducer(last.state, { type: "start", at: 99_000 });
    expect(announcementsFor(last, { state: fresh, at: 99_000 })).toEqual([]);
  });

  it("skipped colours say so once, instead of a step start", () => {
    let state = runReducer(initialRunState(), { type: "start", at: 0 });
    const before: RunMoment = { state, at: 0 };
    state = runReducer(state, { type: "event", event: { type: "step", key: "colors", state: "skip" }, at: 1 });
    expect(announcementsFor(before, { state, at: 1 })).toEqual([{ kind: "colorsSkip" }]);
  });
});
