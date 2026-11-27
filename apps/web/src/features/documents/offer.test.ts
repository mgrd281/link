import type { Page } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { endedLetter, hiddenLetter, jonasDe, jonasEn, karimAr, lukasz, noLetter, ownCv, sparse, statsAndBio, toolsOnly, withContact } from "./fixtures";
import { documentInput } from "./input";
import { paperLabels } from "./labels";
import { documentEligibility, documentFilename, documentLinks, isPrintable, letterOf, letterSubject, printable, splitFigure, targetFacts } from "./offer";

const NOW = new Date("2026-11-26T10:00:00Z");
const at = { signposted: true, now: NOW };

describe("printable", () => {
  it("prints German, English and the typographer's characters", () => {
    for (const text of ["Größe – „Ware“ 5 €", "(m/w/d)", "Weiß-Müller", "Œuvre ‰ ™ © ®", "‘single’ … • —"]) expect(isPrintable(text), text).toBe(true);
  });

  it("refuses letters WinAnsi has not: never a dropped or replaced letter", () => {
    for (const text of ["Łukasz", "Kılıç", "Yılmaz", "كريم ناصر", "Иван", "日本"]) expect(isPrintable(text), text).toBe(false);
  });

  it("removes pictographs, soft hyphens and joiners; maps the narrow spaces and hyphens", () => {
    expect(printable("Lager 🚜")).toBe("Lager");
    expect(printable("Kommissio\u00ADnierung")).toBe("Kommissionierung");
    expect(printable("Team 👩🏽\u200D💻 und mehr")).toBe("Team und mehr");
    expect(printable("Flagge 🇩🇪 hier")).toBe("Flagge hier");
    expect(printable("99,6\u202F%")).toBe("99,6\u00A0%");
    expect(printable("10\u2009000")).toBe("10 000");
    expect(printable("E‑Mail")).toBe("E-Mail");
    expect(printable("© Jonas ™")).toBe("© Jonas ™");
    expect(printable("Zeile 1\r\nZeile 2")).toBe("Zeile 1\nZeile 2");
    expect(isPrintable("Lager 🚜")).toBe(true);
  });

  it("removes the bidirectional marks, embeddings and isolates an Arabic keyboard leaves in Latin text", () => {
    const marks = ["\u200E", "\u200F", "\u061C", "\u202A", "\u202B", "\u202C", "\u202D", "\u202E", "\u2066", "\u2067", "\u2068", "\u2069", "\uFEFF"];
    for (const mark of marks) {
      const code = `U+${(mark.codePointAt(0) ?? 0).toString(16).toUpperCase()}`;
      expect(printable(`Bremen${mark}`), code).toBe("Bremen");
      expect(printable(`Bremen${mark} Nord`), code).toBe("Bremen Nord");
      expect(printable(`${mark}Fachkraft${mark} für Lagerlogistik`), code).toBe("Fachkraft für Lagerlogistik");
      expect(isPrintable(`Bremen${mark}`), code).toBe(true);
    }
    expect(printable("\u2066jonas.brandt@example.com\u2069")).toBe("jonas.brandt@example.com");
  });

  it("prints the minus as a hyphen-minus and the line and paragraph separators as line breaks", () => {
    expect(printable("\u221220 °C Tiefkühllager")).toBe("-20 °C Tiefkühllager");
    expect(isPrintable("\u221220 °C Tiefkühllager")).toBe(true);
    expect(printable("Zeile 1\u2028Zeile 2")).toBe("Zeile 1\nZeile 2");
    expect(printable("Absatz 1\u2029Absatz 2")).toBe("Absatz 1\nAbsatz 2");
    expect(printable("Zeile 1 \u2028 Zeile 2")).toBe("Zeile 1\nZeile 2");
  });

  it("never drops or replaces a letter or a symbol: what WinAnsi has not stays, and the text is refused", () => {
    for (const text of ["Łukasz", "9 → 3", "✓ Gabelstapler", "≥ 3 Jahre", "★"]) {
      expect(printable(text), text).toBe(text);
      expect(isPrintable(text), text).toBe(false);
    }
    // Removing a mark leaves the letters as they are.
    expect(printable("Kılıç\u200E")).toBe("Kılıç");
    expect(isPrintable("Kılıç\u200E")).toBe(false);
  });
});

describe("splitFigure", () => {
  it.each([
    ["seit 2019", { kind: "number", qualifier: "seit", number: "2019", unit: "", spaced: false }],
    ["99,6 %", { kind: "number", qualifier: "", number: "99,6", unit: "%", spaced: true }],
    // DIN 5008: "%" after a space, also when typed onto the number; the page and the paper agree.
    ["99,6%", { kind: "number", qualifier: "", number: "99,6", unit: "%", spaced: true }],
    ["40+", { kind: "number", qualifier: "", number: "40", unit: "+", spaced: false }],
    ["3 ×", { kind: "number", qualifier: "", number: "3", unit: "×", spaced: false }],
    ["9", { kind: "number", qualifier: "", number: "9", unit: "", spaced: false }],
    ["12 Jahre", { kind: "number", qualifier: "", number: "12", unit: "Jahre", spaced: true }],
    ["2.3M", { kind: "number", qualifier: "", number: "2.3", unit: "M", spaced: false }],
    ["منذ 2019", { kind: "number", qualifier: "منذ", number: "2019", unit: "", spaced: false }],
    ["SAP", { kind: "word", text: "SAP" }],
    ["SAP EWM", { kind: "word", text: "SAP EWM" }],
    ["9 → 3", { kind: "word", text: "9 → 3" }],
    // A digit inside a word is no number.
    ["SAP S/4HANA", { kind: "word", text: "SAP S/4HANA" }],
    ["C1", { kind: "word", text: "C1" }],
    ["B2B", { kind: "word", text: "B2B" }],
    ["Win11", { kind: "word", text: "Win11" }],
    ["Top 3", { kind: "number", qualifier: "Top", number: "3", unit: "", spaced: false }],
  ] as const)("%s", (value, parts) => {
    expect(splitFigure(value)).toEqual(parts);
  });
});

const withFacts = (facts: { label: string; value: string }[], locale: Page["profile"]["locale"] = "de"): Page => {
  const page = locale === "ar" ? karimAr() : locale === "en" ? jonasEn() : jonasDe();
  return { ...page, blocks: page.blocks.map((block) => (block.type === "about" ? { ...block, facts } : block)) };
};

describe("targetFacts", () => {
  it("finds the position by its label in each language, in any case and with a colon", () => {
    const cases: [Page["profile"]["locale"], string][] = [
      ["de", "Bewerbung als"],
      ["de", "BEWERBUNG"],
      ["de", "Stelle:"],
      ["de", "Position"],
      ["de", "angestrebte Stelle"],
      ["de", "Angestrebte Position"],
      ["de", "Zielposition"],
      ["en", "Applying for"],
      ["en", "Application for:"],
      ["en", "position"],
      ["en", "Role applied for"],
      ["en", "Target role"],
      ["ar", "التقديم على"],
      ["ar", "الوظيفة المطلوبة"],
      ["ar", "المنصب:"],
    ];
    for (const [locale, label] of cases) {
      const { target } = targetFacts(withFacts([{ label: "Sprachen", value: "Deutsch" }, { label, value: "Lager" }], locale));
      expect(target, `${locale}: ${label}`).toEqual({ label, value: "Lager" });
    }
  });

  it("matches exactly: no prefix, no look-alike", () => {
    for (const label of ["Bewerbungsfrist", "Positionen", "Stellenwert", "Bewerbung bis", "Position im Team"]) {
      expect(targetFacts(withFacts([{ label, value: "x" }])).target, label).toBeNull();
    }
  });

  it("reads the employer only beside a position", () => {
    expect(targetFacts(withFacts([{ label: "Für", value: "Sales Center" }]))).toEqual({ target: null, employer: null });
    expect(targetFacts(withFacts([{ label: "Bewerbung als", value: "Lagerist" }, { label: "Für", value: "Sales Center" }]))).toEqual({
      target: { label: "Bewerbung als", value: "Lagerist" },
      employer: { label: "Für", value: "Sales Center" },
    });
    expect(targetFacts(withFacts([{ label: "Applying for", value: "Picker" }, { label: "Employer", value: "Depot" }], "en")).employer).toEqual({ label: "Employer", value: "Depot" });
  });
});

describe("letterSubject", () => {
  const de = paperLabels("de");
  const en = paperLabels("en");

  it("is the template's words with the position, else the bare word; never the tagline", () => {
    expect(letterSubject(jonasDe(), de)).toBe("Bewerbung als Fachkraft für Lagerlogistik (m/w/d)");
    expect(letterSubject(jonasEn(), en)).toBe("Application for Warehouse logistics specialist");
    expect(letterSubject(withFacts([{ label: "Sprachen", value: "Deutsch" }]), de)).toBe("Bewerbung");
    expect(letterSubject(withFacts([]), de)).not.toContain("Staplerfahrer");
  });

  it("is null on Arabic pages", () => {
    expect(letterSubject(karimAr(), de)).toBeNull();
  });
});

describe("letterOf", () => {
  it("finds the letter as the renderer does, and not when it is off or out of schedule", () => {
    expect(letterOf(jonasDe(), NOW)?.id).toBe("letter");
    expect(letterOf(noLetter(), NOW)).toBeNull();
    expect(letterOf(hiddenLetter(), NOW)).toBeNull();
    expect(letterOf(endedLetter(), NOW)).toBeNull();
  });
});

describe("documentEligibility and documentLinks", () => {
  it("offers the CV and the letter of the fictional applicant, in German and English", () => {
    expect(documentEligibility(jonasDe(), at)).toEqual({ cv: true, letter: true, ownCv: null });
    expect(documentEligibility(jonasEn(), at)).toEqual({ cv: true, letter: true, ownCv: null });
    expect(documentLinks(jonasDe(), "/de/p/jonas-brandt", at)).toEqual({
      cv: "/de/p/jonas-brandt/cv",
      letter: "/de/p/jonas-brandt/letter",
      application: "/de/p/jonas-brandt/application",
      ownCv: null,
    });
    expect(documentLinks(jonasDe(), "/jonasbrandt/", at)?.cv).toBe("/jonasbrandt/cv");
  });

  it("offers nothing on Arabic pages, other templates, or with an unprintable name", () => {
    expect(documentEligibility(karimAr(), at)).toEqual({ cv: false, letter: false, ownCv: null });
    expect(documentLinks(karimAr(), "/ar/p/karim-nasser", at)).toBeNull();
    expect(documentEligibility(jonasDe(), { ...at, signposted: false })).toEqual({ cv: false, letter: false, ownCv: null });
    expect(documentLinks(lukasz(), "/x", at)).toBeNull();
  });

  it("offers what the page holds", () => {
    expect(documentEligibility(noLetter(), at)).toEqual({ cv: true, letter: false, ownCv: null });
    expect(documentLinks(noLetter(), "/x", at)).toEqual({ cv: "/x/cv", letter: null, application: null, ownCv: null });
    expect(documentEligibility(hiddenLetter(), at).letter).toBe(false);
    expect(documentEligibility(endedLetter(), at).letter).toBe(false);
    expect(documentEligibility(sparse(), at)).toEqual({ cv: true, letter: false, ownCv: null });
    expect(documentEligibility(toolsOnly(), at).cv).toBe(true);
    expect(documentEligibility(statsAndBio(), at)).toEqual({ cv: false, letter: false, ownCv: null });
    expect(documentLinks(statsAndBio(), "/x", at)).toBeNull();
  });

  it("lets the owner's own CV replace the generated one", () => {
    expect(documentEligibility(ownCv(), at)).toEqual({ cv: false, letter: true, ownCv: { href: "https://example.com/jonas-brandt-lebenslauf.pdf", label: "Mein Lebenslauf" } });
    expect(documentLinks(ownCv(), "/x", at)).toEqual({ cv: null, letter: "/x/letter", application: null, ownCv: "https://example.com/jonas-brandt-lebenslauf.pdf" });
  });

  it("checks only the texts a document prints", () => {
    // An unprintable letter costs the letter, not the CV.
    const page = jonasDe();
    const odd = { ...page, blocks: page.blocks.map((block) => (block.id === "letter" && block.type === "text" ? { ...block, text: `${block.text}\n\nKılıç` } : block)) };
    expect(documentEligibility(odd, at)).toEqual({ cv: true, letter: false, ownCv: null });
    // An unprintable skill costs the CV, not the letter.
    const skill = { ...page, blocks: page.blocks.map((block) => (block.type === "tools" ? { ...block, items: [...block.items, "Łódź"] } : block)) };
    expect(documentEligibility(skill, at)).toEqual({ cv: false, letter: true, ownCv: null });
  });

  it("keeps offering both documents when a printed text holds a bidirectional mark, a minus or a line separator", () => {
    const page = jonasDe();
    const located = (location: string): Page => ({ ...page, profile: { ...page.profile, location } });
    for (const location of ["Bremen\u200E", "\u2067Bremen\u2069 Nord", "Bremen\u202C", "\u221220 °C Tiefkühllager", "Bremen\u2028Nord", "Bremen\u061C"]) {
      expect(documentEligibility(located(location), at), JSON.stringify(location)).toEqual({ cv: true, letter: true, ownCv: null });
    }
    // A symbol WinAnsi has not still switches the documents that print it off in v1 (ADR 0089, point 5).
    for (const location of ["9 → 3", "✓ Gabelstapler", "≥ 3 Jahre", "★"]) {
      expect(documentEligibility(located(location), at), location).toEqual({ cv: false, letter: false, ownCv: null });
    }
  });
});

describe("documentInput", () => {
  it("reads the contact lines from the contact block only, the phone as written", () => {
    const input = documentInput(jonasDe(), { now: NOW });
    expect(input.phone).toEqual({ text: "+49 30 23125 457", uri: "tel:+493023125457" });
    expect(input.email).toEqual({ text: "jonas.brandt@example.com", uri: "mailto:jonas.brandt@example.com" });
    expect(input.status).toBe("Verfügbar ab 1. März 2027");
    expect(input.online).toBeNull();
    expect(input.target).toEqual({ label: "Bewerbung als", value: "Fachkraft für Lagerlogistik (m/w/d)" });
  });

  it("leaves a keyboard's bidirectional marks out of the printed contact lines and out of their links", () => {
    const page = withContact("mailto:\u2066jonas.brandt@example.com\u200E\u2069");
    const input = documentInput(page, { now: NOW });
    expect(input.email).toEqual({ text: "jonas.brandt@example.com", uri: "mailto:jonas.brandt@example.com" });
    const phone = withContact("tel:\u200E+493023125457");
    expect(documentInput(phone, { now: NOW }).phone).toEqual({ text: "+493023125457", uri: "tel:+493023125457" });
    expect(documentInput(withContact("mailto:\u200E"), { now: NOW }).email).toBeNull();
  });

  it("drops the status once its last day has passed", () => {
    const page = jonasDe();
    const until = { ...page, blocks: page.blocks.map((block) => (block.type === "contact" ? { ...block, statusUntil: "2026-11-01" } : block)) };
    expect(documentInput(until, { now: NOW }).status).toBeNull();
  });
});

describe("documentFilename", () => {
  it("names each document in the page's language", () => {
    expect(documentFilename("cv", "Jonas Brandt", "de")).toEqual({ ascii: "Lebenslauf_Jonas_Brandt.pdf", utf8: "Lebenslauf_Jonas_Brandt.pdf" });
    expect(documentFilename("letter", "Jonas Brandt", "de").ascii).toBe("Anschreiben_Jonas_Brandt.pdf");
    expect(documentFilename("application", "Jonas Brandt", "de").ascii).toBe("Bewerbung_Jonas_Brandt.pdf");
    expect(documentFilename("cv", "Jonas Brandt", "en").ascii).toBe("CV_Jonas_Brandt.pdf");
    expect(documentFilename("letter", "Jonas Brandt", "en").ascii).toBe("Cover_letter_Jonas_Brandt.pdf");
    expect(documentFilename("application", "Jonas Brandt", "en").ascii).toBe("Application_Jonas_Brandt.pdf");
  });

  it("writes umlauts out in ASCII and keeps them in UTF-8", () => {
    expect(documentFilename("cv", "Jörg Weiß-Müller", "de")).toEqual({ ascii: "Lebenslauf_Joerg_Weiss-Mueller.pdf", utf8: "Lebenslauf_Jörg_Weiß-Müller.pdf" });
    expect(documentFilename("cv", "  Renée   O'Hara ", "en")).toEqual({ ascii: "CV_Renee_OHara.pdf", utf8: "CV_Renée_OHara.pdf" });
  });
});
