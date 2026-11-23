import { coverImage, nextStep, pageSchema, slugFor, type Block, type BlockOf } from "@linkyo/blocks";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({ push: () => undefined }), usePathname: () => "/" }));

import { projectPictureLimit, workImageKind, type PreparedImage } from "./images";
import {
  addPictures,
  changeSlug,
  cutSentence,
  formerOwner,
  inlineAddress,
  projectFromLink,
  projectFromPictures,
  projectFromRepository,
  releasedAddresses,
  setConfidential,
  startedBlock,
  takenAddresses,
  waitingPictures,
  withFocal,
  withTitle,
} from "./project-form";

type Project = BlockOf<"project">;

const project = (patch: Partial<Project> = {}): Project => ({ id: "p1", type: "project", visible: true, highlight: false, slug: "", title: "", summary: "", ...patch });
const prepared = (n: number, width = 1080, height = 720): PreparedImage[] =>
  Array.from({ length: n }, (_, i) => ({ src: `data:image/jpeg;base64,${String(i)}`, tone: "dark", width, height }));
const profile = { username: "ronja", displayName: "Ronja", bio: "", locale: "de" as const, avatar: { src: "none:", alt: "" } };

describe("the address", () => {
  it("is made from the title until the first save, then never follows the title", () => {
    const draft = withTitle(project(), "Hafenlicht", [], "projekt");
    expect(draft.slug).toBe("hafenlicht");
    // Still unsaved: a corrected title corrects the address.
    const fixed = withTitle(draft, "Hafenlichter", [], "projekt");
    expect(fixed.slug).toBe("hafenlichter");
    // Saved: the page has it. Now the title changes alone.
    const page: Block[] = [fixed];
    const renamed = withTitle(fixed, "Licht am Hafen", page, "projekt");
    expect(renamed.title).toBe("Licht am Hafen");
    expect(renamed.slug).toBe("hafenlichter");
  });

  it("keeps an address the owner typed before the first save", () => {
    const typed = changeSlug(withTitle(project(), "Hafenlicht", [], "projekt"), "hafen", undefined);
    expect(typed.slug).toBe("hafen");
    expect(typed.was).toBeUndefined();
    expect(withTitle(typed, "Hafenlicht 2024", [], "projekt").slug).toBe("hafen");
  });

  it("skips every address another project uses, its earlier ones too", () => {
    const other = project({ id: "p2", slug: "hafenlicht", was: ["hafenlicht-2"], title: "Hafenlicht", summary: "x" });
    expect(takenAddresses([other], "p1")).toEqual(["hafenlicht", "hafenlicht-2"]);
    expect(withTitle(project(), "Hafenlicht", [other], "projekt").slug).toBe("hafenlicht-3");
  });

  it("pushes the old address into `was` on a manual change, and four changes keep three", () => {
    let saved = project({ slug: "a1", title: "A", summary: "x" });
    for (const next of ["b1", "c1", "d1", "e1"]) saved = changeSlug(saved, next, saved);
    expect(saved.slug).toBe("e1");
    expect(saved.was).toEqual(["d1", "c1", "b1"]);
  });

  it("counts only saved addresses: typing in between leaves no trace", () => {
    const saved = project({ slug: "hafen", title: "Hafen", summary: "x" });
    const once = changeSlug(saved, "hafenl", saved);
    const twice = changeSlug(once, "hafenlicht", saved);
    expect(twice.was).toEqual(["hafen"]);
  });

  it("takes back one of its own earlier addresses: the entry leaves the list", () => {
    const saved = project({ slug: "d1", was: ["c1", "b1", "a1"], title: "A", summary: "x" });
    const back = changeSlug(saved, "b1", saved);
    expect(back.slug).toBe("b1");
    expect(back.was).toEqual(["d1", "c1", "a1"]);
    // Back to where it was: nothing changes.
    expect(changeSlug(back, "d1", saved).was).toEqual(["c1", "b1", "a1"]);
  });

  it("takes over another project's earlier address after the confirmation line, and removes it there", () => {
    const old = project({ id: "p2", slug: "harbour", was: ["hafen"], title: "Harbour", summary: "x" });
    const mine = project({ slug: "lichter", title: "Lichter", summary: "y" });
    expect(formerOwner("hafen", mine.id, [old, mine])?.title).toBe("Harbour");
    const moved = changeSlug(mine, "hafen", mine);
    const page = [old, moved];
    expect(releasedAddresses(page)).toEqual([{ id: "p2", was: undefined }]);
    const repaired = page.map((block) => {
      const fix = releasedAddresses(page).find((candidate) => candidate.id === block.id);
      return fix ? { ...block, was: fix.was } : block;
    });
    expect(pageSchema.safeParse({ profile, blocks: JSON.parse(JSON.stringify(repaired)) as Block[] }).success).toBe(true);
    expect(releasedAddresses(repaired)).toEqual([]);
  });

  it("asks for an address right below the title when the title has no Latin letters (an Arabic title)", () => {
    const arabic = withTitle(project(), "مسار", [], "project");
    expect(arabic.slug).toBe("project-1");
    // The rule the quick form uses: a new project whose title gives no address.
    expect(inlineAddress(arabic, undefined, "project")).toBe(true);
    // It stays while the owner types one (the rule reads the title, not the address typed) …
    expect(inlineAddress(changeSlug(arabic, "masar", undefined), undefined, "project")).toBe(true);
    // … and is gone once the project is on the page (the Address row holds it then), or for a Latin title.
    expect(inlineAddress(arabic, arabic, "project")).toBe(false);
    expect(inlineAddress(withTitle(project(), "Masar", [], "project"), undefined, "project")).toBe(false);
    expect(inlineAddress(project(), undefined, "project")).toBe(false);
    expect(nextStep({ ...arabic, summary: "x" })).toBe("address");
  });
});

describe("the focal point", () => {
  const image = (n: number) => ({ src: `data:image/jpeg;base64,${String(n)}`, alt: `Bild ${String(n)}`, w: 1200, h: 800 });

  it("moves on the cover when the project has one", () => {
    const withCover = project({ cover: image(0), pictures: [{ image: image(1) }] });
    const moved = withFocal(withCover, [0.25, 0.75]);
    expect(moved.cover?.focal).toEqual([0.25, 0.75]);
    expect(moved.pictures?.[0]?.image.focal).toBeUndefined();
    expect("focal" in (withFocal(moved, undefined).cover ?? {})).toBe(false);
  });

  it("moves on the first picture, which cards show, when there is no cover", () => {
    const pictures = project({ pictures: [{ image: image(1) }, { image: { ...image(2), focal: [0.1, 0.1] } }] });
    const moved = withFocal(pictures, [0.3, 0.2]);
    expect(coverImage(moved)?.focal).toEqual([0.3, 0.2]);
    expect(moved.cover).toBeUndefined();
    // The others keep theirs.
    expect(moved.pictures?.[1]?.image.focal).toEqual([0.1, 0.1]);
    // Back to the centre drops the point.
    expect("focal" in (withFocal(moved, undefined).pictures?.[0]?.image ?? {})).toBe(false);
    expect(withFocal(project(), [0.3, 0.2])).toEqual(project());
  });
});

describe("a confidential client", () => {
  it("is cleared when the switch goes on and never stored", () => {
    const named = project({ client: "Bäckerei Sonnenschein", title: "Brot", slug: "brot", summary: "x" });
    const hidden = setConfidential(named, true);
    expect(hidden.confidential).toBe(true);
    expect("client" in hidden).toBe(false);
    expect(JSON.stringify(hidden)).not.toContain("Sonnenschein");
    const shown = setConfidential(hidden, false);
    expect("confidential" in shown).toBe(false);
  });
});

describe("pictures", () => {
  it("caps a project at six pictures in the demo, prepared at the demo's size", () => {
    expect(workImageKind(false)).toBe("photo");
    expect(projectPictureLimit(false)).toBe(6);
    const full = addPictures(project(), prepared(9), false);
    expect(full.pictures).toHaveLength(6);
    expect(addPictures(full, prepared(1), false)).toBe(full);
  });

  it("takes twenty with real accounts, prepared as work pictures", () => {
    expect(workImageKind(true)).toBe("work");
    expect(projectPictureLimit(true)).toBe(20);
    expect(addPictures(project(), prepared(25), true).pictures).toHaveLength(20);
  });

  it("stores every picture with its width and height", () => {
    const made = projectFromPictures("p9", prepared(3, 1600, 2000), false);
    expect(made.cover).toMatchObject({ w: 1600, h: 2000, alt: "" });
    for (const picture of made.pictures ?? []) expect(picture.image).toMatchObject({ w: 1600, h: 2000 });
  });

  it("counts the pictures that wait for a description; none hides the project", () => {
    const made = projectFromPictures("p9", prepared(3), false);
    expect(made.pictures).toHaveLength(2);
    expect(waitingPictures(made)).toBe(2);
    expect(made.visible).toBe(true);
    const described = { ...made, pictures: (made.pictures ?? []).map((picture, i) => (i === 0 ? { ...picture, image: { ...picture.image, alt: "Kran im Nebel" } } : { ...picture, decorative: true })) };
    expect(waitingPictures(described)).toBe(0);
  });
});

describe("projects from links", () => {
  it("makes a savable project from a repository's facts, without a typed character", () => {
    const made = projectFromRepository(
      "p5",
      { url: "https://github.com/tobin/tidewatch", owner: "tobin", repo: "tidewatch" },
      { title: "tidewatch", description: "Tide tables for small harbours, offline first.", language: "Swift", topics: ["ios", "tides", "offline-first", "maps", "weather", "extra"], homepage: "https://tidewatch.example.com", year: 2023, stars: 412, license: "MIT" },
      [],
      "project",
      "2026-11-23",
    );
    expect(made).toMatchObject({
      title: "tidewatch",
      slug: "tidewatch",
      summary: "Tide tables for small harbours, offline first.",
      tags: ["Swift", "ios", "tides", "offline-first", "maps"],
      year: { from: 2023 },
      source: { owner: "tobin", repo: "tidewatch", stars: 412, language: "Swift", license: "MIT", readAt: "2026-11-23" },
      links: [{ url: "https://github.com/tobin/tidewatch" }, { url: "https://tidewatch.example.com" }],
    });
    expect(pageSchema.safeParse({ profile, blocks: [made] }).success).toBe(true);
  });

  it("cuts a long description to one card sentence", () => {
    const long = "Word ".repeat(60);
    const sentence = cutSentence(long, 140);
    expect(sentence.length).toBeLessThanOrEqual(140);
    expect(sentence.endsWith("…")).toBe(true);
  });

  it("keeps any other link as the project's link and leaves the title to the owner", () => {
    const made = projectFromLink("p6", "https://studio-ronja.example.com/hafen", undefined, [], "projekt");
    expect(made.links).toEqual([{ url: "https://studio-ronja.example.com/hafen" }]);
    expect(made.title).toBe("");
    expect(made.slug).toBe("");
    // The title the owner then types makes the address.
    expect(withTitle(made, "Hafen bei Nacht", [], "projekt").slug).toBe(slugFor("Hafen bei Nacht", [], "projekt"));
  });
});

describe("new sections", () => {
  it("start with the kind's title, the closing line and one quote to confirm", () => {
    const text = (key: string) => key;
    const quotes = startedBlock({ id: "q", type: "quotes", visible: true, highlight: false, items: [] }, "developer", text);
    expect(quotes.type === "quotes" ? quotes.title : null).toBe("titles.quotes.developer");
    expect(quotes.type === "quotes" ? quotes.items : null).toHaveLength(1);
    const contact = startedBlock({ id: "c", type: "contact", visible: true, highlight: false, title: "", primary: { label: "", url: "" } }, "designer", text);
    expect(contact.type === "contact" ? contact.title : null).toBe("contact.closing");
  });
});
