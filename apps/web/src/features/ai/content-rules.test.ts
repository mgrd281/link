import { describe, expect, it } from "vitest";

import { arabicShare, checkFreeText, factsFrom, languageWarning, numbersIn } from "./content-rules";

const facts = factsFrom(["DJ & Producer. Berlin. Tour 2027, Tickets ab 24,99 €", "lio-vance.de", "Nachtstrom EP", "[E-Mail] [Telefon]"]);

describe("content rules", () => {
  it("collects the numbers and hosts of the sources", () => {
    expect(facts.numbers.has("2027")).toBe(true);
    expect(facts.numbers.has("2499")).toBe(true);
    expect(facts.numbers.has("24")).toBe(true);
    expect(facts.hosts.has("lio-vance.de")).toBe(true);
    expect(numbersIn("١٢ und 3,5")).toEqual(["12", "35"]);
  });

  it("keeps text that only says what the sources say", () => {
    expect(checkFreeText("Tour 2027 – Tickets ab 24.99 € auf lio-vance.de", facts)).toEqual({ text: "Tour 2027 – Tickets ab 24.99 € auf lio-vance.de", changed: false, invented: false });
  });

  it("marks a number the sources never said as invented", () => {
    expect(checkFreeText("Über 10.000 Fans", facts).invented).toBe(true);
    expect(checkFreeText("Seit 2015 auf der Bühne", facts).invented).toBe(true);
    expect(checkFreeText("Tickets für ٢٠٢٧", facts).invented).toBe(false);
  });

  it("removes addresses, e-mail addresses and phone numbers that are not in the sources", () => {
    expect(checkFreeText("Mehr auf evil.example.com und https://spam.io/x", facts)).toMatchObject({ text: "Mehr auf und", changed: true });
    expect(checkFreeText("Schreib an lio@example.com.", facts)).toMatchObject({ text: "Schreib an.", changed: true, invented: false });
    expect(checkFreeText("Ruf an: +49 170 1234567", facts)).toMatchObject({ text: "Ruf an:", changed: true, invented: false });
    expect(checkFreeText("Kontakt: [E-Mail]", facts)).toMatchObject({ text: "Kontakt:", changed: true });
  });

  it("does not take abbreviations for addresses", () => {
    expect(checkFreeText("Musik, z.B. Techno, u.a. live", facts)).toMatchObject({ changed: false });
  });

  it("checks Arabic pages for Arabic letters (a warning only)", () => {
    expect(arabicShare("مدربة حياة Lio")).toBeGreaterThan(0.5);
    expect(languageWarning("ar", ["Life coach for new beginnings"])).toBe(true);
    expect(languageWarning("ar", ["مدربة حياة للبدايات الجديدة", "Zoom"])).toBe(false);
    expect(languageWarning("de", ["Life coach"])).toBe(false);
  });
});
