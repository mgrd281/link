import { describe, expect, it } from "vitest";

import { LOOKS, PEOPLE_LOOKS } from "@/features/examples/looks";
import { isProxiedImage } from "@/features/directions/shared/remote-images";
import { PREVIEWS } from "@/features/previews/registry";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { buildPeople, type PeopleLabels } from "./people-index";
import { prepare, searchPeople } from "./search";

const labels: PeopleLabels = {
  category: (key) => [de, en].map((messages) => (messages.examples.categories as Record<string, string>)[key] ?? ""),
  kind: (key) => [de, en].map((messages) => (messages.app.welcome.kinds as Record<string, { label: string }>)[key]?.label ?? ""),
};

describe("people index", () => {
  const people = buildPeople("de", labels);

  it("lists exactly the pages the gallery lists, each once", () => {
    const listed = new Set([...Object.keys(LOOKS), ...Object.keys(PEOPLE_LOOKS)]);
    expect(new Set(people.map((person) => person.slug))).toEqual(listed);
    expect(people).toHaveLength(listed.size);
  });

  it("never lists a private preview that the gallery does not show", () => {
    const unlisted = Object.keys(PREVIEWS).filter((slug) => !(slug in LOOKS) && !(slug in PEOPLE_LOOKS));
    for (const slug of unlisted) expect(people.some((person) => person.slug === slug)).toBe(false);
  });

  it("opens each page in a language it exists in: the visitor's when it can", () => {
    for (const person of people) {
      expect(PREVIEWS[person.slug]?.pages[person.locale], person.slug).toBeDefined();
      expect(person.href).toBe(`/${person.locale}/p/${person.slug}`);
    }
    expect(people.find((person) => person.slug === "messi")?.locale).toBe("de");
    expect(buildPeople("ar", labels).find((person) => person.slug === "messi")?.name).toBe("ليونيل ميسي");
  });

  it("only ever shows pictures that Linkyo serves itself", () => {
    for (const person of people) {
      if (person.photo === null) continue;
      expect(person.photo.startsWith("/") || isProxiedImage(person.photo), `${person.slug}: ${person.photo}`).toBe(true);
    }
    // A prepared preview's picture lives on a platform we do not re-serve: initials instead.
    expect(people.find((person) => person.slug === "nizar")?.photo).toBeNull();
  });

  it("says what every result is, and leads with the people on the homepage", () => {
    expect(people.slice(0, 3).map((person) => person.slug)).toEqual(["taylor-swift", "cristiano", "nadine-njeim"]);
    expect(people.find((person) => person.slug === "taylor-swift")?.badge).toBe("concept");
    expect(people.find((person) => person.slug === "lou-ferreira")?.badge).toBe("example");
    expect(people.find((person) => person.slug === "nizar")?.badge).toBe("preview");
  });

  it("is found in German, English and Arabic", () => {
    const index = prepare(people);
    expect(searchPeople(index, "ميسي")[0]?.slug).toBe("messi");
    expect(searchPeople(index, "taylor")[0]?.slug).toBe("taylor-swift");
    expect(searchPeople(index, "musik").length).toBeGreaterThan(2);
    expect(searchPeople(index, "music").length).toBeGreaterThan(2);
    expect(searchPeople(index, "anwalt").length).toBeGreaterThan(0);
  });
});
