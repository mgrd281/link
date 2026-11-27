import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

/**
 * A small PDF 1.7 file writer (ISO 32000-1): numbered objects, streams compressed with Flate at a
 * fixed level, a classic cross-reference table and a trailer whose /ID is derived from the file's
 * own bytes. Nothing reads the clock, so the same objects always give the same bytes.
 */

const LATIN1 = (text: string): Uint8Array => Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
const HEADER = Uint8Array.from([...LATIN1("%PDF-1.7\n%"), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
const LEVEL = 9;

/** A number as PDF writes it: at most three decimals, no trailing zeros, never "-0". */
export function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  if (Object.is(rounded, -0) || rounded === 0) return "0";
  return String(rounded);
}

/** A literal string of bytes: parentheses and backslashes escaped, bytes outside printable ASCII as octal. */
export function literal(bytes: readonly number[]): string {
  let out = "(";
  for (const byte of bytes) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 0x20 || byte > 0x7e) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return `${out})`;
}

/** An ASCII string (a URI, a language tag) as a literal. */
export const ascii = (text: string): string => literal(Array.from(text, (char) => char.charCodeAt(0) & 0x7f));

/** PDFDocEncoding's characters above Latin-1's printable range that the documents' titles may use. */
const PDF_DOC: Record<number, number> = {
  0x2022: 0x80, 0x2020: 0x81, 0x2021: 0x82, 0x2026: 0x83, 0x2014: 0x84, 0x2013: 0x85, 0x0192: 0x86, 0x2044: 0x87, 0x2039: 0x88,
  0x203a: 0x89, 0x2212: 0x8a, 0x2030: 0x8b, 0x201e: 0x8c, 0x201c: 0x8d, 0x201d: 0x8e, 0x2018: 0x8f, 0x2019: 0x90, 0x201a: 0x91,
  0x2122: 0x92, 0xfb01: 0x93, 0xfb02: 0x94, 0x0141: 0x95, 0x0152: 0x96, 0x0160: 0x97, 0x0178: 0x98, 0x017d: 0x99, 0x0131: 0x9a,
  0x0142: 0x9b, 0x0153: 0x9c, 0x0161: 0x9d, 0x017e: 0x9e, 0x20ac: 0xa0,
};

/** A text string for the document's information and outlines: PDFDocEncoding when it can, else UTF-16BE with its byte order mark. */
export function textString(text: string): string {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const mapped = PDF_DOC[code] ?? ((code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff && code !== 0xad) ? code : null);
    if (mapped === null) {
      let hex = "FEFF";
      for (let index = 0; index < text.length; index += 1) hex += text.charCodeAt(index).toString(16).toUpperCase().padStart(4, "0");
      return `<${hex}>`;
    }
    bytes.push(mapped);
  }
  return literal(bytes);
}

/** A PDF name for a plain ASCII word (font names: letters, digits and hyphens). */
export const name = (value: string): string => `/${value.replace(/[^A-Za-z0-9+\-_.]/gu, "")}`;

export const deflate = (data: Uint8Array): Uint8Array => new Uint8Array(deflateSync(data, { level: LEVEL }));

/** A file being written: reserve object numbers first, fill them in any order, then serialize. */
export class PdfFile {
  private readonly bodies: (Uint8Array | null)[] = [];

  /** The next object number. */
  reserve(): number {
    this.bodies.push(null);
    return this.bodies.length;
  }

  /** An object's body (a dictionary, an array, a number …). */
  set(number: number, body: string): void {
    this.bodies[number - 1] = LATIN1(body);
  }

  /** A stream object: compressed with Flate unless it is already compressed (a JPEG's DCT data). */
  stream(number: number, dictionary: string, data: Uint8Array, options: { compress?: boolean } = {}): void {
    const compress = options.compress !== false;
    const bytes = compress ? deflate(data) : data;
    const head = LATIN1(`<< ${dictionary}${compress ? " /Filter /FlateDecode" : ""} /Length ${String(bytes.length)} >>\nstream\n`);
    const tail = LATIN1("\nendstream");
    const out = new Uint8Array(head.length + bytes.length + tail.length);
    out.set(head, 0);
    out.set(bytes, head.length);
    out.set(tail, head.length + bytes.length);
    this.bodies[number - 1] = out;
  }

  /** The whole file: header, objects, cross-reference table, trailer with /ID, startxref, %%EOF. */
  serialize(root: number, info: number): Uint8Array {
    const parts: Uint8Array[] = [HEADER];
    let length = HEADER.length;
    const offsets: number[] = [];
    this.bodies.forEach((body, index) => {
      if (!body) throw new Error(`PDF: object ${String(index + 1)} was reserved but never written`);
      offsets.push(length);
      const open = LATIN1(`${String(index + 1)} 0 obj\n`);
      const close = LATIN1("\nendobj\n");
      parts.push(open, body, close);
      length += open.length + body.length + close.length;
    });
    const size = this.bodies.length + 1;
    const xref = LATIN1(
      `xref\n0 ${String(size)}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`,
    );
    parts.push(xref);
    const xrefAt = length;
    length += xref.length;
    const before = concat(parts, length);
    const id = createHash("sha256").update(before).digest("hex").slice(0, 32).toUpperCase();
    const trailer = LATIN1(`trailer\n<< /Size ${String(size)} /Root ${String(root)} 0 R /Info ${String(info)} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${String(xrefAt)}\n%%EOF\n`);
    return concat([before, trailer], before.length + trailer.length);
  }
}

function concat(parts: readonly Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
