import { createHash } from "node:crypto";

import type { Page } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { renderDocument, type DocumentOptions } from "../build";
import { jonasDe, jpegHead } from "../fixtures";
import { FIRST_CODE, LAST_CODE } from "../font/winansi";
import { paperLabels } from "../labels";

import { decoded, pageTexts, readPdf } from "./inspect";
import { colourSpace, parseJpeg, type Jpeg } from "./jpeg";
import { literal, num, textString } from "./writer";

const NOW = new Date("2026-11-26T10:00:00Z");
const AS_OF = new Date("2026-11-20T09:00:00Z");
const NB = String.fromCharCode(0xa0);
const THEME = { template: "laufbahn" } as const;
const ONLINE = { text: "linkyo.app/jonasbrandt", uri: "https://linkyo.app/jonasbrandt" };

const render = (kind: "cv" | "letter" | "application", page: Page = jonasDe(), options: Partial<DocumentOptions & { photo: Jpeg | null }> = {}) =>
  renderDocument(kind, page, THEME, { now: NOW, asOf: AS_OF, online: null, photo: null, ...options });
const latin1 = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("the writer's pieces", () => {
  it("writes numbers and strings as PDF reads them", () => {
    expect([num(0), num(-0.0001), num(12.5), num(595.2755905), num(1 / 3)]).toEqual(["0", "0", "12.5", "595.276", "0.333"]);
    expect(literal([0x28, 0x41, 0x29, 0x5c, 0xe4])).toBe("(\\(A\\)\\\\\\344)");
    expect(textString("Lebenslauf – Jonas Brandt")).toBe("(Lebenslauf \\205 Jonas Brandt)");
    // Ł is PDFDocEncoding's 0x95; Arabic needs UTF-16BE with its byte order mark.
    expect(textString("Łukasz")).toBe("(\\225ukasz)");
    expect(textString("كريم")).toBe("<FEFF06430631064A0645>");
  });
});

describe("the PDF file", async () => {
  const cv = await render("cv", jonasDe(), { online: ONLINE });
  const letter = await render("letter");
  const application = await render("application");

  it("is PDF 1.7 with a binary comment, a valid cross-reference table and trailer", () => {
    for (const bytes of [cv, letter, application]) {
      const text = latin1(bytes);
      expect(text.startsWith("%PDF-1.7\n%")).toBe(true);
      expect(Array.from(bytes.slice(10, 14)).every((byte) => byte >= 0x80)).toBe(true);
      expect(text.endsWith("%%EOF\n")).toBe(true);
      const pdf = readPdf(bytes);
      expect(pdf.objects.size).toBe(pdf.size - 1);
      expect(pdf.trailer).toMatch(new RegExp(`/Size ${String(pdf.size)} /Root 1 0 R /Info 3 0 R /ID \\[<[0-9A-F]{32}> <[0-9A-F]{32}>\\]`, "u"));
      expect(bytes.length).toBeLessThanOrEqual(250 * 1024);
    }
  });

  it("names its language, title, author and maker, without dates", () => {
    const pdf = readPdf(cv);
    expect(pdf.objects.get(1)?.dictionary).toBe("<< /Type /Catalog /Pages 2 0 R /Lang (de-DE) /ViewerPreferences << /DisplayDocTitle true >> >>");
    const info = pdf.objects.get(3)?.dictionary ?? "";
    expect(info).toBe("<< /Title (Lebenslauf \\205 Jonas Brandt) /Author (Jonas Brandt) /Creator (Linkyo) /Producer (Linkyo) >>");
    expect(latin1(cv)).not.toContain("/CreationDate");
    expect(latin1(cv)).not.toContain("/ModDate");
  });

  it("embeds Geist as three TrueType fonts with WinAnsi, widths for every code and a ToUnicode map", () => {
    const pdf = readPdf(cv);
    const fonts = [...pdf.objects.values()].filter((object) => object.dictionary.includes("/Type /Font "));
    expect(fonts.map((font) => /\/BaseFont \/(\S+)/u.exec(font.dictionary)?.[1])).toEqual(["Geist-Regular", "Geist-SemiBold", "Geist-Bold"]);
    for (const font of fonts) {
      expect(font.dictionary).toContain("/Subtype /TrueType");
      expect(font.dictionary).toContain("/Encoding /WinAnsiEncoding");
      expect(font.dictionary).toContain(`/FirstChar ${String(FIRST_CODE)} /LastChar ${String(LAST_CODE)}`);
      const widths = /\/Widths \[([^\]]*)\]/u.exec(font.dictionary)?.[1]?.split(" ") ?? [];
      expect(widths).toHaveLength(224);
      const descriptor = pdf.objects.get(Number(/\/FontDescriptor (\d+)/u.exec(font.dictionary)?.[1]));
      expect(descriptor?.dictionary).toMatch(/\/Flags 32 .*\/CapHeight \d+ .*\/FontFile2 \d+ 0 R/u);
      const program = pdf.objects.get(Number(/\/FontFile2 (\d+)/u.exec(descriptor?.dictionary ?? "")?.[1]));
      expect(program?.dictionary).toMatch(/\/Length1 \d{6} \/Filter \/FlateDecode/u);
      const cmap = decoded(pdf.objects.get(Number(/\/ToUnicode (\d+)/u.exec(font.dictionary)?.[1])) ?? { offset: 0, dictionary: "", stream: null });
      for (const pair of ["<80> <20AC>", "<84> <201E>", "<93> <201C>", "<94> <201D>", "<96> <2013>", "<A0> <00A0>", "<DF> <00DF>"]) expect(cmap).toContain(pair);
    }
  });

  it("links the phone number, the e-mail address and the public address", () => {
    const annots = [...readPdf(cv).objects.values()].filter((object) => object.dictionary.includes("/Subtype /Link"));
    const uris = annots.map((object) => /\/URI \(([^)]*)\)/u.exec(object.dictionary)?.[1]);
    expect(uris).toEqual(expect.arrayContaining(["tel:+493023125457", "mailto:jonas.brandt@example.com", "https://linkyo.app/jonasbrandt"]));
    for (const annot of annots) expect(annot.dictionary).toContain("/Border [0 0 0]");
  });

  it("gives the combined file outline entries and opens with them", () => {
    const pdf = readPdf(application);
    expect(pdf.objects.get(1)?.dictionary).toContain("/PageMode /UseOutlines");
    const titles = [...pdf.objects.values()].flatMap((object) => (/\/Title \((Anschreiben|Lebenslauf)\) \/Parent/u.exec(object.dictionary)?.[1] ?? []));
    expect(titles).toEqual(["Anschreiben", "Lebenslauf"]);
    expect(pageTexts(application)).toHaveLength(2);
  });

  it("is the same, byte for byte, for the same page and time", async () => {
    expect(sha(await render("cv", jonasDe(), { online: ONLINE }))).toBe(sha(cv));
    expect(sha(await render("application"))).toBe(sha(application));
  });

  it("matches the stored bytes (Node 22's zlib, geist 1.9.2)", async () => {
    expect({ cv: sha(await render("cv")), letter: sha(letter), application: sha(application) }).toMatchSnapshot();
  });

  it("keeps its drawing in a reviewable snapshot", () => {
    const pdf = readPdf(letter);
    const page = [...pdf.objects.values()].find((object) => object.dictionary.startsWith("<< /Type /Page "));
    const contents = pdf.objects.get(Number(/\/Contents (\d+)/u.exec(page?.dictionary ?? "")?.[1]));
    expect(contents ? decoded(contents) : "").toMatchSnapshot();
  });

  it("changes only the letter's date when the day moves", async () => {
    const next = pageTexts(await render("letter", jonasDe(), { now: new Date("2026-11-27T10:00:00Z") }))[0] ?? [];
    const today = pageTexts(letter)[0] ?? [];
    expect(next).toHaveLength(today.length);
    const changed = today.flatMap((text, index) => (text === next[index] ? [] : [[text, next[index]]]));
    expect(changed.map((pair) => pair.map((text) => text?.replaceAll(NB, " ")))).toEqual([["26. November 2026", "27. November 2026"]]);
  });
});

describe("text that comes back out", () => {
  it("round-trips the typographer's characters", async () => {
    const page = jonasDe();
    const text = "Größe – „Ware“ 5 € ß Œuvre";
    const odd = { ...page, blocks: page.blocks.map((block) => (block.type === "about" ? { ...block, text } : block)) };
    const runs = pageTexts(await render("cv", odd)).flat();
    expect(runs).toContain(text);
  });

  it("reads in order: head, contact, figures, sections, footer; letterhead, information, subject, body", async () => {
    const cv = pageTexts(await render("cv", jonasDe(), { online: ONLINE }))[0] ?? [];
    const at = (text: string) => cv.findIndex((run) => run.replaceAll(NB, " ") === text);
    const order = ["Jonas Brandt", "Fachkraft für Lagerlogistik · Staplerfahrer", "Verfügbar ab 1. März 2027", "Telefon", "9", "Profil", "Eckdaten", "Werdegang", "Kenntnisse", "Jonas Brandt · Lebenslauf"].map(at);
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const letter = pageTexts(await render("letter"))[0] ?? [];
    const find = (text: string) => letter.findIndex((run) => run.replaceAll(NB, " ") === text);
    const steps = ["Jonas Brandt", "Wohnort", "Datum", "Bewerbung als Fachkraft für Lagerlogistik (m/w/d)", "Sehr geehrte Frau Albers,", "Mit freundlichen Grüßen", "Jonas Brandt · Anschreiben"].map(find);
    expect(steps.every((index) => index >= 0)).toBe(true);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });

  it("prints nothing the page does not hold (template words, dates, page numbers aside)", async () => {
    const page = jonasDe();
    const labels = paperLabels("de");
    const strings: string[] = [];
    const walk = (value: unknown) => {
      if (typeof value === "string") strings.push(value.startsWith("tel:") || value.startsWith("mailto:") ? decodeURIComponent(value.replace(/^\w+:/u, "")) : value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(page);
    const words = [labels.profile, labels.facts, labels.career, labels.skills, labels.present, labels.phone, labels.email, labels.online, labels.location, labels.date, labels.enclosure, labels.enclosureCv, ...Object.values(labels.documents)];
    const corpus = [...strings, ...words, labels.subjectFor("Fachkraft für Lagerlogistik (m/w/d)"), labels.longDate(NOW), labels.asOf(labels.longDate(AS_OF))].map((text) => text.replaceAll(NB, " "));
    const runs = [...pageTexts(await render("cv")).flat(), ...pageTexts(await render("letter")).flat()].map((run) => run.replaceAll(NB, " "));
    for (const run of runs) {
      const known = corpus.some((text) => text.includes(run)) || /^\d{4}( – )?$/u.test(run) || run === `${page.profile.displayName} · Lebenslauf` || run === `${page.profile.displayName} · Anschreiben`;
      expect(known, run).toBe(true);
    }
  });
});

describe("JPEG", () => {
  it("reads a baseline and a progressive frame header", () => {
    expect(parseJpeg(jpegHead({ width: 350, height: 450 }))).toMatchObject({ width: 350, height: 450, components: 3, adobe: false });
    expect(parseJpeg(jpegHead({ width: 1200, height: 1600, marker: 0xc2, components: 1 }))).toMatchObject({ width: 1200, height: 1600, components: 1 });
  });

  it("refuses a PNG and an arithmetic-coded JPEG", () => {
    expect(parseJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
    expect(parseJpeg(jpegHead({ marker: 0xc9 }))).toBeNull();
  });

  it("decodes Adobe CMYK inverted", () => {
    const cmyk = parseJpeg(jpegHead({ components: 4, adobe: true }));
    expect(cmyk && colourSpace(cmyk)).toBe("/ColorSpace /DeviceCMYK /Decode [1 0 1 0 1 0 1 0]");
  });

  it("embeds a real photo as a DCT image at 35 x 45 mm", async () => {
    const photo = parseJpeg(jpegHead());
    const pdf = readPdf(await render("cv", jonasDe(), { photo }));
    const image = [...pdf.objects.values()].find((object) => object.dictionary.includes("/Subtype /Image"));
    expect(image?.dictionary).toContain("/Width 350 /Height 450 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode");
    expect(image?.dictionary).not.toContain("FlateDecode");
  });
});
