import { describe, expect, it } from "vitest";

import { distance, fold, highlights, prepare, searchPeople, termsOf, type Person } from "./search";

const person = (slug: string, name: string, role: string, extra: Partial<Person> = {}): Person => ({
  slug,
  name,
  aliases: [],
  role,
  category: "creators",
  keywords: [],
  locale: "en",
  href: `/en/p/${slug}`,
  photo: null,
  badge: "example",
  ...extra,
});

const PEOPLE = prepare([
  person("taylor-swift", "Taylor Swift", "American singer-songwriter", { aliases: ["تايلور سويفت"], category: "people", badge: "concept", keywords: ["Music"] }),
  person("messi", "Lionel Messi", "Footballer · Captain of Inter Miami CF", { aliases: ["ليونيل ميسي"], category: "people", badge: "concept", keywords: ["Sport"] }),
  person("cristiano", "Cristiano Ronaldo", "Footballer · Al-Nassr", { aliases: ["كريستيانو رونالدو"], category: "people", badge: "concept" }),
  person("juno-kade", "Juno Kade", "DJ · Producer · House & Disco", { category: "music", keywords: ["Music", "Music & podcasts", "London"] }),
  person("baeckerei-kruste", "Bäckerei Kruste", "Handwerksbäckerei seit 1987", { category: "local", locale: "de", keywords: ["Unternehmen", "Lokale Geschäfte"] }),
  person("salma-rahhal", "سلمى رحّال", "خبيرة مكياج · دبي", { category: "creators", locale: "ar" }),
  person("elias-navarro", "Elias Navarro", "Strength coach · Mobility · Online", { category: "sport", keywords: ["Coach", "Sport"] }),
]);
const slugs = (query: string, category: string | null = null) => searchPeople(PEOPLE, query, category).map((hit) => hit.slug);

describe("fold", () => {
  it("drops accents, case and Arabic vowel marks, and reads each Arabic letter one way", () => {
    expect(fold("Bäckerei")).toBe("backerei");
    expect(fold("Straße")).toBe("strasse");
    expect(fold("رحّال")).toBe("رحال");
    expect(fold("أحمد")).toBe(fold("احمد"));
    expect(fold("نادية")).toBe(fold("ناديه"));
  });

  it("reads typed words, and an address written with @", () => {
    expect(termsOf("  Taylor   SWIFT ")).toEqual(["taylor", "swift"]);
    expect(termsOf("@messi")).toEqual(["messi"]);
    expect(termsOf("")).toEqual([]);
  });
});

describe("distance", () => {
  it("counts typing mistakes, a swap of neighbours as one", () => {
    expect(distance("ronaldo", "ronaldo", 2)).toBe(0);
    expect(distance("ronldo", "ronaldo", 2)).toBe(1);
    expect(distance("ronlado", "ronaldo", 2)).toBe(1);
    expect(distance("messi", "taylor", 1)).toBeGreaterThan(1);
  });
});

describe("searchPeople", () => {
  it("returns everyone in the given order when nothing is typed", () => {
    expect(slugs("")).toHaveLength(7);
    expect(slugs("")[0]).toBe("taylor-swift");
    expect(slugs("", "music")).toEqual(["juno-kade"]);
  });

  it("finds by the start of a name, of any word in it, and by the address", () => {
    expect(slugs("tay")[0]).toBe("taylor-swift");
    expect(slugs("swift")).toEqual(["taylor-swift"]);
    expect(slugs("ronaldo")).toEqual(["cristiano"]);
    expect(slugs("@juno-k")).toEqual(["juno-kade"]);
  });

  it("puts the better fit first: a name beats a line about the page", () => {
    // "coach" is in one name's line only; "mess" starts a name.
    expect(slugs("mess")[0]).toBe("messi");
    expect(slugs("footballer")).toEqual(["messi", "cristiano"]);
  });

  it("finds across languages and spellings", () => {
    expect(slugs("ميسي")).toEqual(["messi"]);
    expect(slugs("backerei")).toEqual(["baeckerei-kruste"]);
    expect(slugs("سلمي")).toEqual(["salma-rahhal"]);
    expect(slugs("رحال")).toEqual(["salma-rahhal"]);
  });

  it("finds by what the page is about: kind, category, place", () => {
    expect(slugs("music")).toEqual(expect.arrayContaining(["taylor-swift", "juno-kade"]));
    expect(slugs("london")).toEqual(["juno-kade"]);
    expect(slugs("dj house")).toEqual(["juno-kade"]);
    // Inside a word only from four letters on: "song" in "songwriter", not "ach" in "coach".
    expect(slugs("writer")).toEqual(["taylor-swift"]);
    expect(slugs("ach")).toEqual([]);
  });

  it("forgives a typing mistake in longer words, never in short ones", () => {
    expect(slugs("ronldo")).toEqual(["cristiano"]);
    expect(slugs("tailor")).toEqual(["taylor-swift"]);
    expect(slugs("mesi")).toEqual(["messi"]);
    // Still typing, already one letter off.
    expect(slugs("tailo")).toEqual(["taylor-swift"]);
    expect(slugs("xyz")).toEqual([]);
  });

  it("needs every typed word to fit, and respects the chosen category", () => {
    expect(slugs("taylor messi")).toEqual([]);
    expect(slugs("footballer", "music")).toEqual([]);
    expect(slugs("coach", "sport")).toEqual(["elias-navarro"]);
  });
});

describe("highlights", () => {
  it("marks what was typed inside the name as written", () => {
    expect(highlights("Taylor Swift", "tay")).toEqual([[0, 3]]);
    expect(highlights("Taylor Swift", "swift tay")).toEqual([[0, 3], [7, 12]]);
    expect(highlights("Bäckerei Kruste", "backer")).toEqual([[0, 6]]);
    expect(highlights("Lionel Messi", "ميسي")).toEqual([]);
  });

  it("prefers the start of a word and merges what overlaps", () => {
    expect(highlights("Anna Hannah", "han")).toEqual([[5, 8]]);
    expect(highlights("Taylor", "tay ayl")).toEqual([[0, 4]]);
  });
});
