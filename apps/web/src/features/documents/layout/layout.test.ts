import { describe, expect, it } from "vitest";

import { bareLetter, jonasDe, long, slightlyOver, withContact, withLetter } from "../fixtures";
import { documentInput, type DocumentInput } from "../input";
import { paperLabels } from "../labels";
import { miniatureOf } from "../miniature-marks";
import { loadFonts } from "../pdf/fonts";
import { AREA_END, BASELINE, columnX, DIN, HEAD, MARGIN, mm, PHOTO, RULE, TYPE } from "../print-tokens";

import { layoutCv } from "./cv";
import { flow, paragraphUnit } from "./flow";
import { closingOf, layoutLetter } from "./letter";
import { capHeight, measure } from "./measure";
import { footer } from "./paper";
import type { Box, LaidDocument, TextRun } from "./types";
import { glue, wrap } from "./wrap";

const NOW = new Date("2026-11-26T10:00:00Z");
const NB = String.fromCharCode(0xa0);
const labels = paperLabels("de");
const { metrics } = await loadFonts();
const close = (a: number, b: number, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

const texts = (page: { boxes: Box[] }): TextRun[] => page.boxes.filter((box): box is TextRun => box.kind === "text");
const input = (page = jonasDe(), online = false): DocumentInput =>
  documentInput(page, { now: NOW, online: online ? { text: "linkyo.app/jonasbrandt", uri: "https://linkyo.app/jonasbrandt" } : null });
const cv = (page = jonasDe(), extra: { photo?: boolean; asOf?: Date | null; online?: boolean } = {}): LaidDocument =>
  layoutCv(input(page, extra.online), { metrics, labels, photo: extra.photo ?? false, asOf: extra.asOf ?? null });
const letter = (page = jonasDe(), enclosure = false): LaidDocument => layoutLetter(input(page), { metrics, labels, now: NOW, enclosure });

describe("wrap", () => {
  const body = TYPE.body;

  it("keeps every line inside its column, measured with the face's advances", () => {
    const text = "Seit 2017 arbeite ich in Lagern von Handel und Industrie: Ich nehme Ware an, lagere sie ein, kommissioniere und verlade – mit Scanner, SAP und Stapler.";
    for (const width of [mm(40), mm(60), mm(94.58), mm(122.75)]) {
      const lines = wrap(text, body, width, metrics);
      for (const line of lines) expect(measure(line, body, metrics)).toBeLessThanOrEqual(width + 1e-6);
      expect(lines.join(" ").replaceAll(NB, " ")).toBe(text);
    }
  });

  it("breaks a fixed sentence where it must", () => {
    expect(wrap("Wareneingang und Prüfung mit dem Handscanner", body, measure("Wareneingang und Prüfung", body, metrics), metrics)).toEqual([
      "Wareneingang und Prüfung",
      "mit dem Handscanner",
    ]);
  });

  it("glues what belongs together", () => {
    expect(glue("ab 1. März 2027")).toBe(`ab 1.${NB}März 2027`);
    expect(glue("40 Filialen")).toBe(`40${NB}Filialen`);
    expect(glue("Lagerist · Staplerfahrer")).toBe(`Lagerist${NB}· Staplerfahrer`);
    expect(glue("nach § 5")).toBe(`nach §${NB}5`);
    expect(glue("z. B. Kartons")).toBe(`z.${NB}B.${NB}Kartons`);
    expect(glue("2021 – 2024")).toBe(`2021${NB}–${NB}2024`);
    // A narrow column: "1. März" stays on one line.
    const lines = wrap("Verfügbar ab 1. März 2027", body, measure("Verfügbar ab 1.", body, metrics), metrics);
    expect(lines.some((line) => line.includes(`1.${NB}März`))).toBe(true);
  });

  it("never splits (m/w/d), breaks compounds only between long letter runs", () => {
    const narrow = measure("Lagerlogistik", body, metrics);
    expect(wrap("Fachkraft (m/w/d)", body, narrow, metrics)).toEqual(["Fachkraft", "(m/w/d)"]);
    expect(wrap("Weiss-Müller", body, measure("Weiss-", body, metrics), metrics)).toEqual(["Weiss-", "Müller"]);
  });

  it("breaks a word by characters only when it is wider than its column, an address after @ first", () => {
    expect(wrap("Kommissionierung", body, mm(200), metrics)).toEqual(["Kommissionierung"]);
    const email = wrap("jonas.brandt@example.com", body, measure("jonas.brandt@exam", body, metrics), metrics);
    expect(email).toEqual(["jonas.brandt@", "example.com"]);
    const word = wrap("Donaudampfschifffahrtsgesellschaft", body, mm(20), metrics);
    expect(word.length).toBeGreaterThan(1);
    for (const line of word) expect(measure(line, body, metrics)).toBeLessThanOrEqual(mm(20) + 1e-6);
    expect(word.join("")).toBe("Donaudampfschifffahrtsgesellschaft");
  });
});

describe("paragraphs across pages", () => {
  const lines = ["eins", "zwei", "drei", "vier", "fünf"];
  const unit = paragraphUnit(lines, 0, TYPE.body, metrics, 0);

  it("split with at least two lines on each side", () => {
    const four = unit.first + 3 * TYPE.body.leading;
    expect(unit.split?.(four)?.map((part) => part.boxes.length)).toEqual([3, 2]);
    const two = unit.first + TYPE.body.leading;
    expect(unit.split?.(two)?.map((part) => part.boxes.length)).toEqual([2, 3]);
    expect(unit.split?.(unit.first)).toBeNull();
    expect(paragraphUnit(lines.slice(0, 3), 0, TYPE.body, metrics, 0).split).toBeUndefined();
  });
});

describe("layoutCv", () => {
  it("sets the fictional applicant on one page, sections in order", () => {
    const doc = cv();
    expect(doc.pages).toHaveLength(1);
    expect(doc.fitted).toBe(false);
    const titles = texts(doc.pages[0] ?? { boxes: [] }).filter((run) => run.style === TYPE.section).map((run) => run.text);
    expect(titles).toEqual(["Profil", "Eckdaten", "Werdegang", "Kenntnisse"]);
  });

  it("keeps every box inside the type area and the paper's lines", () => {
    for (const page of cv(jonasDe(), { online: true, asOf: NOW }).pages) {
      for (const box of page.boxes) {
        if (box.kind === "text") {
          expect(box.x, box.text).toBeGreaterThanOrEqual(mm(25) - 0.01);
          expect(box.x + box.width, box.text).toBeLessThanOrEqual(mm(190) + 0.01);
          expect(box.y, box.text).toBeGreaterThanOrEqual(mm(20));
          expect(box.y, box.text).toBeLessThanOrEqual(mm(285) + 0.01);
        } else if (box.kind === "rect" || box.kind === "link") {
          expect(box.x).toBeGreaterThanOrEqual(mm(25) - 0.01);
          expect(box.x + box.w).toBeLessThanOrEqual(mm(190) + 0.01);
        }
      }
    }
  });

  it("starts the figures at columns 1, 4 and 7, and the contact block top right on the grid", () => {
    const runs = texts(cv().pages[0] ?? { boxes: [] });
    expect(runs.filter((run) => run.style === TYPE.figure).map((run) => run.x)).toEqual([columnX(1), columnX(4), columnX(7)]);
    expect(runs.find((run) => run.text === "seit")?.x).toBe(columnX(7));
    const contact = runs.filter((run) => run.contact);
    expect(contact.length).toBeGreaterThan(0);
    // The sample's e-mail address (38.6 mm) is a hair too wide for the last four columns' 38.3 mm:
    // the block takes column 8 too, on the grid, and every value ends inside the type area.
    for (const run of contact) {
      expect(run.x).toBe(columnX(8) + HEAD.contactLabel);
      expect(run.x + run.width).toBeLessThanOrEqual(AREA_END + 0.01);
    }
    expect(runs.find((run) => run.text === "Telefon")?.x).toBe(columnX(8));
    expect(runs.find((run) => run.text === "Telefon")?.y).toBe(HEAD.contactTop);
    // A short address keeps the last four columns.
    const short = texts(cv(withContact("mailto:jb@example.com")).pages[0] ?? { boxes: [] });
    expect(short.find((run) => run.text === "Telefon")?.x).toBe(columnX(9));
  });

  it("never breaks an e-mail address that fits on one line: one run, one link rectangle", () => {
    for (const address of ["jonas.brandt@example.com", "vorname.nachname1990@example.com", "vorname.nachname-bewerbung@lager-example.com"]) {
      const page = cv(withContact(`mailto:${address}`)).pages[0] ?? { boxes: [] };
      const runs = texts(page).filter((run) => run.contact && run.style === TYPE.contactValue);
      expect(runs.map((run) => run.text), address).toContain(address);
      for (const run of runs) expect(run.x + run.width, run.text).toBeLessThanOrEqual(AREA_END + 0.01);
      const links = page.boxes.filter((box) => box.kind === "link" && box.uri === `mailto:${address}`);
      expect(links, address).toHaveLength(1);
      const [link] = links;
      expect(link?.kind === "link" ? link.h : 0).toBeLessThan(HEAD.contactPitch);
    }
  });

  it("puts the contact rows under the rule when a long address would run into the head's words", () => {
    // 55 mm: columns 7 to 12 would hold it, but the role line reaches into column 7.
    const page = cv(withContact("mailto:vorname.nachname1990@example.com")).pages[0] ?? { boxes: [] };
    const rule = page.boxes.find((box): box is Extract<Box, { kind: "rect" }> => box.kind === "rect" && box.w === RULE.accentWidth);
    const phone = texts(page).find((run) => run.text === "Telefon");
    expect(phone?.x).toBe(MARGIN.start);
    expect(rule && phone ? phone.y > rule.y : false).toBe(true);
    // The figures follow under the rows.
    const lastRow = Math.max(...texts(page).filter((run) => run.contact).map((run) => run.y));
    const figure = texts(page).find((run) => run.style === TYPE.figure);
    expect((figure?.y ?? 0) > lastRow).toBe(true);
    // Nothing of the head overlaps: every contact value stands clear of the role's line.
    const role = texts(page).find((run) => run.style === TYPE.role);
    expect(role && phone ? phone.y > role.y : false).toBe(true);
  });

  it("prints no picture and no initials without a real photo", () => {
    const page = cv().pages[0] ?? { boxes: [] };
    expect(page.boxes.some((box) => box.kind === "image")).toBe(false);
    expect(texts(page).some((run) => run.text === "JB")).toBe(false);
  });

  it("sets an ongoing step's end in the accent", () => {
    const runs = texts(cv().pages[0] ?? { boxes: [] });
    expect(runs.find((run) => run.text === "heute")?.style.tone).toBe("accent");
    expect(runs.find((run) => run.text.startsWith("2021"))?.style.tone).toBe("ink");
  });

  it("puts a real photo top right and the contact rows under the rule", () => {
    const page = cv(jonasDe(), { photo: true }).pages[0] ?? { boxes: [] };
    const image = page.boxes.find((box) => box.kind === "image");
    expect(image).toMatchObject({ x: PHOTO.x, y: MARGIN.top, w: PHOTO.width, h: PHOTO.height });
    const rule = page.boxes.find((box) => box.kind === "rect");
    const phone = texts(page).find((run) => run.contact);
    expect(phone?.x).toBe(MARGIN.start + HEAD.contactLabel);
    expect(phone && rule ? phone.y > rule.y : false).toBe(true);
  });

  it("prints Stand only with the last save, and Online only on a public page", () => {
    const plain = texts(cv().pages[0] ?? { boxes: [] }).map((run) => run.text);
    expect(plain.some((text) => text.startsWith("Stand"))).toBe(false);
    expect(plain.some((text) => text.includes("linkyo.app"))).toBe(false);
    const full = texts(cv(jonasDe(), { asOf: new Date("2026-11-20T09:00:00Z"), online: true }).pages[0] ?? { boxes: [] }).map((run) => run.text);
    expect(full).toContain(`Stand 20. November 2026${NB}· linkyo.app/jonasbrandt`);
    expect(full).toContain("linkyo.app/jonasbrandt");
  });

  it("stays on one page through the fit step when it is a little too long", () => {
    const doc = cv(slightlyOver());
    expect(doc.pages).toHaveLength(1);
    expect(doc.fitted).toBe(true);
  });

  it("runs a long CV onto later pages: running head, the title repeated, no entry split", () => {
    const doc = cv(long());
    expect(doc.pages.length).toBeGreaterThanOrEqual(2);
    doc.pages.slice(1).forEach((page, index) => {
      const runs = texts(page);
      expect(runs[0]?.text).toBe(`Jonas Brandt${NB}· Lebenslauf`);
      expect(close(runs[0]?.y ?? 0, BASELINE.runningHead + capHeight(TYPE.footer, metrics))).toBe(true);
      expect(runs.some((run) => run.style === TYPE.section), `page ${String(index + 2)} has a title`).toBe(true);
      expect(runs.at(-1)?.text).toContain(`Seite ${String(index + 2)} von ${String(doc.pages.length)}`);
    });
    // Each career entry keeps its years, role, organisation and note on one page.
    for (const page of doc.pages) {
      const runs = texts(page);
      const roles = runs.filter((run) => run.style === TYPE.entryTitle).length;
      const years = runs.filter((run) => run.style.face === TYPE.years.face && run.style.size === TYPE.years.size && run.x === columnX(4)).length;
      expect(roles).toBe(years);
    }
    // Nothing below the last line a page holds.
    for (const page of doc.pages) for (const run of texts(page)) if (run.style !== TYPE.footer) expect(run.y).toBeLessThanOrEqual(BASELINE.limit + 0.01);
  });
});

describe("the footer", () => {
  it("moves the end to a line of its own before a long name and address meet", () => {
    const name = "Maximilian Alexander Schmidt-Hohenberg von Lüdenscheidt-Neu";
    expect(name.length).toBeGreaterThanOrEqual(58);
    const boxes = footer({
      start: `${name}${NB}· Lebenslauf`,
      end: [{ text: "Stand 20. November 2026" }, { text: "linkyo.app/maximilianschmidthohenb", uri: "https://linkyo.app/maximilianschmidthohenb" }, { text: "Seite 1 von 2" }],
      metrics,
    });
    const [start, end] = texts({ boxes });
    expect(start && end).toBeTruthy();
    if (!start || !end) return;
    // On different lines, both on or above the footer's baseline, the end right-aligned.
    expect(start.y).toBeLessThan(end.y);
    expect(end.y).toBe(BASELINE.footer);
    expect(end.x + end.width).toBeCloseTo(AREA_END, 5);
    for (const run of [start, end]) expect(run.x).toBeGreaterThanOrEqual(MARGIN.start - 0.01);
  });

  it("keeps one line while the two parts stand apart", () => {
    const boxes = footer({ start: `Jonas Brandt${NB}· Lebenslauf`, end: [{ text: "Seite 1 von 2" }], metrics });
    const [start, end] = texts({ boxes });
    expect(start?.y).toBe(BASELINE.footer);
    expect(end?.y).toBe(BASELINE.footer);
  });
});

describe("the flow", () => {
  it("splits a paragraph taller than the rest of the first page instead of running past the limit", () => {
    const lines = Array.from({ length: 80 }, (_, index) => `Zeile ${String(index + 1)}`);
    const unit = paragraphUnit(lines, MARGIN.start, TYPE.letterBody, metrics, 0);
    const result = flow([{ title: null, titleDepth: 0, units: [unit] }], { start: mm(120), restart: mm(35), limit: BASELINE.limit, sectionGap: 0 });
    expect(result.pages.length).toBeGreaterThanOrEqual(2);
    for (const page of result.pages) for (const run of texts({ boxes: page })) expect(run.y).toBeLessThanOrEqual(BASELINE.limit + 0.01);
    expect(result.pages.flat().filter((box) => box.kind === "text")).toHaveLength(80);
  });

  it("puts a section's title before its first row (reading order)", () => {
    const doc = cv();
    const runs = texts(doc.pages[0] ?? { boxes: [] });
    const at = (match: (run: TextRun) => boolean) => runs.findIndex(match);
    expect(at((run) => run.text === "Profil")).toBeLessThan(at((run) => run.style === TYPE.body));
    expect(at((run) => run.text === "Werdegang")).toBeLessThan(at((run) => run.text.startsWith("2021")));
  });
});

describe("layoutLetter", () => {
  const page = letter().pages[0] ?? { boxes: [] };
  const runs = texts(page);

  it("keeps the address field free", () => {
    const field = { x0: mm(20), y0: mm(45), x1: mm(105), y1: mm(90) };
    for (const box of page.boxes) {
      const [x, y, w, h] = box.kind === "text" ? [box.x, box.y - box.style.size, box.width, box.style.size] : box.kind === "line" ? [box.x1, box.y1, box.x2 - box.x1, 0] : [box.x, box.y, box.w, box.h];
      const inside = x < field.x1 && x + w > field.x0 && y < field.y1 && y + h > field.y0;
      expect(inside, box.kind === "text" ? box.text : box.kind).toBe(false);
    }
  });

  it("sets the information block at 125 mm from 50 mm, dated with the request's day", () => {
    const labelsAt = runs.filter((run) => ["Wohnort", "Telefon", "E-Mail", "Datum"].includes(run.text));
    expect(labelsAt.map((run) => run.x)).toEqual([DIN.info.x, DIN.info.x, DIN.info.x, DIN.info.x]);
    expect((labelsAt[0]?.y ?? 0) - capHeight(TYPE.info, metrics)).toBeGreaterThanOrEqual(DIN.info.top - 0.01);
    expect(runs.find((run) => run.x === DIN.info.x + DIN.info.label && run.text.endsWith("2026"))?.text.replaceAll(NB, " ")).toBe("26. November 2026");
  });

  it("puts the subject's cap height at 98.46 mm, in the template's words with the position", () => {
    const subject = runs.find((run) => run.style === TYPE.letterSubject);
    expect(subject?.text).toBe("Bewerbung als Fachkraft für Lagerlogistik (m/w/d)");
    expect(Math.abs((subject?.y ?? 0) - capHeight(TYPE.letterSubject, metrics) - mm(98.46))).toBeLessThan(mm(0.1));
  });

  it("draws the fold and punch marks on the first page only", () => {
    const marks = page.boxes.filter((box) => box.kind === "line").map((box) => box.y1);
    expect(marks.map((y) => Math.round((y / mm(1)) * 10) / 10)).toEqual([105, 210, 148.5]);
    for (const later of letter(long()).pages.slice(1)) expect(later.boxes.some((box) => box.kind === "line")).toBe(false);
  });

  it("adds no salutation and no closing", () => {
    const bare = texts(letter(bareLetter()).pages[0] ?? { boxes: [] }).filter((run) => run.style === TYPE.letterBody);
    expect(bare[0]?.text.startsWith("Seit 2017")).toBe(true);
    expect(bare.some((run) => run.text === "Jonas Brandt" || run.text.startsWith("Mit freundlichen"))).toBe(false);
  });

  it("leaves the signature space between the closing and the name", () => {
    const body = runs.filter((run) => run.style === TYPE.letterBody);
    const greeting = body.find((run) => run.text === "Mit freundlichen Grüßen");
    const name = body.find((run) => run.text === "Jonas Brandt");
    expect(close((name?.y ?? 0) - (greeting?.y ?? 0), DIN.signature + TYPE.letterBody.leading)).toBe(true);
    expect(closingOf(["Sehr geehrte Frau Albers,", "Text.", "Mit freundlichen Grüßen"], "Jonas Brandt")?.signer).toEqual(["Jonas Brandt"]);
    expect(closingOf(["Text.", "Mit freundlichen Grüßen", "Jonas Brandt"], "Jonas Brandt")).toEqual({ body: ["Text."], greeting: ["Mit freundlichen Grüßen"], signer: ["Jonas Brandt"] });
    expect(closingOf(["Text.", "Noch mehr Text."], "Jonas Brandt")).toBeNull();
  });

  it("finds the closing only as a line of its own, from the end: a sentence with 'sincerely' or 'beste Grüße' is body text", () => {
    const paragraphs = [
      "Sehr geehrte Frau Albers,",
      "ich schreibe Ihnen sincerely und mit besten Grüßen an das Team.\nIch sende beste Grüße an die Halle 3, wo ich gelernt habe.\nMit freundlichen Grüßen\nJonas Brandt",
    ];
    expect(closingOf(paragraphs, "Jonas Brandt")).toEqual({
      body: ["Sehr geehrte Frau Albers,", "ich schreibe Ihnen sincerely und mit besten Grüßen an das Team.\nIch sende beste Grüße an die Halle 3, wo ich gelernt habe."],
      greeting: ["Mit freundlichen Grüßen"],
      signer: ["Jonas Brandt"],
    });
    expect(closingOf(["Dear Ms Albers,", "I am sincerely writing to apply.\nKind regards,\nJonas Brandt"], "Jonas Brandt")?.greeting).toEqual(["Kind regards,"]);
    // A closing word in a sentence alone is no closing: nothing gets a signature space.
    expect(closingOf(["Dear Ms Albers,", "I am sincerely writing to apply and send best regards to the team."], "Jonas Brandt")).toBeNull();
  });

  it("wraps and paginates letters typed with single line breaks or a long last paragraph: nothing past the edge or the limit", () => {
    const sentence = "Über eine Einladung zu einem persönlichen Gespräch freue ich mich sehr und stehe Ihnen jederzeit gern für Rückfragen zur Verfügung, auch kurzfristig.";
    expect(sentence.length).toBeGreaterThan(120);
    const sample = jonasDe().blocks.find((block) => block.type === "text" && block.id === "letter");
    const text = sample?.type === "text" ? sample.text : "";
    const letters = [
      // (a) the sample letter with its blank lines turned into single line breaks
      text.replace(/\n{2,}/gu, "\n"),
      // (b) a last paragraph with a long sentence, then the closing after a single line break
      text.replace("\n\nMit freundlichen Grüßen", `\n\n${sentence}\nMit freundlichen Grüßen`),
    ];
    expect(letters[1]).toContain(`${sentence}\nMit freundlichen Grüßen\nJonas Brandt`);
    for (const letterText of letters) {
      const doc = letter(withLetter(letterText));
      for (const page of doc.pages) {
        for (const run of texts(page)) {
          expect(run.x + run.width, run.text).toBeLessThanOrEqual(mm(190) + 0.01);
          if (run.style.size === TYPE.letterBody.size || run.style.size === TYPE.letterBodyMin.size) expect(run.y, run.text).toBeLessThanOrEqual(BASELINE.limit + 0.01);
        }
      }
      const runs = doc.pages.flatMap((page) => texts(page));
      expect(runs.some((run) => run.text.startsWith("Über eine Einladung") || run.text.startsWith("mit großem Interesse"))).toBe(true);
      const greeting = runs.find((run) => run.text === "Mit freundlichen Grüßen");
      const name = runs.findLast((run) => run.text === "Jonas Brandt" && run.style.size !== TYPE.letterName.size);
      expect(greeting && name ? close(name.y - greeting.y, DIN.signature + greeting.style.leading) : false, letterText.slice(0, 40)).toBe(true);
    }
  });

  it("keeps every generated letter on the paper: single and double line breaks, 2,000 characters, long words", () => {
    const words = ["Lager", "Kommissionierung", "Wareneingangskontrolle", "Schubmaststapler", "und", "die", "Donaudampfschifffahrtsgesellschaftskapitän", "SAP", "Bremen"];
    let seed = 7;
    const next = () => {
      seed = (seed * 48271) % 2147483647;
      return seed;
    };
    for (let round = 0; round < 12; round += 1) {
      let body = "";
      while (body.length < 1990) {
        const word = words[next() % words.length] ?? "Lager";
        const gap = next() % 9 === 0 ? (round % 2 === 0 ? "\n" : "\n\n") : " ";
        body += `${word}${gap}`;
      }
      const closing = round % 3 === 0 ? "" : `${round % 2 === 0 ? "\n" : "\n\n"}Mit freundlichen Grüßen\nJonas Brandt`;
      const doc = letter(withLetter(`Sehr geehrte Frau Albers,\n\n${body.slice(0, 1990).trim()}${closing}`), round % 2 === 0);
      expect(doc.pages.flatMap((page) => texts(page)).filter((run) => run.style.size === TYPE.letterBody.size || run.style.size === TYPE.letterBodyMin.size).length).toBeGreaterThan(20);
      for (const page of doc.pages) {
        for (const box of page.boxes) {
          if (box.kind !== "text") continue;
          expect(box.x, box.text).toBeGreaterThanOrEqual(mm(25) - 0.01);
          expect(box.x + box.width, box.text).toBeLessThanOrEqual(mm(190) + 0.01);
          expect(box.y, box.text).toBeLessThanOrEqual(mm(285) + 0.01);
        }
      }
      for (const mark of miniatureOf(doc)) {
        expect(mark.x + mark.w).toBeLessThanOrEqual(210);
        expect(mark.y + mark.h).toBeLessThanOrEqual(297);
      }
    }
  });

  it("keeps a contact value on one line in the information block, stepping its size down to fit", () => {
    const page = letter(withContact("mailto:vorname.nachname1990@example.com")).pages[0] ?? { boxes: [] };
    const value = texts(page).find((run) => run.contact && run.text.includes("@"));
    expect(value?.text).toBe("vorname.nachname1990@example.com");
    expect(value ? value.x + value.width : Infinity).toBeLessThanOrEqual(DIN.info.x + DIN.info.w + 0.01);
    expect(value?.style.size).toBeGreaterThanOrEqual(TYPE.infoMin.size);
    expect(value?.style.size).toBeLessThan(TYPE.info.size);
    // The sample's own address keeps the block's size.
    expect(runs.find((run) => run.contact && run.text.includes("@"))?.style.size).toBe(TYPE.info.size);
  });

  it("names the CV as its enclosure only where the CV follows", () => {
    expect(runs.some((run) => run.text === "Anlage")).toBe(false);
    const combined = texts(letter(jonasDe(), true).pages[0] ?? { boxes: [] });
    expect(combined.filter((run) => run.style.size === TYPE.enclosure.size).map((run) => run.text)).toEqual(["Anlage", "Lebenslauf"]);
  });

  it("takes the fit step or a second page for a long letter, with a running head", () => {
    const doc = letter(long());
    expect(doc.fitted || doc.pages.length > 1).toBe(true);
    if (doc.pages.length > 1) expect(texts(doc.pages[1] ?? { boxes: [] })[0]?.text).toBe(`Jonas Brandt${NB}· Anschreiben`);
  });
});
