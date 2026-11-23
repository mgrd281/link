import {
  Accessibility,
  Award,
  Camera,
  ClipboardCheck,
  CodeXml,
  Database,
  FileText,
  Forklift,
  Handshake,
  Headset,
  IdCard,
  Languages,
  MousePointerClick,
  PackageCheck,
  PackageOpen,
  PaintBucket,
  Palette,
  Presentation,
  ScanBarcode,
  ShieldCheck,
  Signpost,
  TriangleAlert,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { sevagDe } from "@/features/previews/sevag";

import {
  factSpans,
  HALF_ROW_EMS,
  iconFor,
  isLetter,
  longestPieceEms,
  opensShort,
  packSpans,
  paragraphsOf,
  readingMinutes,
  skillSpans,
  softJoints,
  textKind,
  wordsOf,
} from "./laufbahn-content";

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
    ];
    for (const [label, locale, lookAlike] of lookAlikes) expect(named(iconFor(label, locale)), label).not.toBe(named(lookAlike));
    // Most have no icon at all (the template's neutral one stands in); some find their own.
    for (const label of ["Schlager", "Gutschein", "Sonnenschein", "Krankenversicherung", "Urkunden"]) expect(iconFor(label, "de"), label).toBeUndefined();
    expect(iconFor("Dokumentarfilm", "de")).toBe(Camera);
    expect(iconFor("", "de")).toBeUndefined();
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

describe("the joints of German compounds", () => {
  it("lets a long compound break only where its parts meet, and nowhere else", () => {
    expect(softJoints("Flurförderzeugschein", "de")).toBe(`Flurförder${SOFT}zeug${SOFT}schein`);
    expect(softJoints("Seitenschubstapler", "de")).toBe(`Seitenschub${SOFT}stapler`);
    expect(softJoints("Versanddokumente", "de")).toBe(`Versand${SOFT}dokumente`);
    expect(softJoints("Ladungssicherung", "de")).toBe(`Ladungs${SOFT}sicherung`);
    expect(softJoints("Warenausgabe", "de")).toBe(`Waren${SOFT}ausgabe`);
    expect(softJoints("keine Farbenfehlsichtigkeit", "de")).toBe(`keine Farben${SOFT}fehlsichtigkeit`);
    // "-ierung" breaks before its consonant, as German syllables do.
    expect(softJoints("Kommissionierung", "de")).toBe(`Kommissio${SOFT}nierung`);
  });

  it("leaves short words, other languages and words without a known joint alone", () => {
    expect(softJoints("Gefahrgut", "de")).toBe("Gefahrgut");
    expect(softJoints("Barrierefreiheit", "de")).toBe("Barrierefreiheit");
    expect(softJoints("Seitenschubstapler", "en")).toBe("Seitenschubstapler");
    expect(softJoints("Be- und Entladen von Lkw", "de")).toBe("Be- und Entladen von Lkw");
    // No stub on either side of a joint.
    expect(softJoints("Gabelstapler", "de")).toBe(`Gabel${SOFT}stapler`);
    expect(softJoints("Staplerschein", "de")).toBe(`Stapler${SOFT}schein`);
  });
});

describe("tiles", () => {
  it("never leaves a hole and never changes the order", () => {
    expect(packSpans([2, 1, 1, 1], 2)).toEqual([2, 1, 1, 2]);
    expect(packSpans([1, 2, 1, 1], 2)).toEqual([2, 2, 1, 1]);
    expect(packSpans([2, 1, 1, 1, 1], 3)).toEqual([2, 1, 1, 1, 1]);
    expect(packSpans([2, 1, 1, 1], 3)).toEqual([2, 1, 1, 2]);
    expect(packSpans([1], 2)).toEqual([2]);
    expect(packSpans([], 2)).toEqual([]);
    for (const columns of [2, 3]) {
      for (const wants of [[1, 1, 1], [2, 2, 1], [1, 3, 1, 1], [2, 1, 1, 1, 1, 1, 1]]) {
        const spans = packSpans(wants, columns);
        expect(spans.reduce((sum, span) => sum + span, 0) % columns, `${String(wants)} in ${String(columns)}`).toBe(0);
      }
    }
  });

  it("lets the first of five or more skills lead and closes the last row (Sevag: twelve skills)", () => {
    const labels = (sevagDe.blocks.find((block) => block.type === "tools")?.items ?? []).map((item) => softJoints(item, "de"));
    const spans = skillSpans(labels);
    // Phones: the lead across, five pairs, the twelfth across. Tablets and up: the lead beside one, three rows of three, the twelfth across.
    expect(spans.phone).toEqual([2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
    expect(spans.wide).toEqual([2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3]);
    expect(skillSpans(["SAP", "Excel", "Teamwork", "Forklift"]).phone).toEqual([1, 1, 1, 1]);
  });

  it("gives a label the whole row only when a piece of it cannot fit half a 360 px phone's row", () => {
    expect(HALF_ROW_EMS).toBeCloseTo(8.25);
    expect(longestPieceEms(`Flurförder${SOFT}zeug${SOFT}schein`)).toBeLessThan(HALF_ROW_EMS);
    expect(longestPieceEms("Donaudampfschifffahrtsgesellschaft")).toBeGreaterThan(HALF_ROW_EMS);
    expect(skillSpans(["Forklift", "Donaudampfschifffahrtsgesellschaft", "SAP", "Team"]).phone).toEqual([2, 2, 1, 1]);
  });

  it("sets Sevag's four facts as a two-by-two sheet", () => {
    const facts = sevagDe.blocks.find((block) => block.type === "about")?.facts ?? [];
    expect(factSpans(facts.map((fact) => softJoints(fact.value, "de")))).toEqual([1, 1, 1, 1]);
    // Three facts: the third across.
    expect(factSpans(["Berlin", "Deutsch, Englisch", "Kultur"])).toEqual([1, 1, 2]);
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

  it("opens a long read with two paragraphs on phones (Sevag's letter: seven paragraphs, a minute's read)", () => {
    expect(letterText.length).toBeGreaterThan(900);
    expect(opensShort(letterText)).toBe(true);
    expect(paragraphsOf(letterText)).toHaveLength(7);
    expect(readingMinutes(letterText)).toBe(1);
    expect(opensShort(toningText)).toBe(false);
  });

  it("knows a letter by its title or by its salutation and closing, in three languages", () => {
    expect(isLetter("Anschreiben", letterText)).toBe(true);
    expect(isLetter("Bewerbung", letterText)).toBe(true);
    expect(isLetter("Cover letter", "Dear Ms Smith,\n\n" + "I am writing to apply. ".repeat(40) + "\n\nKind regards\nSam")).toBe(true);
    expect(isLetter("خطاب التقديم", "نص طويل. ".repeat(80))).toBe(true);
    // A short note is never a letter; neither is a long text with neither title nor greeting.
    expect(isLetter("Anschreiben", toningText)).toBe(false);
    expect(isLetter("Mein Steckbrief", "Ich mag Ordnung. ".repeat(60))).toBe(false);
  });
});
