import {
  Accessibility,
  Award,
  Camera,
  Car,
  ChartColumn,
  ChefHat,
  ClipboardCheck,
  CodeXml,
  Database,
  FileText,
  Forklift,
  Handshake,
  Headset,
  IdCard,
  Languages,
  Megaphone,
  MousePointerClick,
  PackageCheck,
  PackageOpen,
  PaintBucket,
  Palette,
  Presentation,
  ScanBarcode,
  ShieldCheck,
  Signpost,
  Stethoscope,
  TriangleAlert,
  Truck,
  Users,
  Warehouse,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { sevagDe } from "@/features/previews/sevag";

import {
  iconFor,
  isLetter,
  keepCounts,
  keepSeparators,
  LEAD_MAX,
  lineEms,
  readingMinutes,
  splitLead,
  textKind,
  widestWord,
  wordsOf,
} from "./laufbahn-content";
import { paragraphs } from "./sections";

const SOFT = "\u00AD";
/** The icon's display name, so a failure names the icon instead of printing a component. */
const named = (icon: LucideIcon | undefined): string => icon?.displayName ?? "none";

describe("the skills' icon map", () => {
  it("gives every one of Sevag's skills the icon the brief names", () => {
    const expected: [string, LucideIcon][] = [
      ["Seitenschubstapler", Forklift],
      ["Flurförderzeugschein", IdCard],
      ["Kommissionierung", PackageCheck],
      ["Scannen von Waren", ScanBarcode],
      ["Be- und Entladen von Lkw", Truck],
      ["Ein- und Auslagern", Warehouse],
      ["SAP: Bestände & Buchungen", Database],
      ["Inventur", ClipboardCheck],
      ["Versanddokumente", FileText],
      ["Ladungssicherung", ShieldCheck],
      ["Gefahrgut", TriangleAlert],
      ["Warenausgabe", PackageOpen],
    ];
    const items = sevagDe.blocks.find((block) => block.type === "tools")?.items ?? [];
    expect(items).toEqual(expected.map(([label]) => label));
    for (const [label, icon] of expected) expect(named(iconFor(label, "de")), label).toBe(named(icon));
  });

  it("reads German compounds by their head: a licence for a forklift is a licence", () => {
    const cases: [string, LucideIcon][] = [
      ["Gabelstapler", Forklift],
      ["Staplerfahrer", Forklift],
      ["Staplerschein", IdCard],
      ["Gabelstaplerschein", IdCard],
      ["Führerschein Klasse B", IdCard],
      ["Lkw-Führerschein", IdCard],
      ["Lagerist", Warehouse],
      ["Hochregallager", Warehouse],
      ["Lagerlogistik", Warehouse],
      ["Einlagerung", Warehouse],
      ["Verladen", Truck],
      ["Lkw", Truck],
      ["Frachtpapiere", FileText],
      ["Arbeitssicherheit", ShieldCheck],
      ["Gefahrstoffe", TriangleAlert],
      ["Auftragskommissionierung", PackageCheck],
      ["Teamarbeit", Users],
      ["Kundenkontakt", Handshake],
      ["Fremdsprachen", Languages],
      ["Neu für mich: das Tönen", PaintBucket],
      ["Reportagefotografie", Camera],
      ["Erscheinungsbilder", Palette],
      ["Leitsysteme", Signpost],
      ["UX-Design", MousePointerClick],
      ["Barrierefreiheit", Accessibility],
      ["Workshops", Presentation],
      ["TypeScript", CodeXml],
      ["IHK-Zertifikat", Award],
    ];
    for (const [label, icon] of cases) expect(named(iconFor(label, "de")), label).toBe(named(icon));
  });

  it("reads English whole words and their usual forms", () => {
    const cases: [string, LucideIcon][] = [
      ["Forklift", Forklift],
      ["Forklift operation", Forklift],
      ["Barcode scanning", ScanBarcode],
      ["Scanner", ScanBarcode],
      ["Truck loading", Truck],
      ["Warehouse management", Warehouse],
      ["Order picking", PackageCheck],
      ["Goods issue", PackageOpen],
      ["Inventory", ClipboardCheck],
      ["Shipping documents", FileText],
      ["Load securing", ShieldCheck],
      ["Hazardous goods", TriangleAlert],
      ["SAP", Database],
      ["Teamwork", Users],
      ["Customer contact", Handshake],
      ["Driving licence", IdCard],
      ["Languages", Languages],
      ["Reportage photography", Camera],
      ["Identities", Palette],
      ["Wayfinding", Signpost],
      ["UX design", MousePointerClick],
      ["Accessibility", Accessibility],
      ["Workshops", Presentation],
      ["Diploma in communication design", Award],
    ];
    for (const [label, icon] of cases) expect(named(iconFor(label, "en")), label).toBe(named(icon));
  });

  it("reads Arabic words with their article and conjunctions, and without their short vowels", () => {
    const cases: [string, LucideIcon][] = [
      ["قيادة الرافعة الشوكية", Forklift],
      ["رخصة قيادة", IdCard],
      ["مسح الباركود", ScanBarcode],
      ["تحميل وتفريغ الشاحنات", Truck],
      ["إدارة المستودعات", Warehouse],
      ["الجرد", ClipboardCheck],
      ["المستندات", FileText],
      ["السلامة المهنية", ShieldCheck],
      ["المواد الخطرة", TriangleAlert],
      ["العمل ضمن الفريق", Users],
      ["العملاء", Handshake],
      ["خدمة العملاء", Headset],
      ["اللغات", Languages],
      ["الهويات البصرية", Palette],
      ["اللوحات الإرشادية", Signpost],
      ["تصوير الريبورتاج", Camera],
      ["تجربة المستخدم", MousePointerClick],
      ["سهولة الوصول", Accessibility],
      ["ورش العمل", Presentation],
      ["دبلوم في تصميم الاتصال", Award],
      ["الرَّافِعَة", Forklift],
    ];
    for (const [label, icon] of cases) expect(named(iconFor(label, "ar")), label).toBe(named(icon));
  });

  it("never takes a look-alike", () => {
    // [label, page language, the icon a careless match would give]
    const lookAlikes: [string, "de" | "en" | "ar", LucideIcon][] = [
      ["Schlager", "de", Warehouse],
      ["Kugellager", "de", Warehouse],
      ["Lagerfeuer", "de", Warehouse],
      ["Trainingslager", "de", Warehouse],
      ["Gutschein", "de", IdCard],
      ["Sonnenschein", "de", IdCard],
      ["Krankenversicherung", "de", ShieldCheck],
      ["Unsicherheit", "de", ShieldCheck],
      ["Urkunden", "de", Handshake],
      ["Diplomatie", "de", Award],
      ["Dokumentarfilm", "de", FileText],
      ["Lager beer", "en", Warehouse],
      ["Scandal", "en", ScanBarcode],
      ["Inventor", "en", ClipboardCheck],
      ["Download", "en", Truck],
      ["Deliverables", "en", Truck],
      ["Documentary", "en", FileText],
      ["Designated driver", "en", Palette],
      ["إفريقيا", "ar", Users],
      ["شاحن الهاتف", "ar", Truck],
      // An application is no advertising, "gefahren" (driven) no hazard, Photovoltaik no photograph.
      ["Bewerbung", "de", Megaphone],
      ["Initiativbewerbung", "de", Megaphone],
      ["Zu meiner Bewerbung", "de", Megaphone],
      ["Stapler gefahren seit 2015", "de", TriangleAlert],
      ["Lkw gefahren", "de", TriangleAlert],
      ["Photovoltaik", "de", Camera],
      ["Photovoltaik-Montage", "de", Camera],
      ["Photovoltaic installation", "en", Camera],
      // Care of vehicles, buildings and landscapes is no nursing; annual accounts and contracts are no degree.
      ["Fahrzeugpflege", "de", Stethoscope],
      ["Gebäudepflege", "de", Stethoscope],
      ["Landschaftspflege", "de", Stethoscope],
      ["Jahresabschluss", "de", Award],
      ["Vertragsabschluss", "de", Award],
      // Agreements and call-backs are no languages; nor is a cuisine, a polish or an Arab market.
      ["Absprachen treffen", "de", Languages],
      ["Rücksprache", "de", Languages],
      ["Vertragsabsprache", "de", Languages],
      ["Kundenansprache", "de", Languages],
      ["Italian cooking", "en", Languages],
      ["German cuisine", "en", Languages],
      ["Floor polish", "en", Languages],
      ["طبخ عربي", "ar", Languages],
      ["السوق العربي", "ar", Languages],
      // Leadership is no driving, a car workshop no presentation, an impostor no forklift.
      ["مهارات القيادة", "ar", Car],
      ["ورشة سيارات", "ar", Presentation],
      ["Car workshop", "en", Presentation],
      ["Hochstapler", "de", Forklift],
      ["تحليل البيانات", "ar", Database],
    ];
    for (const [label, locale, lookAlike] of lookAlikes) expect(named(iconFor(label, locale)), label).not.toBe(named(lookAlike));
    // Most have no icon at all (the template's neutral one stands in); some find their own.
    for (const label of ["Schlager", "Gutschein", "Sonnenschein", "Krankenversicherung", "Urkunden"]) expect(iconFor(label, "de"), label).toBeUndefined();
    expect(iconFor("Dokumentarfilm", "de")).toBe(Camera);
    expect(iconFor("", "de")).toBeUndefined();
    for (const label of ["Hochstapler", "Absprachen treffen", "Jahresabschluss", "Fahrzeugpflege"]) expect(iconFor(label, "de"), label).toBeUndefined();
  });

  it("gives the look-alikes their own icon where they have one", () => {
    const cases: [string, "de" | "en" | "ar", LucideIcon][] = [
      ["Photovoltaik", "de", Zap],
      ["Photovoltaic installation", "en", Wrench],
      ["Bewerbungsunterlagen", "de", FileText],
      ["Kundenansprache", "de", Handshake],
      ["Italian cooking", "en", ChefHat],
      ["طبخ عربي", "ar", ChefHat],
      ["ورشة سيارات", "ar", Wrench],
      ["Car workshop", "en", Wrench],
      ["تحليل البيانات", "ar", ChartColumn],
      ["قيادة السيارات", "ar", Car],
      ["Krankenpflege", "de", Stethoscope],
      ["Altenpflege", "de", Stethoscope],
      ["Realschulabschluss", "de", Award],
      ["Gefahrgut", "de", TriangleAlert],
      ["Gefahrstoffe", "de", TriangleAlert],
    ];
    for (const [label, locale, icon] of cases) expect(named(iconFor(label, locale)), label).toBe(named(icon));
  });

  it("names a language by its name only when the text says nothing else (apart from a level)", () => {
    const cases: [string, "de" | "en" | "ar"][] = [
      ["Deutsch", "de"],
      ["Englisch (C1)", "de"],
      ["Deutsch und Englisch", "de"],
      ["Arabisch – Muttersprache", "de"],
      ["English", "en"],
      ["Arabic (native)", "en"],
      ["German, fluent", "en"],
      ["عربي", "ar"],
      ["اللغة العربية", "ar"],
      ["الإنجليزية (جيد)", "ar"],
    ];
    for (const [label, locale] of cases) expect(named(iconFor(label, locale)), label).toBe(named(Languages));
  });

  it("reads a page's own language and English only (an English lager is beer)", () => {
    expect(iconFor("Lager", "de")).toBe(Warehouse);
    expect(iconFor("Lager", "en")).toBeUndefined();
    expect(iconFor("SAP", "ar")).toBe(Database);
  });

  it("splits words at anything that is not a letter or a digit, and ignores soft hyphens", () => {
    expect(wordsOf(`SAP: Bestände & Buchungen`)).toEqual(["sap", "bestände", "buchungen"]);
    expect(wordsOf(`Flurförder${SOFT}zeug${SOFT}schein`)).toEqual(["flurförderzeugschein"]);
    expect(wordsOf("الرَّافِعَة")).toEqual(["الرافعه"]);
  });
});

describe("text sections", () => {
  const letter = sevagDe.blocks.find((block) => block.type === "text" && block.id === "letter");
  const toning = sevagDe.blocks.find((block) => block.type === "text" && block.id === "toning");
  const letterText = letter?.type === "text" ? letter.text : "";
  const toningText = toning?.type === "text" ? toning.text : "";

  it("sets a short note as a callout, a long read as a reading tile and the rest as paragraphs", () => {
    expect(toningText.length).toBeLessThan(320);
    expect(textKind(toningText)).toBe("note");
    expect(textKind(letterText)).toBe("reading");
    expect(textKind("Ein Satz. ".repeat(40))).toBe("plain");
    expect(textKind("Eins.\n\nZwei.\n\nDrei. ".repeat(20))).toBe("reading");
  });

  it("reads Sevag's letter as seven paragraphs, a minute's read", () => {
    expect(paragraphs(letterText)).toHaveLength(7);
    expect(readingMinutes(letterText)).toBe(1);
  });

  it("knows a letter by its title or by its salutation and closing, in three languages", () => {
    expect(isLetter("Anschreiben", letterText, "de")).toBe(true);
    expect(isLetter("Bewerbung", letterText, "de")).toBe(true);
    expect(isLetter("Cover letter", "Dear Ms Smith,\n\n" + "I am writing to apply. ".repeat(40) + "\n\nKind regards\nSam", "en")).toBe(true);
    expect(isLetter("خطاب التقديم", "نص طويل. ".repeat(80), "ar")).toBe(true);
    expect(isLetter("Mein Brief an Sie", "Ich mag Ordnung. ".repeat(60), "de")).toBe(true);
    // A short note is never a letter; neither is a long text with neither title nor greeting.
    expect(isLetter("Anschreiben", toningText, "de")).toBe(false);
    expect(isLetter("Mein Steckbrief", "Ich mag Ordnung. ".repeat(60), "de")).toBe(false);
    // An English "brief" is a summary, not a letter.
    for (const title of ["The brief", "Brief", "In brief", "Project brief", "Brief bio"]) expect(isLetter(title, "I like order. ".repeat(60), "en"), title).toBe(false);
  });

  it("leads with the first sentence of a long first paragraph, and drops nothing", () => {
    const about = sevagDe.blocks.find((block) => block.type === "about");
    const first = paragraphs(about?.type === "about" ? about.text : "")[0] ?? "";
    expect(first.length).toBeGreaterThan(LEAD_MAX);
    const [lead, rest] = splitLead(first);
    expect(lead).toBe("In meiner aktuellen Position liegt mein Schwerpunkt in der Kommissionierung, im Scannen von Waren und im Be- und Entladen von Lkw.");
    expect(rest).toBe("Das sichere Ein- und Auslagern mit dem Seitenschubstapler gehört zu meinen täglichen Aufgaben.");
    expect(`${lead} ${rest ?? ""}`).toBe(first);
    // A short paragraph leads whole.
    expect(splitLead("Ich arbeite gern im Lager.")).toEqual(["Ich arbeite gern im Lager.", null]);
    // Never after an abbreviation, a single letter or an ordinal; never before a small letter.
    const tricky = `Ich arbeite seit dem 1. Mai im Lager, z. B. mit dem Stapler, bzw. Hubwagen und ca. zehn Kollegen aus Lörrach. ${"Danach mehr. ".repeat(12)}`;
    expect(splitLead(tricky)[0]).toBe("Ich arbeite seit dem 1. Mai im Lager, z. B. mit dem Stapler, bzw. Hubwagen und ca. zehn Kollegen aus Lörrach.");
    // Arabic: a full stop before an Arabic letter ends a sentence.
    const arabic = `أعمل في المستودع منذ عام ألفين وثمانية عشر وأقود الرافعة الشوكية يومياً. ${"وأحب النظام والعمل ضمن الفريق. ".repeat(6)}`;
    expect(splitLead(arabic)[0]).toBe("أعمل في المستودع منذ عام ألفين وثمانية عشر وأقود الرافعة الشوكية يومياً.");
  });
});

describe("round 6: the dossier's head", () => {
  const NBSP = String.fromCharCode(0xa0);

  it("keeps a separator's dot at the end of a line: a non-breaking space before every ' · '", () => {
    expect(keepSeparators("Fachkraft für Lagerlogistik · Staplerfahrer")).toBe(`Fachkraft für Lagerlogistik${NBSP}· Staplerfahrer`);
    expect(keepSeparators("A · B · C")).toBe(`A${NBSP}· B${NBSP}· C`);
    expect(keepSeparators("Ohne Trenner")).toBe("Ohne Trenner");
    // Only the spaced separator: a dot inside a word or a figure stays as it is.
    expect(keepSeparators("1·2")).toBe("1·2");
  });

  it("keeps a count with its word and a separator's dot at the end of a line (the documents' meta lines)", () => {
    expect(keepCounts("Beides in einer Datei · 2 Seiten")).toBe(`Beides in einer Datei${NBSP}· 2${NBSP}Seiten`);
    expect(keepCounts("PDF · A4 · 1 Seite")).toBe(`PDF${NBSP}· A4${NBSP}· 1${NBSP}Seite`);
    expect(keepCounts("Both in one file · 2 pages")).toBe(`Both in one file${NBSP}· 2${NBSP}pages`);
    // Any script's digits and letters: "٣ صفحات" stays together too.
    expect(keepCounts("٣ صفحات")).toBe(`٣${NBSP}صفحات`);
    // Only a number before a word is glued: the spaces between words stay.
    expect(keepCounts("Lebenslauf und Anschreiben")).toBe("Lebenslauf und Anschreiben");
  });

  it("measures figures by their digits (0.62 em), commas and points (0.3 em) and the per cent sign (0.8 em)", () => {
    const average = 0.53;
    expect(lineEms("2019", average)).toBeCloseTo(4 * 0.62);
    expect(lineEms("99,6", average)).toBeCloseTo(3 * 0.62 + 0.3);
    expect(lineEms("%", average)).toBeCloseTo(0.8);
    // A wider face scales every class with its average.
    expect(lineEms("2019", 0.52)).toBeCloseTo((4 * 0.62 * 0.52) / 0.53);
  });

  it("finds a name's widest word (each word may take its own line on a phone)", () => {
    expect(widestWord("Jo Brandt", 0.52)).toBe("Brandt");
    expect(widestWord("Maximilian Ek", 0.52)).toBe("Maximilian");
    expect(widestWord("Lea Hartmann-Weiß", 0.52)).toBe("Hartmann-Weiß");
  });
});
