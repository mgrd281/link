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
  BESIDE_ICON_EMS,
  factSpans,
  fitsBeside,
  iconFor,
  isLetter,
  LEAD_MAX,
  linesIn,
  longestPieceEms,
  opensShort,
  packSpans,
  pairUp,
  readingMinutes,
  skillLayout,
  softJoints,
  splitLead,
  textKind,
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

  it("closes a last row of one in three columns as one and two, then two and one", () => {
    expect(packSpans([2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 3)).toEqual([2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1]);
    expect(packSpans([1, 1, 1, 1], 3)).toEqual([1, 2, 2, 1]);
    // Not when the row before is not three single tiles.
    expect(packSpans([2, 1, 1], 3)).toEqual([2, 1, 3]);
  });

  it("pairs half tiles past at most two whole-row tiles, keeps the first in place and closes the last row", () => {
    expect(pairUp([2, 1, 2, 1, 1])).toEqual({ order: [0, 1, 3, 2, 4], spans: [2, 1, 1, 2, 2] });
    expect(pairUp([1, 1, 1])).toEqual({ order: [0, 1, 2], spans: [1, 1, 2] });
    // Three whole-row tiles in between: the waiting tile takes its row, nothing moves.
    expect(pairUp([1, 2, 2, 2, 1])).toEqual({ order: [0, 1, 2, 3, 4], spans: [2, 2, 2, 2, 2] });
    expect(pairUp([])).toEqual({ order: [], spans: [] });
    for (const wants of [[2, 1, 2, 2, 1, 1, 2, 1], [1, 2, 1, 2, 1, 2, 1], [1, 1, 2, 1]]) {
      const { order, spans } = pairUp(wants);
      expect([...order].sort((x, y) => x - y)).toEqual(wants.map((_, index) => index));
      expect(spans.reduce((sum, span) => sum + span, 0) % 2).toBe(0);
      // No tile moves more than two places.
      order.forEach((index, place) => expect(Math.abs(index - place)).toBeLessThanOrEqual(2));
    }
  });

  it("lays out Sevag's twelve skills in eight rows on phones: the lead, four pairs, three across", () => {
    const items = sevagDe.blocks.find((block) => block.type === "tools")?.items ?? [];
    const layout = skillLayout(items.map((item) => softJoints(item, "de")));
    const rows = layout.order.map((index, place) => `${items[index] ?? ""}${layout.phone[place] === 2 ? " ↔" : ""}`);
    expect(rows).toEqual([
      "Seitenschubstapler ↔",
      "Flurförderzeugschein",
      "Scannen von Waren",
      "Kommissionierung ↔",
      "Be- und Entladen von Lkw ↔",
      "Ein- und Auslagern",
      "Inventur",
      "SAP: Bestände & Buchungen ↔",
      "Versanddokumente",
      "Ladungssicherung",
      "Gefahrgut",
      "Warenausgabe",
    ]);
    // Tablets and up: the lead beside one, rows of three, the end as one and two, then two and one.
    expect(layout.wide).toEqual([2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1]);
    // Four skills: no lead, two pairs.
    expect(skillLayout(["SAP", "Excel", "Teamwork", "Forklift"]).phone).toEqual([1, 1, 1, 1]);
  });

  it("lets a label share a row only when it fits beside its icon in two lines, never breaking a word on a 360 px phone", () => {
    expect(BESIDE_ICON_EMS.narrow).toBeCloseTo(5.625);
    expect(BESIDE_ICON_EMS.phone).toBeCloseTo(6.5625);
    expect(linesIn(`Flurförder${SOFT}zeug${SOFT}schein`, BESIDE_ICON_EMS.phone)).toBe(2);
    expect(linesIn("Be- und Entladen von Lkw", BESIDE_ICON_EMS.phone)).toBe(3);
    expect(linesIn("Inventur", BESIDE_ICON_EMS.phone)).toBe(1);
    expect(fitsBeside(`Versand${SOFT}dokumente`)).toBe(true);
    // "Kommissio-" is wider than the room beside the icon on a 360 px phone.
    expect(fitsBeside(`Kommissio${SOFT}nierung`)).toBe(false);
    expect(fitsBeside("SAP: Bestände & Buchungen")).toBe(false);
    expect(longestPieceEms("Donaudampfschifffahrtsgesellschaft")).toBeGreaterThan(BESIDE_ICON_EMS.narrow);
    // Only a piece that ends at a soft hyphen counts the hyphen.
    expect(longestPieceEms(`Waren${SOFT}ausgabe`)).toBeCloseTo(Math.max(longestPieceEms("Waren") + 0.35, longestPieceEms("ausgabe")));
    expect(skillLayout(["Forklift", "Donaudampfschifffahrtsgesellschaft", "SAP", "Team"]).phone).toEqual([1, 1, 2, 2]);
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
    expect(paragraphs(letterText)).toHaveLength(7);
    expect(readingMinutes(letterText)).toBe(1);
    expect(opensShort(toningText)).toBe(false);
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
