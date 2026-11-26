import { describe, expect, it } from "vitest";

import { editLinkTarget, withoutEditParam } from "./edit-link";

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
