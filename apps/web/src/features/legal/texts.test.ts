import { describe, expect, it } from "vitest";

import { COMPANY } from "./company";
import { agb, ALLOWED_PLACEHOLDERS, datenschutz, impressum, LEGAL_TEXT_LOCALES, musterWiderrufsformular, widerrufsbelehrung, type LegalDoc } from "./texts";

/** Anlage 2 zu Art. 246a § 1 Abs. 2 Satz 1 Nr. 1 EGBGB, as quoted in the legal report (r3 §4.5). */
const MUSTER_VERBATIM = [
  "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
  "– An [hier ist der Name, die Anschrift und die E-Mail-Adresse des Unternehmers durch den Unternehmer einzufügen]:",
  "– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)",
  "– Bestellt am (*)/erhalten am (*)",
  "– Name des/der Verbraucher(s)",
  "– Anschrift des/der Verbraucher(s)",
  "– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)",
  "– Datum",
  "(*) Unzutreffendes streichen.",
];
const TRADER_SLOT = "[hier ist der Name, die Anschrift und die E-Mail-Adresse des Unternehmers durch den Unternehmer einzufügen]";

const SITE = "https://example.test";
const DOCS: Record<string, LegalDoc> = { impressum: impressum(), datenschutz: datenschutz(), agb: agb(), widerrufsbelehrung: widerrufsbelehrung(SITE) };

const textOf = (doc: LegalDoc): string =>
  doc
    .map((block) => {
      switch (block.kind) {
        case "list":
          return block.items.join("\n");
        case "lines":
          return block.lines.join("\n");
        default:
          return block.text;
      }
    })
    .join("\n");

describe("legal texts (drafts)", () => {
  it("has German texts only, for now", () => {
    expect(LEGAL_TEXT_LOCALES).toEqual(["de"]);
  });

  it("quotes the Muster-Widerrufsformular word for word, with our data in the trader's slot", () => {
    const filled = MUSTER_VERBATIM.map((line) => line.replace(TRADER_SLOT, `${COMPANY.name}, ${COMPANY.address}, ${COMPANY.email}`));
    expect(musterWiderrufsformular()).toEqual(filled);
    const form = widerrufsbelehrung(SITE).find((block) => block.kind === "lines" && block.lines[0]?.startsWith("(Wenn Sie den Vertrag"));
    expect(form?.kind === "lines" ? form.lines : []).toEqual(filled);
  });

  it("takes every bracketed placeholder from COMPANY (or is a review note)", () => {
    for (const [name, doc] of Object.entries(DOCS)) {
      const brackets = textOf(doc).match(/\[[^\]]*\]/g) ?? [];
      for (const bracket of brackets) expect(ALLOWED_PLACEHOLDERS, `${name}: ${bracket}`).toContain(bracket);
    }
    // Company data appears in the texts only through COMPANY.
    expect(textOf(DOCS.impressum ?? [])).toContain(COMPANY.name);
    expect(textOf(DOCS.impressum ?? [])).toContain(COMPANY.vatId);
  });

  it("names Anthropic's retention, the legal basis, the transfer and the service retention periods", () => {
    const privacy = textOf(DOCS.datenschutz ?? []);
    expect(privacy).toContain("Anthropic");
    expect(privacy).toContain("bis zu 30 Tage");
    expect(privacy).toContain("bis zu 2 Jahre");
    expect(privacy).toContain("Art. 6 Abs. 1 lit. b DSGVO");
    expect(privacy).toContain("[Übermittlungsgrundlage: EU-US Data Privacy Framework / Standardvertragsklauseln – vom Anwalt zu prüfen]");
    expect(privacy).toContain("[vom Anwalt mit dem DPA abzugleichen]");
    expect(privacy).toContain("Fotos senden wir nie");
    expect(privacy).toContain("30 Tage nach Abschluss der Bestellung");
    expect(privacy).toContain("3 Jahre");
    expect(privacy).toContain("10 Jahre (§ 147 Abgabenordnung)");
    expect(privacy).toContain("js.stripe.com");
  });

  it("has the anchors the creator pages link to", () => {
    expect(DOCS.impressum?.some((block) => block.kind === "h2" && block.id === "melden")).toBe(true);
    expect(DOCS.datenschutz?.some((block) => block.kind === "h2" && block.id === "creator-pages")).toBe(true);
  });

  it("says Arbeitstag, never Werktag, and keeps the money-back promise to once per account", () => {
    for (const doc of Object.values(DOCS)) expect(textOf(doc)).not.toMatch(/werktag/i);
    expect(textOf(DOCS.agb ?? [])).toContain("Arbeitstag (Mo–Fr, außer bundesweite Feiertage)");
    expect(textOf(DOCS.agb ?? [])).toContain("einmal pro Konto");
  });

  it("puts the online withdrawal function and the early-start amount in the Widerrufsbelehrung", () => {
    const policy = textOf(DOCS.widerrufsbelehrung ?? []);
    expect(policy).toContain("Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.");
    expect(policy).toContain("ab dem Tag des Vertragsabschlusses");
    expect(policy).toContain(`${SITE}/de/widerruf`);
    expect(policy).toContain("Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen");
  });

  it("states the § 36 VSBG position as a draft", () => {
    expect(textOf(DOCS.impressum ?? [])).toContain("Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.");
  });
});
