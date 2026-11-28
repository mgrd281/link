import type { Block, Page } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { initialEditorState } from "@/features/directions/editor/state";

import { siteReducer, type SiteDoc } from "./site-context";

// Provenance on the owner's own edits: an AI block that is changed becomes "ai-edited"; the profile's
// list of AI texts stays as it is when the owner edits them (only a new applied draft replaces it).

const link = (id: string, origin?: Block["origin"]): Block =>
  ({ id, type: "link", title: `Link ${id}`, url: `https://example.com/${id}`, visible: true, highlight: false, ...(origin ? { origin } : {}) });

const profile: Page["profile"] = {
  username: "lio-vance",
  displayName: "Lio Vance",
  bio: "DJ und Produzent aus Berlin.",
  tagline: "DJ · Producer",
  avatar: { src: "none:", alt: "" },
  verified: false,
  locale: "de",
  aiFields: ["tagline", "bio"],
};

const doc = (blocks: Block[]): SiteDoc => ({ profile, blocks, sizes: {}, theme: { template: "nocturne" } });

describe("siteReducer provenance", () => {
  it("an update of an AI block makes it ai-edited (one undoable step)", () => {
    const state = initialEditorState(doc([link("a", "ai"), link("b")]));
    const next = siteReducer(state, { type: "update", id: "a", patch: { title: "Neu" } as Partial<Block> });
    expect(next.present.blocks[0]).toMatchObject({ id: "a", title: "Neu", origin: "ai-edited" });
    expect(next.past).toHaveLength(1);
    expect(siteReducer(next, { type: "undo" }).present.blocks[0]?.origin).toBe("ai");
  });

  it("other blocks keep their origin: human stays human, ai-edited stays ai-edited", () => {
    const state = initialEditorState(doc([link("a", "ai-edited"), link("b"), link("c", "human")]));
    let next = siteReducer(state, { type: "update", id: "a", patch: { title: "x" } as Partial<Block> });
    next = siteReducer(next, { type: "update", id: "b", patch: { title: "y" } as Partial<Block> });
    next = siteReducer(next, { type: "update", id: "c", patch: { title: "z" } as Partial<Block> });
    expect(next.present.blocks.map((block) => block.origin)).toEqual(["ai-edited", undefined, "human"]);
  });

  it("details filled in later (enrich) do not change an AI block's origin", () => {
    const state = initialEditorState(doc([link("a", "ai")]));
    const next = siteReducer(state, { type: "enrich", id: "a", patch: { title: "From the platform" } as Partial<Block> });
    expect(next.present.blocks[0]?.origin).toBe("ai");
  });

  it("editing the bio keeps profile.aiFields as it is", () => {
    const state = initialEditorState(doc([]));
    const next = siteReducer(state, { type: "profile", patch: { bio: "Neu geschrieben." } });
    expect(next.present.profile.bio).toBe("Neu geschrieben.");
    expect(next.present.profile.aiFields).toEqual(["tagline", "bio"]);
    // A whole profile from a form (as the profile sheet saves it) keeps it too, even without the list.
    const { aiFields: _ignored, ...form } = { ...profile, displayName: "Lio V." };
    const saved = siteReducer(state, { type: "profile", patch: { ...form, aiFields: undefined } });
    expect(saved.present.profile).toMatchObject({ displayName: "Lio V.", aiFields: ["tagline", "bio"] });
  });

  it("only applying a draft (replace) changes the list", () => {
    const state = initialEditorState(doc([]));
    const next = siteReducer(state, { type: "replace", doc: { ...doc([link("n", "ai")]), profile: { ...profile, aiFields: ["bio"] } } });
    expect(next.present.profile.aiFields).toEqual(["bio"]);
    expect(siteReducer(next, { type: "undo" }).present.profile.aiFields).toEqual(["tagline", "bio"]);
  });
});

// D-09: Settings › Sichtbarkeit lives on the profile, but it is a setting of the page, not content.
describe("siteReducer and the page's visibility", () => {
  const paused = { paused: true, search: false, title: "Lio Vance – DJ", description: "Sets und Termine." };
  const withVisibility = (visibility?: Page["profile"]["visibility"]): SiteDoc => ({ ...doc([link("a")]), profile: { ...profile, ...(visibility ? { visibility } : {}) } });

  it("is changed like any profile field, as one undoable step", () => {
    const state = initialEditorState(withVisibility());
    const next = siteReducer(state, { type: "profile", patch: { visibility: { paused: true } } });
    expect(next.present.profile.visibility).toEqual({ paused: true });
    expect(siteReducer(next, { type: "undo" }).present.profile.visibility).toBeUndefined();
  });

  it("is kept when a draft, a proposal or an imported page replaces the page: the AI never unpauses or publishes it", () => {
    const state = initialEditorState(withVisibility(paused));
    const draft: SiteDoc = { ...doc([link("ai-1", "ai")]), profile: { ...profile, displayName: "Neu" } };
    const next = siteReducer(state, { type: "replace", doc: draft });
    expect(next.present.profile.displayName).toBe("Neu");
    expect(next.present.profile.visibility).toEqual(paused);
    // An imported file that carries other settings does not bring them either.
    const file = withVisibility({ paused: false, title: "Fremd" });
    expect(siteReducer(state, { type: "replace", doc: file }).present.profile.visibility).toEqual(paused);
    // A document that already carries the page's settings is taken as it is (an import's Undo compares it).
    const same = withVisibility(paused);
    expect(siteReducer(state, { type: "replace", doc: same }).present).toBe(same);
    // A page without settings stays without them.
    expect(siteReducer(initialEditorState(withVisibility()), { type: "replace", doc: file }).present.profile).not.toHaveProperty("visibility");
  });

  it("comes from the server as it is when the store replaced the page (reset)", () => {
    const state = initialEditorState(withVisibility(paused));
    expect(siteReducer(state, { type: "reset", doc: withVisibility() }).present.profile.visibility).toBeUndefined();
  });
});
