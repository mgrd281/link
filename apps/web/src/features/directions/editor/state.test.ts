import { describe, expect, it } from "vitest";

import { detectLink } from "@linkyo/blocks";

import { blockFromDetection, editorReducer, initialEditorState } from "./state";

const labels = { video: "Video", music: "New release", event: "Event" };

describe("editor reducer", () => {
  const start = initialEditorState({
    blocks: [
      { id: "a", type: "header", title: "A", visible: true, highlight: false },
      { id: "b", type: "header", title: "B", visible: true, highlight: false },
    ],
    sizes: {},
    theme: { preset: "paper" },
  });

  it("moves, undoes and redoes", () => {
    const moved = editorReducer(start, { type: "move", id: "a", to: 1 });
    expect(moved.present.blocks.map((b) => b.id)).toEqual(["b", "a"]);
    const undone = editorReducer(moved, { type: "undo" });
    expect(undone.present.blocks.map((b) => b.id)).toEqual(["a", "b"]);
    const redone = editorReducer(undone, { type: "redo" });
    expect(redone.present.blocks.map((b) => b.id)).toEqual(["b", "a"]);
  });

  it("removes with undo and toggles visibility", () => {
    const removed = editorReducer(start, { type: "remove", id: "a" });
    expect(removed.present.blocks).toHaveLength(1);
    expect(editorReducer(removed, { type: "undo" }).present.blocks).toHaveLength(2);
    const hidden = editorReducer(start, { type: "toggle", id: "b" });
    expect(hidden.present.blocks[1]?.visible).toBe(false);
  });

  it("selection is not part of the history", () => {
    const selected = editorReducer(start, { type: "select", id: "a" });
    expect(selected.past).toHaveLength(0);
  });

  it("creates valid optimistic blocks from smart detect", () => {
    for (const url of ["https://youtu.be/abc", "https://open.spotify.com/track/x", "https://www.eventim.de/e/1", "https://example.com"]) {
      const detection = detectLink(url);
      expect(detection).not.toBeNull();
      if (detection) expect(blockFromDetection(detection, labels).type).toBe(detection.type === "shorts" ? "link" : detection.type);
    }
  });
});
