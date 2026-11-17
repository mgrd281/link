import type { Block } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { groupSections, linkDestination } from "./sections";

const base = { visible: true, highlight: false } as const;
const header = (id: string, title: string): Block => ({ ...base, id, type: "header", title });
const link = (id: string): Block => ({ ...base, id, type: "link", title: id, url: `https://example.com/${id}` });
const video = (id: string): Block => ({
  ...base,
  id,
  type: "video",
  title: id,
  provider: "youtube",
  url: `https://youtube.com/watch?v=${id}`,
  poster: { src: "sample:video-live", alt: "" },
});
const product = (id: string): Block => ({
  ...base,
  id,
  type: "product",
  title: id,
  price: 10,
  currency: "EUR",
  url: `https://shop.example.com/${id}`,
  image: { src: "sample:merch-vinyl", alt: "" },
});

describe("groupSections", () => {
  it("puts blocks before the first header in an untitled top section and skips socials", () => {
    const sections = groupSections([{ ...base, id: "s", type: "socials", items: [] }, link("a"), header("h", "Music"), link("b")]);
    expect(sections.map((s) => [s.id, s.title, s.items.length])).toEqual([
      ["top", null, 1],
      ["h", "Music", 1],
    ]);
  });

  it("groups consecutive videos into one row and consecutive products into one grid", () => {
    const [top] = groupSections([video("v1"), video("v2"), link("x"), product("p1"), product("p2"), product("p3"), video("v3")]);
    expect(top?.items.map((item) => (item.kind === "block" ? item.block.id : `${item.kind}:${item.blocks.map((b) => b.id).join(",")}`))).toEqual([
      "videos:v1,v2",
      "x",
      "products:p1,p2,p3",
      "videos:v3",
    ]);
  });

  it("lets titled list blocks open their own section", () => {
    const events: Block = {
      ...base,
      id: "tour",
      type: "events",
      title: "Tour",
      items: [{ date: "2027-01-01", city: "Berlin", venue: "Club", url: "https://tickets.example.com", status: "onsale" }],
    };
    const sections = groupSections([header("h", "Videos"), video("v1"), events, link("after")]);
    expect(sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Videos", 1],
      ["Tour", 2],
    ]);
  });

  it("keeps an empty titled section (a freshly added header) but drops an empty top", () => {
    expect(groupSections([header("h", "New section")])).toEqual([{ id: "h", title: "New section", items: [] }]);
    expect(groupSections([])).toEqual([]);
  });
});

describe("linkDestination", () => {
  it("shows host, email or phone", () => {
    expect(linkDestination("https://www.milaaurel.com/samples")).toBe("milaaurel.com");
    expect(linkDestination("mailto:booking@milaaurel.com")).toBe("booking@milaaurel.com");
    expect(linkDestination("tel:+4930123")).toBe("+4930123");
  });
});
