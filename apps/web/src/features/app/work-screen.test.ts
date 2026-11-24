import { nextStep, type Block, type BlockOf } from "@linkyo/blocks";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({ push: () => undefined }), usePathname: () => "/" }));

import { missingAlt, newProjectIndex, projectsOf, showsWork, swapProject } from "./work-screen";

type Project = BlockOf<"project">;

const picture = (alt = "") => ({ src: "data:image/jpeg;base64,0", alt, tone: "dark" as const, w: 1200, h: 800 });
const project = (id: string, patch: Partial<Project> = {}): Project => ({ id, type: "project", visible: true, highlight: false, slug: id, title: id, summary: "", ...patch });
const link = (id: string): Block => ({ id, type: "link", visible: true, highlight: false, title: id, url: `https://example.com/${id}` });
const header = (id: string): Block => ({ id, type: "header", visible: true, highlight: false, title: id });
const socials: Block = { id: "s", type: "socials", visible: true, highlight: false, items: [] };
const ids = (blocks: readonly Block[] | null) => blocks?.map((block) => block.id) ?? null;

describe("pictures waiting for a description", () => {
  it("counts the cover and every picture without one, never a decorative picture", () => {
    expect(missingAlt(project("a"))).toBe(0);
    expect(missingAlt(project("a", { cover: picture() }))).toBe(1);
    expect(missingAlt(project("a", { cover: picture("Ein Hafen bei Nacht") }))).toBe(0);
    // Spaces are no description.
    expect(missingAlt(project("a", { cover: picture("  ") }))).toBe(1);
    const pictures = [{ image: picture() }, { image: picture("Netze") }, { image: picture(), decorative: true }, { image: picture() }];
    expect(missingAlt(project("a", { cover: picture(), pictures }))).toBe(3);
  });

  it("agrees with the project's next step: a missing description is what it asks for first after the address", () => {
    const waiting = project("hafen", { cover: picture() });
    expect(missingAlt(waiting)).toBeGreaterThan(0);
    expect(nextStep(waiting)).toBe("alt");
    const described = project("hafen", { cover: picture("Ein Kutter") });
    expect(missingAlt(described)).toBe(0);
    expect(nextStep(described)).not.toBe("alt");
  });
});

describe("the Arbeiten view", () => {
  it("is there for pages made to show work and for any page with a project", () => {
    expect(showsWork("photographer", [])).toBe(true);
    expect(showsWork("developer", [])).toBe(true);
    expect(showsWork("music", [])).toBe(false);
    expect(showsWork(undefined, [])).toBe(false);
    expect(showsWork("music", [link("l"), project("p")])).toBe(true);
  });

  it("lists the projects in page order", () => {
    expect(ids(projectsOf([socials, project("b"), link("l"), project("a")]))).toEqual(["b", "a"]);
  });
});

describe("moving a project", () => {
  const page: Block[] = [socials, header("work"), project("a"), link("between"), project("b"), project("c"), header("contact")];

  it("swaps it with the project before or after it; everything else stays put", () => {
    expect(ids(swapProject(page, "b", -1))).toEqual(["s", "work", "b", "between", "a", "c", "contact"]);
    expect(ids(swapProject(page, "b", 1))).toEqual(["s", "work", "a", "between", "c", "b", "contact"]);
    // Moving back undoes it.
    const there = swapProject(page, "b", 1);
    expect(ids(there && swapProject(there, "b", -1))).toEqual(ids(page));
  });

  it("does nothing at the ends or for a block that is not a project", () => {
    expect(swapProject(page, "a", -1)).toBeNull();
    expect(swapProject(page, "c", 1)).toBeNull();
    expect(swapProject(page, "between", 1)).toBeNull();
    expect(swapProject(page, "missing", 1)).toBeNull();
  });

  it("never changes the page it was given", () => {
    const before = ids(page);
    swapProject(page, "b", -1);
    expect(ids(page)).toEqual(before);
  });
});

describe("where a new project goes", () => {
  it("in front of the first project, so it leads and stays in the section", () => {
    expect(newProjectIndex([socials, header("work"), project("a"), project("b")])).toBe(2);
  });

  it("without projects, where the Add sheet puts new blocks (after the social icons)", () => {
    expect(newProjectIndex([socials, link("l")])).toBe(1);
    expect(newProjectIndex([link("l")])).toBe(0);
    expect(newProjectIndex([])).toBe(0);
  });
});
