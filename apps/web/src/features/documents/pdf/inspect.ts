import { inflateSync } from "node:zlib";

import { unicodeOf } from "../font/winansi";

/**
 * A reader for the PDFs our writer makes, for the tests and audits: the cross-reference table, each
 * object's dictionary and stream, and the text of each page in the order it is drawn (Tj strings
 * through the WinAnsi table). Not a general PDF parser.
 */

export interface PdfObject {
  offset: number;
  /** The object's text before any stream (Latin-1). */
  dictionary: string;
  /** The stream's bytes as stored (compressed or not). */
  stream: Uint8Array | null;
}

export interface ReadPdf {
  objects: Map<number, PdfObject>;
  size: number;
  xrefOffset: number;
  trailer: string;
}

const latin1 = (bytes: Uint8Array): string => Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

export function readPdf(bytes: Uint8Array): ReadPdf {
  const text = latin1(bytes);
  const end = /startxref\n(\d+)\n%%EOF\n$/u.exec(text);
  if (!end) throw new Error("no startxref");
  const xrefOffset = Number(end[1]);
  const table = /^xref\n0 (\d+)\n/u.exec(text.slice(xrefOffset));
  if (!table) throw new Error("no xref table at startxref");
  const size = Number(table[1]);
  const entriesAt = xrefOffset + table[0].length;
  const objects = new Map<number, PdfObject>();
  for (let index = 1; index < size; index += 1) {
    const entry = text.slice(entriesAt + index * 20, entriesAt + index * 20 + 20);
    const offset = Number(entry.slice(0, 10));
    const head = `${String(index)} 0 obj\n`;
    if (text.slice(offset, offset + head.length) !== head) throw new Error(`xref entry ${String(index)} does not point at its object`);
    const close = text.indexOf("\nendobj\n", offset);
    const body = text.slice(offset + head.length, close);
    const streamAt = body.indexOf(">>\nstream\n");
    if (streamAt < 0) {
      objects.set(index, { offset, dictionary: body, stream: null });
      continue;
    }
    const dictionary = body.slice(0, streamAt + 2);
    const length = Number(/\/Length (\d+)/u.exec(dictionary)?.[1] ?? "0");
    const start = offset + head.length + streamAt + ">>\nstream\n".length;
    objects.set(index, { offset, dictionary, stream: bytes.slice(start, start + length) });
  }
  const trailerAt = text.indexOf("trailer\n", entriesAt);
  return { objects, size, xrefOffset, trailer: text.slice(trailerAt, text.indexOf("startxref", trailerAt)) };
}

export const decoded = (object: PdfObject): string => (object.stream ? latin1(new Uint8Array(inflateSync(object.stream))) : "");

/** The literal strings of a content stream, in order, as WinAnsi bytes. */
function strings(content: string): number[][] {
  const found: number[][] = [];
  for (let at = 0; at < content.length; at += 1) {
    if (content[at] !== "(") continue;
    const bytes: number[] = [];
    let index = at + 1;
    for (; index < content.length && content[index] !== ")"; index += 1) {
      const char = content[index] ?? "";
      if (char !== "\\") {
        bytes.push(char.charCodeAt(0));
        continue;
      }
      const next = content[index + 1] ?? "";
      if (/[0-7]/u.test(next)) {
        bytes.push(Number.parseInt(content.slice(index + 1, index + 4), 8));
        index += 3;
      } else {
        bytes.push(next.charCodeAt(0));
        index += 1;
      }
    }
    found.push(bytes);
    at = index;
  }
  return found;
}

/** Each page's text runs, in drawing order, as Unicode (through the WinAnsi table). */
export function pageTexts(bytes: Uint8Array): string[][] {
  const pdf = readPdf(bytes);
  const pagesRoot = [...pdf.objects.values()].find((object) => object.dictionary.includes("/Type /Pages"));
  const kids = [...(pagesRoot?.dictionary.match(/\d+ 0 R/gu) ?? [])].map((ref) => Number(ref.split(" ")[0]));
  return kids.map((kid) => {
    const page = pdf.objects.get(kid);
    const contents = Number(/\/Contents (\d+) 0 R/u.exec(page?.dictionary ?? "")?.[1] ?? "0");
    const stream = pdf.objects.get(contents);
    return stream ? strings(decoded(stream)).map((run) => String.fromCodePoint(...run.map((code) => unicodeOf(code) ?? 0xfffd))) : [];
  });
}
