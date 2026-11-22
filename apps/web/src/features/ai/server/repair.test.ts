import { pageSchema, NO_IMAGE } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { MAX_TOKENS, REPAIR_MAX_TOKENS } from "../limits";
import type { PageDraft } from "../plan-to-page";

import { followUpFits, followUpSettings, parsePlanText, planProblems, ROUTE_EFFORT } from "./repair";

const draft = (blocks: number, drops: PageDraft["drops"] = []): PageDraft => ({
  page: pageSchema.parse({
    profile: { username: "lio-vance", displayName: "Lio", bio: "", avatar: { src: NO_IMAGE, alt: "" }, locale: "de" },
    blocks: Array.from({ length: blocks }, (_, index) => ({ id: `text-${String(index)}`, type: "text", text: "Hallo" })),
  }),
  theme: {},
  kind: "music",
  notes: [],
  fixed: 0,
  drops,
});

describe("repair", () => {
  it("reads JSON or says it is none", () => {
    expect(parsePlanText('{"kind":"music"}')).toEqual({ value: { kind: "music" } });
    expect(parsePlanText('{"kind":')).toBeNull();
  });

  it("finds the hard failures: cut off, not JSON, no blocks although there were links, more than 30 % removed", () => {
    expect(planProblems({ stopReason: "max_tokens", unparseable: false, draft: draft(3), planBlocks: 3, bundleLinks: 3 })).toEqual([{ path: "$", code: "max_tokens" }]);
    expect(planProblems({ stopReason: "end_turn", unparseable: true, draft: null, planBlocks: 0, bundleLinks: 3 })).toEqual([{ path: "$", code: "unparseable" }]);
    expect(planProblems({ stopReason: "end_turn", unparseable: false, draft: draft(0), planBlocks: 0, bundleLinks: 3 })).toEqual([{ path: "$.blocks", code: "empty" }]);
    expect(planProblems({ stopReason: "end_turn", unparseable: false, draft: draft(0), planBlocks: 0, bundleLinks: 0 })).toEqual([]);
    const drops: PageDraft["drops"] = [
      { index: 1, reason: "unknownLink" },
      { index: 3, reason: "duplicate" },
    ];
    expect(planProblems({ stopReason: "end_turn", unparseable: false, draft: draft(4, drops), planBlocks: 6, bundleLinks: 5 })).toEqual([
      { path: "$.blocks[1]", code: "unknownLink" },
      { path: "$.blocks[3]", code: "duplicate" },
    ]);
    expect(planProblems({ stopReason: "end_turn", unparseable: false, draft: draft(8, drops), planBlocks: 10, bundleLinks: 5 })).toEqual([]);
  });

  it("repairs a parse failure cheaply, but gives a cut-off answer the route's own effort and cap", () => {
    expect(followUpSettings("welcome", [{ path: "$", code: "unparseable" }])).toEqual({ effort: "low", maxTokens: REPAIR_MAX_TOKENS });
    expect(followUpSettings("welcome", [{ path: "$", code: "max_tokens" }])).toEqual({ effort: "medium", maxTokens: MAX_TOKENS.welcome });
    expect(followUpSettings("team", [{ path: "$", code: "max_tokens" }])).toEqual({ effort: "high", maxTokens: 32_000 });
    expect(ROUTE_EFFORT).toEqual({ welcome: "medium", dashboard: "medium", team: "high" });
  });

  it("only follows up with at least 70 s left", () => {
    expect(followUpFits(100_000, 30_000)).toBe(true);
    expect(followUpFits(100_000, 30_001)).toBe(false);
  });
});
