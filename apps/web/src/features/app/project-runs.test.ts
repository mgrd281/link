import { FEATURED_PROJECTS, type Block, type BlockOf } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { projectRuns } from "./project-runs";

// The editor names each run of projects with the layout the page gives it, and the Design screen says
// when the page cannot follow the choice. Both must see the page as the renderer does: hidden and
// scheduled blocks neither change a layout nor split a run.

type Project = BlockOf<"project">;
const base = { visible: true, highlight: false } as const;
const picture = (id: string, patch: Partial<Project> = {}): Project => ({
  ...base,
  id,
  type: "project",
  slug: `projekt-${id}`,
  title: `Projekt ${id}`,
  summary: "Ein Satz.",
  cover: { src: "/samples/ronja-01.jpg", alt: "Ein Bild", w: 1200, h: 800 },
  ...patch,
});
const link = (id: string, patch: Partial<BlockOf<"link">> = {}): Block => ({ ...base, id, type: "link", title: "Ein Link", url: "https://example.com", ...patch });
const NOW = new Date("2026-11-23T12:00:00Z");

describe("projectRuns", () => {
  it("leaves a hidden project out of the layout, but lists it in its run", () => {
    // Grid wanted, three picture projects, one switched off: the page has two and shows a list.
    const blocks = [picture("a"), picture("b", { visible: false }), picture("c")];
    const runs = projectRuns(blocks, "bento", NOW);
    expect(runs.layouts).toEqual(["list"]);
    expect(runs.starts.get("a")).toEqual({ count: 3, layout: "list" });
    expect(runs.position.get("b")).toBe(0);
    expect(runs.position.get("c")).toBe(2);
    // All three shown: a grid.
    expect(projectRuns([picture("a"), picture("b"), picture("c")], "bento", NOW).layouts).toEqual(["bento"]);
  });

  it("does not count a project scheduled for later", () => {
    const runs = projectRuns([picture("a"), picture("b", { schedule: { from: "2099-01-01T00:00:00Z" } }), picture("c")], "bento", NOW);
    expect(runs.layouts).toEqual(["list"]);
  });

  it("lets a hidden block between projects keep them in one run on the page", () => {
    const blocks = [picture("a"), picture("b"), link("l", { visible: false }), picture("c"), picture("d")];
    const runs = projectRuns(blocks, "bento", NOW);
    // The page: one run of four, a grid. The list: two runs, both named after it.
    expect(runs.layouts).toEqual(["bento"]);
    expect(runs.starts.get("a")).toEqual({ count: 2, layout: "bento" });
    expect(runs.starts.get("c")).toEqual({ count: 2, layout: "bento" });
    expect(runs.position.get("d")).toBe(4);
    // A shown block between them splits the run on the page too.
    expect(projectRuns([picture("a"), picture("b"), link("l"), picture("c"), picture("d")], "bento", NOW).layouts).toEqual(["list", "list"]);
  });

  it("counts the places of shown projects only, so the note under the sixth is right", () => {
    const blocks = [picture("a", { visible: false }), ...["b", "c", "d", "e", "f", "g"].map((id) => picture(id))];
    const runs = projectRuns(blocks, "auto", NOW);
    expect(runs.position.get("g")).toBe(FEATURED_PROJECTS);
    expect([...runs.position.values()].filter((place) => place > FEATURED_PROJECTS)).toEqual([]);
  });

  it("names no layout for a run the page does not show at all", () => {
    const runs = projectRuns([picture("a", { visible: false }), picture("b", { visible: false })], "auto", NOW);
    expect(runs.starts.get("a")).toEqual({ count: 2, layout: null });
    expect(runs.layouts).toEqual([]);
  });
});
