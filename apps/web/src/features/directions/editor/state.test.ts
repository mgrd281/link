import { describe, expect, it } from "vitest";

import { blockSchema, detectLink, MAX_PROJECTS, pageSchema, type Block } from "@linkyo/blocks";

import { blockFromDetection, editorReducer, initialEditorState, isShowDate, showsFromTickets, withDatedShows } from "./state";

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

  describe("portfolio blocks", () => {
    const project = { id: "p", type: "project", visible: true, highlight: false, slug: "harbour-light", was: ["harbour", "light"], title: "Harbour Light", summary: "A series about the harbour at night." } as const;
    const contact = { id: "c", type: "contact", visible: true, highlight: false, title: "A project in mind?", primary: { label: "Send a message", url: "mailto:a@example.com" } } as const;
    const page = initialEditorState({ blocks: [project, contact] as Block[], sizes: {}, theme: { template: "werkbogen" } });
    const profile = { username: "ronja", displayName: "Ronja", bio: "", locale: "de" as const, avatar: { src: "none:", alt: "" } };

    it("gives a duplicated project a fresh address and no earlier ones; the page stays valid", () => {
      const next = editorReducer(page, { type: "duplicate", id: "p", word: "projekt" });
      const copy = next.present.blocks[1];
      expect(copy?.type).toBe("project");
      if (copy?.type !== "project") return;
      expect(copy.id).not.toBe("p");
      expect(copy.slug).toBe("harbour-light-2");
      expect(copy.was).toBeUndefined();
      expect(copy.title).toBe("Harbour Light");
      expect(pageSchema.safeParse({ profile, blocks: next.present.blocks }).success).toBe(true);
      // Twice: the third copy takes the next free address.
      const again = editorReducer(next, { type: "duplicate", id: "p", word: "projekt" });
      const third = again.present.blocks[1];
      expect(third?.type === "project" ? third.slug : null).toBe("harbour-light-3");
      expect(pageSchema.safeParse({ profile, blocks: again.present.blocks }).success).toBe(true);
    });

    it("does not copy a project on a page that holds MAX_PROJECTS already: the page stays valid", () => {
      const projects = Array.from({ length: MAX_PROJECTS }, (_, i) => ({ ...project, id: `p${String(i)}`, slug: `projekt-${String(i + 1)}`, was: undefined }));
      const full = initialEditorState({ blocks: [...projects, contact] as Block[], sizes: {}, theme: { template: "werkbogen" } });
      expect(pageSchema.safeParse({ profile, blocks: full.present.blocks }).success).toBe(true);
      const next = editorReducer(full, { type: "duplicate", id: "p3", word: "projekt" });
      expect(next).toBe(full);
      expect(pageSchema.safeParse({ profile, blocks: next.present.blocks }).success).toBe(true);
      // One fewer, and a copy is made.
      const room = initialEditorState({ blocks: projects.slice(1), sizes: {}, theme: { template: "werkbogen" } });
      expect(editorReducer(room, { type: "duplicate", id: "p3", word: "projekt" }).present.blocks).toHaveLength(MAX_PROJECTS);
    });

    it("never copies the contact block (a page has one)", () => {
      const next = editorReducer(page, { type: "duplicate", id: "c" });
      expect(next).toBe(page);
      expect(next.present.blocks.filter((block) => block.type === "contact")).toHaveLength(1);
    });
  });

  it("creates valid optimistic blocks from smart detect", () => {
    for (const url of ["https://youtu.be/abc", "https://open.spotify.com/track/x", "https://example.com"]) {
      const detection = detectLink(url);
      expect(detection).not.toBeNull();
      if (detection) expect(blockFromDetection(detection, labels).type).toBe(detection.type === "shorts" ? "link" : detection.type);
    }
  });
});

describe("ticket links", () => {
  const TICKETS = [
    "https://www.eventbrite.de/e/release-night-tickets-123456789",
    "https://www.eventbrite.com/e/open-mic-tickets-987654321",
    "https://www.eventim.de/event/mila-aurel-123",
    "https://www.eventim.com/event/x-1",
    "https://www.ticketmaster.de/event/mila-aurel-tickets/555",
    "https://www.ticketmaster.com/event/0A00",
  ];

  it.each(TICKETS)("%s never yields a date or a city", (url) => {
    const detection = detectLink(url);
    expect(detection?.type).toBe("events");
    if (!detection) return;
    const block = blockFromDetection(detection, labels);
    // A button to the ticket shop: valid as it is, and no show with an invented date or city.
    expect(block).toMatchObject({ type: "link", url: detection.url });
    expect(JSON.stringify(block)).not.toMatch(/"(date|city|venue)"/);
    expect(blockSchema.safeParse(block).success).toBe(true);
  });

  it("opens the Events form with the ticket addresses and nothing else filled in", () => {
    const detections = TICKETS.flatMap((url) => detectLink(url) ?? []);
    const shows = showsFromTickets(detections);
    expect(shows.items).toHaveLength(TICKETS.length);
    for (const [index, item] of shows.items.entries()) {
      expect(item).toEqual({ date: "", city: "", venue: "", url: detections[index]?.url, status: "onsale" });
    }
    // Not a block the page can take until each show has a date.
    expect(blockSchema.safeParse(shows).success).toBe(false);
    const dated = { ...shows, items: shows.items.map((item) => ({ ...item, date: "2027-05-01", city: "Leipzig" })) };
    expect(blockSchema.safeParse(dated).success).toBe(true);
  });

  it("keeps shows without a date off the page", () => {
    const shows = showsFromTickets([detectLink(TICKETS[0] ?? "")].flatMap((d) => d ?? []));
    expect(withDatedShows(shows)).toBeNull();
    const one = { ...shows, items: [{ ...shows.items[0], date: "2027-05-01" }, { ...shows.items[0], date: "" }] } as Block;
    expect(withDatedShows(one)).toMatchObject({ items: [{ date: "2027-05-01" }] });
    const link = { id: "l", type: "link", title: "A", url: "https://example.com", visible: true, highlight: false } as Block;
    expect(withDatedShows(link)).toBe(link);
    expect([isShowDate("2027-05-01"), isShowDate(""), isShowDate("2027-02-30"), isShowDate("2027-5-1")]).toEqual([true, false, false, false]);
  });
});
