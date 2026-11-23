import { describe, expect, it } from "vitest";

import { settle } from "./load";
import { aiStart, currentDraft, refundState, storyRemovable, withIdea, withKit, withMessage, withoutStory, withStory, type ProposalMeta } from "./order-rules";
import type { TeamOrder, TeamProposal } from "./orders-data";

const proposal = (round: number, status: TeamProposal["status"], storyPaths: string[] = []): TeamProposal => ({
  id: `p-${String(round)}`,
  round,
  status,
  page: { profile: { username: "mila", displayName: "Mila" }, blocks: [] } as unknown as TeamProposal["page"],
  theme: {},
  kind: null,
  message: null,
  request: null,
  extras: null,
  storyPaths,
  aiAssisted: false,
  updatedAt: null,
  deliveredAt: null,
});

const briefing = { links: ["https://example.com"], photos: [], wishes: "", pageLocale: "de" as const };
const order = (overrides: Partial<TeamOrder> = {}) =>
  ({ status: "in_progress", withdrawalPending: false, briefing, proposals: [], revisionsUsed: 0, ...overrides }) as Pick<
    TeamOrder,
    "status" | "withdrawalPending" | "briefing" | "proposals" | "revisionsUsed"
  >;

describe("the AI draft button", () => {
  it("runs at once when the round has no proposal yet", () => {
    expect(aiStart(order())).toBe("go");
  });

  it("asks first when the round already has a draft: the run would replace it for good", () => {
    expect(aiStart(order({ proposals: [proposal(0, "draft")] }))).toBe("confirm");
    expect(aiStart(order({ revisionsUsed: 1, proposals: [proposal(1, "draft"), proposal(0, "delivered")] }))).toBe("confirm");
  });

  it("does nothing once the round is delivered, without a briefing, or while the order is locked", () => {
    expect(aiStart(order({ proposals: [proposal(0, "delivered")] }))).toBe("blocked");
    expect(aiStart(order({ briefing: null }))).toBe("blocked");
    expect(aiStart(order({ withdrawalPending: true, proposals: [proposal(0, "draft")] }))).toBe("blocked");
    expect(aiStart(order({ status: "refunded" }))).toBe("blocked");
  });
});

describe("the refund button on an order", () => {
  it("is not offered while a withdrawal waits (it would be booked as the voluntary money-back)", () => {
    expect(refundState({ status: "queued", withdrawalPending: true })).toBe("withdrawal");
    expect(refundState({ status: "delivered", withdrawalPending: true })).toBe("withdrawal");
  });

  it("is offered on an open order and gone on a closed one", () => {
    expect(refundState({ status: "delivered", withdrawalPending: false })).toBe("open");
    expect(refundState({ status: "refunded", withdrawalPending: false })).toBe("closed");
    expect(refundState({ status: "withdrawn", withdrawalPending: true })).toBe("closed");
  });
});

describe("story pictures of a proposal", () => {
  it("a picture only the draft lists can be deleted with its removal", () => {
    const current = order({ proposals: [proposal(0, "draft", ["c/o/a.png", "c/o/b.png"])] });
    expect(currentDraft(current)?.id).toBe("p-0");
    expect(storyRemovable(current, "c/o/a.png")).toBe(true);
  });

  it("a picture an earlier, delivered round lists stays: the customer still has that proposal", () => {
    const current = order({ revisionsUsed: 1, proposals: [proposal(1, "draft", ["c/o/a.png", "c/o/new.png"]), proposal(0, "superseded", ["c/o/a.png"])] });
    expect(storyRemovable(current, "c/o/a.png")).toBe(false);
    expect(storyRemovable(current, "c/o/new.png")).toBe(true);
  });
});

describe("changes to the message and the kit", () => {
  const start: ProposalMeta = { message: "", kit: { bioInstagram: "", bioTiktok: "", postingPlan: [1, 2, 3, 4].map((week) => ({ week, idea: "" })) }, stories: [] };

  it("a picture that finishes uploading keeps what was typed while it uploaded", () => {
    // The upload starts on `start`; meanwhile the team types week 1, a bio and the message.
    const lateUpload = withStory("c/o/story.png");
    const typed = withMessage("Hallo Mila")(withKit({ bioInstagram: "Sängerin aus Köln" })(withIdea(1, "Tourdaten zuerst")(start)));
    const after = lateUpload(typed);
    expect(after.stories).toEqual(["c/o/story.png"]);
    expect(after.kit.postingPlan[0]).toEqual({ week: 1, idea: "Tourdaten zuerst" });
    expect(after.kit.bioInstagram).toBe("Sängerin aus Köln");
    expect(after.message).toBe("Hallo Mila");
  });

  it("lists a picture once, at most three, and takes one out again", () => {
    const three = ["a", "b", "c"].reduce((meta, path) => withStory(path)(meta), start);
    expect(withStory("a")(three).stories).toEqual(["a", "b", "c"]);
    expect(withStory("d")(three).stories).toEqual(["a", "b", "c"]);
    expect(withoutStory("b")(three).stories).toEqual(["a", "c"]);
    expect(start.stories).toEqual([]);
  });
});

describe("a read of the console", () => {
  it("that fails is told apart from an empty answer", async () => {
    expect(await settle(() => Promise.reject(new Error("JWT expired")))).toEqual({ status: "failed" });
    expect(await settle(() => Promise.resolve([]))).toEqual({ status: "ready", data: [] });
    expect(await settle(() => Promise.resolve(null))).toEqual({ status: "ready", data: null });
  });
});
