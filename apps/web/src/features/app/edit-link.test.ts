import { describe, expect, it } from "vitest";

import { editLinkOutcome, editLinkReplaces, editLinkTarget, withoutEditParam } from "./edit-link";

describe("the editor's ?edit= link", () => {
  const ids = ["b1", "b2", "project-7"];

  it("opens a block the page has", () => {
    expect(editLinkTarget("b2", ids)).toBe("b2");
    expect(editLinkTarget("project-7", ids)).toBe("project-7");
  });

  it("opens nothing for an unknown, empty or missing id", () => {
    expect(editLinkTarget("b9", ids)).toBeNull();
    expect(editLinkTarget("", ids)).toBeNull();
    expect(editLinkTarget(null, ids)).toBeNull();
    expect(editLinkTarget("b1", [])).toBeNull();
  });

  it("leaves the address without the request, every other part kept", () => {
    expect(withoutEditParam({ pathname: "/de/app/editor", search: "?edit=b1", hash: "" })).toBe("/de/app/editor");
    expect(withoutEditParam({ pathname: "/de/app/editor", search: "?source=app&edit=b1", hash: "#blocks-title" })).toBe("/de/app/editor?source=app#blocks-title");
    expect(withoutEditParam({ pathname: "/ar/app/editor", search: "", hash: "" })).toBe("/ar/app/editor");
  });
});

describe("what a ?edit= link does", () => {
  const ids = ["b1", "b2"];

  it("opens a block the page has, and tells the app nothing yet", () => {
    expect(editLinkOutcome("b2", ids)).toEqual({ open: "b2" });
  });

  it("tells the app at once that nothing opened for a block the page does not have", () => {
    expect(editLinkOutcome("gone", ids)).toEqual({ closed: { type: "editClosed", id: "gone", missing: true } });
    expect(editLinkOutcome("b1", [])).toEqual({ closed: { type: "editClosed", id: "b1", missing: true } });
  });

  it("does nothing without a request, and nothing for an empty id (the app asked for no block)", () => {
    expect(editLinkOutcome(null, ids)).toBeNull();
    expect(editLinkOutcome("", ids)).toBeNull();
  });
});

describe("a second ?edit= while the sheet an earlier one opened is still open", () => {
  it("closes that sheet for the new one: the app hears editClosed for the earlier block first", () => {
    expect(editLinkReplaces("b1", "b2")).toEqual({ type: "editClosed", id: "b1" });
  });

  it("tells nothing when no link's sheet is open, or when the same block is asked for again (its sheet stays)", () => {
    expect(editLinkReplaces(null, "b2")).toBeNull();
    expect(editLinkReplaces("b2", "b2")).toBeNull();
  });
});
