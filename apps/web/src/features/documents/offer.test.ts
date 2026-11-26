import { pageSchema, type Block, type Page } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { applicationSample } from "@/features/previews/application-sample";

import { documentEligibility, documentFilename, documentLinks, isPrintable, letterOf, letterSubject, printable, splitFigure, targetFacts } from "./offer";

const NOW = new Date("2026-11-26T10:00:00Z");
const words = { subjectFor: (value: string) => `Bewerbung als ${value}`, subjectBare: "Bewerbung" };
const on = { signposted: true, now: NOW };

/** Jonas with his blocks changed. */
const jonas = (change: (blocks: Block[]) => Block[] = (blocks) => blocks, locale: "de" | "en" = "de"): Page => {
  const page = applicationSample(locale);
  return { ...page, blocks: change(page.blocks) };
};
const withFacts = (facts: { label: string; value: string }[]): Page =>
  jonas((blocks) => blocks.map((block) => (block.type === "about" ? { ...block, facts } : block)));

describe("the application example", () => {
  it("is a valid page in every language", () => {
    for (const locale of ["de", "en", "ar"] as const) expect(pageSchema.safeParse(applicationSample(locale)).success, locale).toBe(true);
  });
});

describe("printable", () => {
  it("keeps every letter WinAnsi draws", () => {
    for (const text of ["Größe – „Ware“ 5 €", "(m/w/d)", "Jörg Weiß-Müller", "© 2026 ™"]) {
      expect(isPrintable(text), text).toBe(true);
      expect(printable(text)).toBe(text);
    }
  });

  it("refuses letters it cannot draw, never dropping them", () => {
    for (const text of ["Łukasz", "Kılıç", "Yılmaz", "كريم ناصر", "Иван"]) expect(isPrintable(text), text).toBe(false);
    expect(printable("Łukasz")).toBe("Łukasz");
  });

  it("drops emoji, joiners and soft hyphens and maps the narrow spaces", () => {
    expect(printable("Lager 🚜")).toBe("Lager");
    expect(printable("🚜 Lager und 👷🏽\u200D♂\uFE0F Team")).toBe("Lager und Team");
    expect(printable("Lager\u00ADlogistik")).toBe("Lagerlogistik");
    expect(printable("10\u202F%")).toBe("10\u00A0%");
    expect(printable("a\u2009b\u2011c")).toBe("a b-c");
    expect(isPrintable("Lager 🚜")).toBe(true);
  });
});

describe("splitFigure", () => {
  it.each([
    ["seit 2019", { kind: "number", qualifier: "seit", number: "2019", unit: "" }],
    ["99,6 %", { kind: "number", qualifier: "", number: "99,6", unit: "%" }],
    ["40+", { kind: "number", qualifier: "", number: "40", unit: "+" }],
    ["9", { kind: "number", qualifier: "", number: "9", unit: "" }],
    ["12 Jahre", { kind: "number", qualifier: "", number: "12", unit: "Jahre" }],
    ["2.3M", { kind: "number", qualifier: "", number: "2.3", unit: "M" }],
    ["منذ 2019", { kind: "number", qualifier: "منذ", number: "2019", unit: "" }],
  ] as const)("splits %s", (value, parts) => {
    expect(splitFigure(value)).toEqual(parts);
  });

  it.each(["SAP", "SAP EWM", "9 → 3"])("keeps %s as words", (value) => {
    expect(splitFigure(value)).toEqual({ kind: "word", text: value });
  });
});

describe("targetFacts and letterSubject", () => {
  it("find the position by its exact label, in any case and with a colon", () => {
    for (const label of ["Bewerbung als", "BEWERBUNG:", "Stelle", "Angestrebte Position", "Zielposition", "Applying for", "Role applied for", "التقديم على", "المنصب"]) {
      expect(targetFacts(withFacts([{ label, value: "Lagerist" }])).target?.value, label).toBe("Lagerist");
    }
  });

  it("never take a look-alike", () => {
    for (const label of ["Bewerbungsfrist", "Positionen", "Stellenwert", "Bewerbung bis", "Position im Team"]) {
      expect(targetFacts(withFacts([{ label, value: "x" }])).target, label).toBeNull();
    }
    expect(targetFacts(withFacts([{ label: "Für", value: "Nordhafen" }]))).toEqual({ target: null, employer: null });
  });

  it("read the employer only beside a target", () => {
    const page = withFacts([
      { label: "Bewerbung als", value: "Lagerist" },
      { label: "bei", value: "Nordhafen" },
    ]);
    expect(targetFacts(page).employer?.value).toBe("Nordhafen");
  });

  it("make the subject from the target, never from the tagline", () => {
    expect(letterSubject(jonas(), words)).toBe("Bewerbung als Fachkraft für Lagerlogistik (m/w/d)");
    expect(letterSubject(withFacts([{ label: "Sprachen", value: "Deutsch" }]), words)).toBe("Bewerbung");
    expect(letterSubject(applicationSample("ar"), words)).toBeNull();
  });
});

describe("documentEligibility and documentLinks", () => {
  it("offer Jonas's CV and letter in German and English, under the page's base", () => {
    expect(documentEligibility(jonas(), on)).toEqual({ cv: true, letter: true, ownCv: null });
    expect(documentLinks(jonas(undefined, "en"), "/en/p/jonas-brandt/", on)).toEqual({
      cv: "/en/p/jonas-brandt/cv",
      letter: "/en/p/jonas-brandt/letter",
      application: "/en/p/jonas-brandt/application",
      ownCv: null,
    });
  });

  it("offer nothing in Arabic, on other templates or for a name WinAnsi cannot draw", () => {
    expect(documentLinks(applicationSample("ar"), "/ar/p/karim-nasser", on)).toBeNull();
    expect(documentLinks(jonas(), "/de/p/jonas-brandt", { ...on, signposted: false })).toBeNull();
    const lukasz = { ...jonas(), profile: { ...jonas().profile, displayName: "Łukasz Kowalski" } };
    expect(documentLinks(lukasz, "/lukasz", on)).toBeNull();
  });

  it("offer the CV alone without a letter, and the letter alone without a career", () => {
    expect(documentEligibility(jonas((blocks) => blocks.filter((block) => block.id !== "letter")), on)).toEqual({ cv: true, letter: false, ownCv: null });
    const letterOnly = jonas((blocks) => blocks.filter((block) => !["about", "skills", "career"].includes(block.id)));
    expect(documentEligibility(letterOnly, on)).toEqual({ cv: false, letter: true, ownCv: null });
    expect(documentLinks(letterOnly, "/x", on)?.application).toBeNull();
  });

  it("let the owner's own CV replace the generated one", () => {
    const own = jonas((blocks) =>
      blocks.map((block) => (block.type === "contact" ? { ...block, links: [...(block.links ?? []), { kind: "cv" as const, url: "https://example.com/cv.pdf" }] } : block)),
    );
    expect(documentEligibility(own, on)).toEqual({ cv: false, letter: true, ownCv: { href: "https://example.com/cv.pdf", label: null } });
    expect(documentLinks(own, "/x", on)).toEqual({ cv: null, letter: "/x/letter", application: null, ownCv: "https://example.com/cv.pdf" });
  });

  it("follow the letter's visibility and schedule", () => {
    const hidden = jonas((blocks) => blocks.map((block) => (block.id === "letter" ? { ...block, visible: false } : block)));
    expect(letterOf(hidden, NOW)).toBeNull();
    expect(documentEligibility(hidden, on).letter).toBe(false);
    const later = jonas((blocks) => blocks.map((block) => (block.id === "letter" ? { ...block, schedule: { from: "2027-01-01T00:00:00Z" } } : block)));
    expect(documentEligibility(later, on).letter).toBe(false);
  });
});

describe("documentFilename", () => {
  it("names each document in the page's language", () => {
    expect(documentFilename("cv", "Jonas Brandt", "de").ascii).toBe("Lebenslauf_Jonas_Brandt.pdf");
    expect(documentFilename("letter", "Jonas Brandt", "de").ascii).toBe("Anschreiben_Jonas_Brandt.pdf");
    expect(documentFilename("application", "Jonas Brandt", "de").ascii).toBe("Bewerbung_Jonas_Brandt.pdf");
    expect(documentFilename("cv", "Jonas Brandt", "en").ascii).toBe("CV_Jonas_Brandt.pdf");
    expect(documentFilename("letter", "Jonas Brandt", "en").ascii).toBe("Cover_letter_Jonas_Brandt.pdf");
    expect(documentFilename("application", "Jonas Brandt", "en").ascii).toBe("Application_Jonas_Brandt.pdf");
  });

  it("spells umlauts out for ASCII and keeps them for UTF-8", () => {
    expect(documentFilename("cv", "Jörg Weiß-Müller", "de")).toEqual({ ascii: "Lebenslauf_Joerg_Weiss-Mueller.pdf", utf8: "Lebenslauf_Jörg_Weiß-Müller.pdf" });
  });
});
