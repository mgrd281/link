import type { TrueTypeFont } from "../font/ttf";
import { FIRST_CODE, LAST_CODE, unicodeOf } from "../font/winansi";
import { codeOf, type Metrics } from "../layout/measure";
import type { Box, Face, LaidDocument, TextRun, Tone } from "../layout/types";
import { PAGE } from "../print-tokens";

import { colourSpace, type Jpeg } from "./jpeg";
import { ascii, literal, name, num, PdfFile, textString } from "./writer";

/**
 * Laid-out documents as one PDF: real text in reading order (selectable, searchable, read aloud),
 * set in Geist embedded whole as TrueType with WinAnsiEncoding and a ToUnicode map, vector rules and
 * squares, link annotations for phone, e-mail and web addresses, an optional JPEG portrait, and
 * outline entries when several documents share the file. Colours are the page's light palette.
 */

/** Paper tones as hex colours from the page's light palette (creator-fg, fg-muted, accent-text, line-strong). */
export type Palette = Record<Tone, string>;

export interface RenderInput {
  documents: readonly { document: LaidDocument; outline: string }[];
  title: string;
  author: string;
  /** "de-DE" or "en-GB". */
  lang: string;
  /** Outline entries for each document, and the viewer opens with them (the combined file). */
  outlines: boolean;
  palette: Palette;
  fonts: Record<Face, TrueTypeFont>;
  metrics: Metrics;
  photo: Jpeg | null;
}

const FACES: readonly Face[] = ["regular", "semibold", "bold"];
const RESOURCE: Record<Face, string> = { regular: "/F1", semibold: "/F2", bold: "/F3" };
/** The font descriptor's flags: a non-symbolic font (its characters are in the standard Latin set). */
const NONSYMBOLIC = 32;

function rgb(hex: string): [number, number, number] {
  const value = /^#?([0-9a-f]{6})$/iu.exec(hex.trim())?.[1] ?? "000000";
  return [0, 2, 4].map((at) => Number.parseInt(value.slice(at, at + 2), 16) / 255) as [number, number, number];
}

const colour = (hex: string, operator: "rg" | "RG"): string => `${rgb(hex).map(num).join(" ")} ${operator}`;

/** A text's bytes in WinAnsi (a no-break space is drawn as a space). */
const bytesOf = (text: string): number[] => Array.from(text, codeOf);

/** A run's show operator: its WinAnsi bytes as one string. */
const show = (run: TextRun): string => `${literal(bytesOf(run.text))} Tj`;

/** A page's content stream: text, rectangles, rules and the photo, in the order the layout gives (reading order). */
function content(boxes: readonly Box[], input: RenderInput, image: string | null): string {
  const ops: string[] = [];
  const flip = (y: number) => PAGE.height - y;
  for (const box of boxes) {
    switch (box.kind) {
      case "text": {
        if (box.text === "") break;
        const { style } = box;
        ops.push(
          `BT ${RESOURCE[style.face]} ${num(style.size)} Tf ${num(style.tracking * style.size)} Tc ${colour(input.palette[style.tone], "rg")} 1 0 0 1 ${num(box.x)} ${num(flip(box.y))} Tm ${show(box)} ET`,
        );
        break;
      }
      case "rect":
        ops.push(`${colour(input.palette[box.tone], "rg")} ${num(box.x)} ${num(flip(box.y + box.h))} ${num(box.w)} ${num(box.h)} re f`);
        break;
      case "line":
        ops.push(`${colour(input.palette[box.tone], "RG")} ${num(box.weight)} w ${num(box.x1)} ${num(flip(box.y1))} m ${num(box.x2)} ${num(flip(box.y2))} l S`);
        break;
      case "image":
        if (image) ops.push(`q ${num(box.w)} 0 0 ${num(box.h)} ${num(box.x)} ${num(flip(box.y + box.h))} cm ${image} Do Q`);
        break;
      default:
        break;
    }
  }
  return ops.join("\n");
}

/** Every drawn WinAnsi code mapped to its Unicode character, for copying, searching and reading aloud. */
function toUnicode(): string {
  const entries: string[] = [];
  for (let code = FIRST_CODE; code <= LAST_CODE; code += 1) {
    const unicode = unicodeOf(code);
    if (unicode !== null) entries.push(`<${code.toString(16).toUpperCase().padStart(2, "0")}> <${unicode.toString(16).toUpperCase().padStart(4, "0")}>`);
  }
  const blocks: string[] = [];
  for (let at = 0; at < entries.length; at += 100) {
    const chunk = entries.slice(at, at + 100);
    blocks.push(`${String(chunk.length)} beginbfchar\n${chunk.join("\n")}\nendbfchar`);
  }
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<00> <FF>",
    "endcodespacerange",
    ...blocks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

/** A stem width that follows the face's weight (the descriptor needs one; viewers use it only when they substitute). */
const stemV = (weight: number): number => Math.round(10 + 220 * ((weight - 50) / 900) ** 2);

const LATIN = (text: string): Uint8Array => Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);

/** URIs are written as 7-bit ASCII: anything else percent-encoded. */
const uriOf = (uri: string): string => uri.replace(/[^ -~]/gu, (char) => encodeURIComponent(char)).replace(/ /gu, "%20");

export function renderPdf(input: RenderInput): Uint8Array {
  const file = new PdfFile();
  const catalog = file.reserve();
  const pagesRoot = file.reserve();
  const info = file.reserve();
  const fontRefs = FACES.map((face) => ({ face, font: file.reserve(), descriptor: file.reserve(), program: file.reserve(), unicode: file.reserve() }));
  const pages = input.documents.flatMap(({ document }) => document.pages);
  const wantsImage = input.photo !== null && pages.some((page) => page.boxes.some((box) => box.kind === "image"));
  const imageRef = wantsImage ? file.reserve() : null;
  const pageRefs = pages.map((page) => ({
    page: file.reserve(),
    contents: file.reserve(),
    links: page.boxes.filter((box) => box.kind === "link").map((box) => ({ box, ref: file.reserve() })),
  }));
  const outlineRoot = input.outlines ? file.reserve() : null;
  const outlineItems = outlineRoot === null ? [] : input.documents.map(() => file.reserve());

  // Catalog, page tree and document information.
  const outlines = outlineRoot === null ? "" : ` /Outlines ${String(outlineRoot)} 0 R /PageMode /UseOutlines`;
  file.set(catalog, `<< /Type /Catalog /Pages ${String(pagesRoot)} 0 R /Lang ${ascii(input.lang)} /ViewerPreferences << /DisplayDocTitle true >>${outlines} >>`);
  file.set(pagesRoot, `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${String(ref.page)} 0 R`).join(" ")}] /Count ${String(pageRefs.length)} >>`);
  file.set(info, `<< /Title ${textString(input.title)} /Author ${textString(input.author)} /Creator (Linkyo) /Producer (Linkyo) >>`);

  // Fonts: the whole TrueType program, its widths per WinAnsi code and a ToUnicode map.
  const cmap = LATIN(toUnicode());
  for (const ref of fontRefs) {
    const font = input.fonts[ref.face];
    const metrics = input.metrics[ref.face];
    const scale = (value: number) => Math.round((value * 1000) / font.unitsPerEm);
    const widths = metrics.widths.slice(FIRST_CODE, LAST_CODE + 1).map((width) => String(width));
    const base = name(font.postScriptName);
    file.set(
      ref.font,
      `<< /Type /Font /Subtype /TrueType /BaseFont ${base} /FirstChar ${String(FIRST_CODE)} /LastChar ${String(LAST_CODE)} /Widths [${widths.join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor ${String(ref.descriptor)} 0 R /ToUnicode ${String(ref.unicode)} 0 R >>`,
    );
    file.set(
      ref.descriptor,
      `<< /Type /FontDescriptor /FontName ${base} /Flags ${String(NONSYMBOLIC)} /FontBBox [${font.bbox.map(scale).join(" ")}] /ItalicAngle ${num(font.italicAngle)} /Ascent ${String(scale(font.ascender))} /Descent ${String(scale(font.descender))} /CapHeight ${String(scale(font.capHeight))} /StemV ${String(stemV(font.weightClass))} /FontFile2 ${String(ref.program)} 0 R >>`,
    );
    file.stream(ref.program, `/Length1 ${String(font.bytes.length)}`, font.bytes);
    file.stream(ref.unicode, "", cmap);
  }

  const photo = input.photo;
  if (imageRef !== null && photo) {
    file.stream(
      imageRef,
      `/Type /XObject /Subtype /Image /Width ${String(photo.width)} /Height ${String(photo.height)} ${colourSpace(photo)} /BitsPerComponent 8 /Filter /DCTDecode`,
      photo.bytes,
      { compress: false },
    );
  }

  const fontResources = fontRefs.map((ref) => `${RESOURCE[ref.face]} ${String(ref.font)} 0 R`).join(" ");
  const xobject = imageRef === null ? "" : ` /XObject << /Im1 ${String(imageRef)} 0 R >>`;
  pages.forEach((page, index) => {
    const ref = pageRefs[index];
    if (!ref) return;
    const annots = ref.links.length > 0 ? ` /Annots [${ref.links.map((link) => `${String(link.ref)} 0 R`).join(" ")}]` : "";
    file.set(
      ref.page,
      `<< /Type /Page /Parent ${String(pagesRoot)} 0 R /MediaBox [0 0 ${num(PAGE.width)} ${num(PAGE.height)}] /Resources << /Font << ${fontResources} >>${xobject} >> /Contents ${String(ref.contents)} 0 R${annots} >>`,
    );
    file.stream(ref.contents, "", LATIN(content(page.boxes, input, imageRef === null ? null : "/Im1")));
    for (const { box, ref: annot } of ref.links) {
      const rect = [box.x, PAGE.height - box.y - box.h, box.x + box.w, PAGE.height - box.y].map(num).join(" ");
      file.set(annot, `<< /Type /Annot /Subtype /Link /Rect [${rect}] /Border [0 0 0] /A << /S /URI /URI ${ascii(uriOf(box.uri))} >> >>`);
    }
  });

  // Outline entries: each document's first page.
  if (outlineRoot !== null) {
    let first = 0;
    const starts = input.documents.map(({ document }) => {
      const at = first;
      first += document.pages.length;
      return at;
    });
    file.set(outlineRoot, `<< /Type /Outlines /First ${String(outlineItems[0] ?? 0)} 0 R /Last ${String(outlineItems.at(-1) ?? 0)} 0 R /Count ${String(outlineItems.length)} >>`);
    input.documents.forEach(({ outline }, index) => {
      const item = outlineItems[index];
      const page = pageRefs[starts[index] ?? 0]?.page;
      if (item === undefined || page === undefined) return;
      const prev = index > 0 ? ` /Prev ${String(outlineItems[index - 1] ?? 0)} 0 R` : "";
      const next = index < outlineItems.length - 1 ? ` /Next ${String(outlineItems[index + 1] ?? 0)} 0 R` : "";
      file.set(item, `<< /Title ${textString(outline)} /Parent ${String(outlineRoot)} 0 R${prev}${next} /Dest [${String(page)} 0 R /Fit] >>`);
    });
  }

  return file.serialize(catalog, info);
}
