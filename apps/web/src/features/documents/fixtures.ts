import type { Block, BlockOf, Page } from "@linkyo/blocks";

import { applicationSample } from "@/features/previews/application-sample";

/**
 * Fictional pages for the documents' tests (nobody here is a real person; contact data is
 * example.com and the film-and-television phone range). Built from the fictional applicant
 * (features/previews/application-sample.ts) with one thing changed each.
 */

export const jonasDe = (): Page => applicationSample("de");
export const jonasEn = (): Page => applicationSample("en");
export const karimAr = (): Page => applicationSample("ar");

/** The fictional applicant with some blocks changed or replaced. */
function withBlocks(page: Page, change: (blocks: Block[]) => Block[]): Page {
  return { ...page, blocks: change(page.blocks) };
}

const replace = <T extends Block["type"]>(type: T, change: (block: BlockOf<T>) => BlockOf<T>) => (blocks: Block[]): Block[] =>
  blocks.map((block) => (block.type === type ? change(block as BlockOf<T>) : block));

/** A name WinAnsi cannot print: no PDF in v1 (a letter is never dropped). */
export const lukasz = (): Page => {
  const page = jonasDe();
  return { ...page, profile: { ...page.profile, displayName: "Łukasz Kowalski" } };
};

/** No cover letter: the CV only. */
export const noLetter = (): Page => withBlocks(jonasDe(), (blocks) => blocks.filter((block) => block.id !== "letter" && block.id !== "letter-title"));

/** The cover letter switched off. */
export const hiddenLetter = (): Page => withBlocks(jonasDe(), replace("text", (block) => (block.id === "letter" ? { ...block, visible: false } : block)));

/** The cover letter scheduled to have ended before `now` in the tests (2026-11-26). */
export const endedLetter = (): Page =>
  withBlocks(jonasDe(), replace("text", (block) => (block.id === "letter" ? { ...block, schedule: { until: "2026-11-01T00:00:00Z" } } : block)));

/** A career only: no about, skills, note, letter or contact. */
export const sparse = (): Page => withBlocks(jonasDe(), (blocks) => blocks.filter((block) => block.type === "timeline"));

/** Skills only. */
export const toolsOnly = (): Page => withBlocks(jonasDe(), (blocks) => blocks.filter((block) => block.type === "tools"));

/** Figures and a bio only: nothing for a CV. */
export const statsAndBio = (): Page => withBlocks(jonasDe(), () => []);

/** The owner's own CV file in the contact block: it replaces the generated one. */
export const ownCv = (): Page =>
  withBlocks(
    jonasDe(),
    replace("contact", (block) => ({ ...block, links: [...(block.links ?? []), { kind: "cv", label: "Mein Lebenslauf", url: "https://example.com/jonas-brandt-lebenslauf.pdf" }] })),
  );

/** The same applicant with another primary address (an e-mail of another length, say). */
export const withContact = (url: string): Page => withBlocks(jonasDe(), replace("contact", (block) => ({ ...block, primary: { ...block.primary, url } })));

/** The same applicant with another cover letter text. */
export const withLetter = (text: string): Page => withBlocks(jonasDe(), replace("text", (block) => (block.id === "letter" ? { ...block, text } : block)));

/** The same applicant with a longer e-mail address (the miniature's contact bars keep their width). */
export const longEmail = (): Page =>
  withBlocks(
    jonasDe(),
    replace("contact", (block) => ({ ...block, primary: { ...block.primary, url: "mailto:jonas.brandt.bewerbungen.lagerlogistik@example.com" } })),
  );

const SENTENCES = [
  "Im Wareneingang prüfe ich Lieferungen gegen Lieferschein und Bestellung und melde Abweichungen sofort.",
  "Ich lagere Paletten mit dem Schubmaststapler ein und halte die Gänge frei, damit niemand ausweichen muss.",
  "Bei der Kommissionierung arbeite ich mit dem Handscanner und achte darauf, dass jede Position stimmt.",
  "Neue Kolleginnen und Kollegen begleite ich in den ersten Wochen und zeige ihnen die Abläufe am Stapler.",
  "In der Inventur zähle ich sorgfältig und gleiche die Bestände in SAP EWM mit dem Lager ab.",
  "Ladungen sichere ich nach Vorschrift, auch wenn die Zeit an der Rampe knapp wird.",
];

/** Whole sentences up to `length` characters. */
function prose(length: number, gap = " "): string {
  let text = "";
  for (let index = 0; ; index += 1) {
    const next = `${text}${text ? gap : ""}${SENTENCES[index % SENTENCES.length] ?? ""}`;
    if (next.length > length) return text;
    text = next;
  }
}

const career = (count: number, offset: number) =>
  Array.from({ length: count }, (_, index) => ({
    role: `Fachkraft für Lagerlogistik, Station ${String(index + 1 + offset)}`,
    org: `Hafenlager Nord GmbH, Halle ${String(index + 1 + offset)}`,
    years: { from: 2008 + index + offset, to: 2009 + index + offset },
    note: "Wareneingang, Einlagerung mit dem Schubmaststapler und Kommissionierung im Dreischichtbetrieb.",
  }));

const skills = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => `${prefix} ${String(index + 1)}`);

/**
 * As long as a page can be: two careers of six steps, two lists of twelve skills, four facts, an about
 * text of 1,000 characters and a letter of 2,000. The CV runs onto later pages; the letter takes the
 * fit step or a second page.
 */
export const long = (): Page => {
  const page = jonasDe();
  const blocks: Block[] = page.blocks.flatMap((block): Block[] => {
    if (block.type === "about") return [{ ...block, text: `${prose(480)}\n\n${prose(500)}`.slice(0, 1000) }];
    if (block.type === "timeline") return [{ ...block, items: career(6, 0) }, { ...block, id: "career-2", title: "Weiterbildung", items: career(6, 6) }];
    if (block.type === "tools") return [{ ...block, items: skills(12, "Lagerkenntnis") }, { ...block, id: "skills-2", title: "Software", items: skills(12, "Programm") }];
    if (block.type === "text" && block.id === "letter") {
      const body = prose(1800, "\n\n");
      return [{ ...block, text: `Sehr geehrte Frau Albers,\n\n${body}\n\nMit freundlichen Grüßen\nJonas Brandt`.slice(0, 2000) }];
    }
    return [block];
  });
  return { ...page, blocks };
};

/** A little over one page: the CV keeps to one page through the fit step. */
export const slightlyOver = (): Page => {
  const page = jonasDe();
  const blocks: Block[] = page.blocks.flatMap((block): Block[] => {
    if (block.type === "timeline") return [{ ...block, items: [...block.items, ...career(2, 0)] }];
    if (block.type === "tools") return [block, { ...block, id: "software", title: "Software", items: ["SAP EWM", "Microsoft Excel", "Staplerleitsystem"] }];
    return [block];
  });
  return { ...page, blocks };
};

/**
 * The bytes of a JPEG's head only (SOI, an Adobe APP14 when asked, a frame header, EOI): enough for
 * the layout and the PDF's structure, not a picture to look at.
 */
export function jpegHead({ width = 350, height = 450, components = 3, marker = 0xc0, adobe = false }: { width?: number; height?: number; components?: number; marker?: number; adobe?: boolean } = {}): Uint8Array {
  const app14 = adobe ? [0xff, 0xee, 0x00, 0x0e, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, 0x02] : [];
  const frame = [0xff, marker, 0x00, 8 + components * 3, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, components];
  const parts = Array.from({ length: components }, (_, index) => [index + 1, 0x11, 0x00]).flat();
  return Uint8Array.from([0xff, 0xd8, ...app14, ...frame, ...parts, 0xff, 0xd9]);
}

/** A letter with no salutation and no closing: nothing is added. */
export const bareLetter = (): Page =>
  withBlocks(
    jonasDe(),
    replace("text", (block) =>
      block.id === "letter"
        ? {
            ...block,
            text: "Seit 2017 arbeite ich in Lagern von Handel und Industrie und bringe Erfahrung mit Scanner, SAP und Stapler mit.\n\nIch kann ab dem 1. März 2027 beginnen und freue mich auf Ihre Antwort, gern auch telefonisch oder per E-Mail.\n\nIm Team bleibe ich ruhig, auch wenn am Freitagnachmittag drei Lkw gleichzeitig an der Rampe stehen.",
          }
        : block,
    ),
  );
