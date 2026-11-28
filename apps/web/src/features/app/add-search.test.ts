import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { addMenu, ALL_ENTRY_KEYS, entryKey, filterMenu, matchesQuery, searchText, type AddEntry } from "./add-search";

/** D-15: the Add sheet's search, as the sheet runs it (name, card line, search words), in each language. */
const LOCALES = { de, en, ar } as const;
type Locale = keyof typeof LOCALES;

const words = (locale: Locale) => (entry: AddEntry): string[] => {
  const messages = LOCALES[locale];
  const key = entryKey(entry);
  const name = entry.type ? messages.dashboard.types[entry.type] : messages.app.add.presets[entry.preset];
  return [name, messages.app.add.desc[key], messages.app.add.keywords[key]];
};

const found = (locale: Locale, query: string, kind?: string, demo = true) =>
  filterMenu(addMenu(kind, demo), query, words(locale)).flatMap((group) => group.entries.map(entryKey));

describe("the Add sheet's entries", () => {
  it("are every type once, plus the presets, in the sheet's groups (25 in the demo)", () => {
    const all = addMenu(undefined, true).flatMap((group) => group.entries.map(entryKey));
    expect(all).toHaveLength(25);
    expect(new Set(all).size).toBe(25);
    expect(new Set(all)).toEqual(new Set(ALL_ENTRY_KEYS));
  });

  it("leave out the newsletter for real accounts (no backend for it yet)", () => {
    const real = addMenu(undefined, false).flatMap((group) => group.entries.map(entryKey));
    expect(real).toHaveLength(24);
    expect(real).not.toContain("newsletter");
  });

  it("each have search words in German, English and Arabic", () => {
    for (const locale of ["de", "en", "ar"] as const)
      for (const key of ALL_ENTRY_KEYS) expect(LOCALES[locale].app.add.keywords[key].trim().length, `${locale} ${key}`).toBeGreaterThan(2);
  });
});

describe("searching the Add sheet", () => {
  it("lists everything while nothing is typed", () => {
    expect(found("de", "")).toHaveLength(25);
    expect(found("de", "   ")).toHaveLength(25);
  });

  it("finds by name and by search words in German", () => {
    expect(found("de", "video")).toEqual(expect.arrayContaining(["video"]));
    expect(found("de", "Termine")).toContain("events");
    expect(found("de", "tickets")).toContain("events");
    expect(found("de", "kundenstimmen")).toEqual(["quotes"]);
    expect(found("de", "uber mich")).toContain("about");
    expect(found("de", "shop")).toContain("product");
  });

  it("finds in English", () => {
    expect(found("en", "testimonials")).toEqual(["quotes"]);
    expect(found("en", "spotify")).toContain("music");
    expect(found("en", "clients")).toContain("clients");
  });

  it("finds in Arabic, also as people type the letters (ة or ه, with or without hamza)", () => {
    expect(found("ar", "فيديو")).toContain("video");
    expect(found("ar", "تذاكر")).toContain("events");
    expect(found("ar", "صوره")).toContain("image");
    expect(found("ar", "اراء")).toContain("quotes");
    expect(found("ar", "نشره بريديه")).toEqual(["newsletter"]);
  });

  it("needs every word of the query, and finds nothing for nonsense (the empty state)", () => {
    expect(found("de", "video tickets")).toEqual([]);
    expect(found("de", "xylophonbaustelle")).toEqual([]);
    expect(filterMenu(addMenu(undefined, true), "xylophonbaustelle", words("de"))).toEqual([]);
  });

  it("keeps the sheet's order and its groups", () => {
    const groups = filterMenu(addMenu("music", true), "a", words("de"));
    expect(groups[0]?.key).toBe("suggested");
    for (const group of groups) expect(group.entries.length).toBeGreaterThan(0);
  });
});

describe("search text", () => {
  it("folds case, accents, Arabic marks and the letters written either way", () => {
    expect(searchText("  Über  Mich ")).toBe("uber mich");
    expect(searchText("صورةٌ")).toBe("صوره");
    expect(searchText("أإآ")).toBe("ااا");
    expect(searchText("مستشفى")).toBe("مستشفي");
    expect(searchText("ســـلام")).toBe("سلام");
    expect(matchesQuery("Uber", ["Über mich"])).toBe(true);
    expect(matchesQuery("", ["anything"])).toBe(true);
  });
});
