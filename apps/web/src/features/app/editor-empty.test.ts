import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { emptyPageAsk } from "./editor-empty";

describe("the editor's empty page", () => {
  it("asks a portfolio for its first project only in the dashboard, where the three ways to add one are", () => {
    expect(emptyPageAsk(true, true)).toBe("work");
    // The team area mounts the editor outside the shell (a proposal for a photographer, a prepared
    // page): its one button adds a link, so the words must not ask for a project.
    expect(emptyPageAsk(true, false)).toBe("link");
    expect(emptyPageAsk(false, true)).toBe("link");
    expect(emptyPageAsk(false, false)).toBe("link");
  });

  it("never sets the project words over the link button", () => {
    const source = readFileSync(path.join(import.meta.dirname, "editor-screen.tsx"), "utf8");
    // The branch with the "add your first link" button uses the link words only.
    const fallback = source.slice(source.indexOf(') : empty ? ('), source.indexOf('{t("addFirst")}'));
    expect(fallback).not.toBe("");
    expect(fallback).not.toContain('tWork("empty.');
    expect(fallback).toContain('t("emptyTitle")');
  });
});
