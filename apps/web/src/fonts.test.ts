import { readFileSync } from "node:fs";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";

import { creatorTokens } from "@linkyo/tokens";
import { arabicFacesOf, PAIRING_IDS, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

/**
 * The self-hosted Arabic faces (fonts.ts) against the files they serve: what each face's
 * `unicode-range` lets it draw, and whether every Arabic stack of a creator page has a face for the
 * common Arabic letters before its Latin face. fonts.ts runs only inside the Next compiler
 * (`next/font/local`), so the test reads its calls as text.
 */

const SRC = import.meta.dirname;
const source = readFileSync(path.join(SRC, "fonts.ts"), "utf8");

interface Face {
  name: string;
  id: string;
  files: string[];
  range: [number, number][] | null;
}

const faces: Face[] = [...source.matchAll(/export const (\w+) = localFont\(\{([\s\S]*?)\n\}\);/g)].map(([, name = "", body = ""]) => {
  const id = /variable: "--font-face-([a-z0-9-]+)"/.exec(body)?.[1] ?? "";
  const files = [...body.matchAll(/(?:src|path): "([^"]+)"/g)].map(([, file = ""]) => path.resolve(SRC, file));
  const value = /prop: "unicode-range", value: "([^"]+)"/.exec(body)?.[1];
  const range = value
    ? value.split(",").map((part): [number, number] => {
        const [start = "", end] = part.trim().replace(/^U\+/i, "").split("-");
        return [parseInt(start, 16), parseInt(end ?? start, 16)];
      })
    : null;
  return { name, id, files, range };
});
const faceById = new Map(faces.map((face) => [face.id, face]));

const inRange = (face: Face, cp: number) => face.range === null || face.range.some(([start, end]) => cp >= start && cp <= end);
const isArabicFace = (face: Face | undefined) => Boolean(face?.range && inRange(face, 0x0628));

/** WOFF2 table tags by their 6-bit index (the WOFF2 spec's "known table tags"). */
// prettier-ignore
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
  "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
  "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

/** The code points a WOFF2 file maps to a glyph (its cmap, formats 4 and 12). */
function codePoints(file: string): Set<number> {
  const buf = readFileSync(file);
  if (buf.toString("latin1", 0, 4) !== "wOF2") throw new Error(`${file} is not WOFF2`);
  const numTables = buf.readUInt16BE(12);
  const totalCompressed = buf.readUInt32BE(20);
  let p = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = buf[p++] ?? 0;
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error("bad UIntBase128");
  };
  const directory: { tag: string; length: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++] ?? 0;
    let tag = KNOWN_TAGS[flags & 0x3f] ?? "";
    if ((flags & 0x3f) === 0x3f) {
      tag = buf.toString("latin1", p, p + 4);
      p += 4;
    }
    const version = (flags >> 6) & 3;
    let length = base128();
    // glyf and loca are transformed at version 0, every other table at a version other than 0.
    if (tag === "glyf" || tag === "loca" ? version === 0 : version !== 0) length = base128();
    directory.push({ tag, length });
  }
  const data = brotliDecompressSync(buf.subarray(p, p + totalCompressed));
  let offset = 0;
  let cmap: Buffer | undefined;
  for (const entry of directory) {
    if (entry.tag === "cmap") cmap = data.subarray(offset, offset + entry.length);
    offset += entry.length;
  }
  if (!cmap) throw new Error(`${file} has no cmap`);
  const points = new Set<number>();
  const subtables = cmap.readUInt16BE(2);
  for (let i = 0; i < subtables; i++) {
    const at = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(at);
    if (format === 4) {
      const segments = cmap.readUInt16BE(at + 6) / 2;
      const ends = at + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const rangeOffsets = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const start = cmap.readUInt16BE(starts + s * 2);
        const end = cmap.readUInt16BE(ends + s * 2);
        const delta = cmap.readInt16BE(deltas + s * 2);
        const rangeOffset = cmap.readUInt16BE(rangeOffsets + s * 2);
        for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
          let glyph = 0;
          if (rangeOffset === 0) glyph = (cp + delta) & 0xffff;
          else {
            const raw = cmap.readUInt16BE(rangeOffsets + s * 2 + rangeOffset + (cp - start) * 2);
            glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
          }
          if (glyph !== 0) points.add(cp);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(at + 12);
      for (let g = 0; g < groups; g++) {
        const start = cmap.readUInt32BE(at + 16 + g * 12);
        const end = cmap.readUInt32BE(at + 20 + g * 12);
        for (let cp = start; cp <= end; cp++) points.add(cp);
      }
    }
  }
  return points;
}

/** What a face can draw: the code points of all its files that its unicode-range lets through. */
const drawable = (face: Face) => {
  const out = new Set<number>();
  for (const file of face.files) for (const cp of codePoints(file)) if (inRange(face, cp)) out.add(cp);
  return out;
};

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
const span = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

/**
 * The Arabic every Arabic stack must draw in an Arabic face: the letters (not the rare U+063B–063F),
 * tatweel, the harakat, the Arabic-Indic digits, comma, semicolon and question mark, and the Persian
 * and Gulf letters پ چ ژ گ ک ی that Arabic-script names use.
 */
const COMMON_ARABIC = [...span(0x0621, 0x063a), ...span(0x0640, 0x0652), ...span(0x0660, 0x0669), 0x060c, 0x061b, 0x061f, 0x067e, 0x0686, 0x0698, 0x06af, 0x06a9, 0x06cc];

/** The leading Arabic faces of a CSS stack: the ones that come before its first Latin face. */
const arabicLead = (stack: string) => {
  const lead: Face[] = [];
  for (const [, id = ""] of stack.matchAll(/var\(--font-face-([a-z0-9-]+)/g)) {
    const face = faceById.get(id);
    if (!isArabicFace(face) || !face) break;
    lead.push(face);
  }
  return lead;
};

describe("Arabic faces in fonts.ts", () => {
  const arabic = faces.filter((face) => isArabicFace(face));

  it("finds every Arabic face and its files", () => {
    expect(arabic.map((face) => face.id).sort()).toEqual(["arabic-amiri", "arabic-changa", "arabic-lalezar", "arabic-plex", "arabic-rakkas", "arabic-readex", "plex-arabic"]);
    for (const face of arabic) expect(face.files.length, face.id).toBeGreaterThan(0);
  });

  it("never claims a Latin letter or digit, so German pages load none of them", () => {
    const latin = [...span(0x30, 0x39), ...span(0x41, 0x5a), ...span(0x61, 0x7a)];
    for (const face of arabic) expect(latin.filter((cp) => inRange(face, cp)).map(hex), face.id).toEqual([]);
  });

  it("keeps the spaces between Arabic words in the Arabic face (no monospace or Arial gaps)", () => {
    for (const face of arabic) {
      const can = drawable(face);
      expect(can.has(0x20), `${face.id} U+0020`).toBe(true);
      expect(can.has(0xa0), `${face.id} U+00A0`).toBe(true);
    }
  });

  it("lets the Arabic pairing's face draw everything its file has (a page in that pairing renders as before the range)", () => {
    const plex = faceById.get("plex-arabic");
    if (!plex) throw new Error("plex-arabic missing");
    const visible = (cp: number) => cp >= 0x20 && !(cp >= 0x7f && cp <= 0x9f);
    for (const file of plex.files) {
      const missing = [...codePoints(file)].filter((cp) => visible(cp) && !inRange(plex, cp));
      expect(missing.map(hex), path.basename(file)).toEqual([]);
    }
  });

  it("gives every Arabic stack of a creator page the common Arabic letters before its Latin face", () => {
    const stacks: [string, string][] = [];
    for (const id of PAIRING_IDS) {
      const own = arabicFacesOf(id);
      if (own.display) stacks.push([`${id} display`, own.display.stack]);
      if (own.body) stacks.push([`${id} body`, own.body.stack]);
    }
    for (const id of TEMPLATE_IDS) {
      const own = (creatorTokens.templates[id] as { arabic?: { display?: { stack: string }; body?: { stack: string } } }).arabic;
      if (own?.display) stacks.push([`${id} display`, own.display.stack]);
      if (own?.body) stacks.push([`${id} body`, own.body.stack]);
    }
    stacks.push(["arabic pairing display", creatorTokens.pairings.arabic.display.stack], ["arabic pairing body", creatorTokens.pairings.arabic.body.stack]);
    expect(stacks.length).toBeGreaterThan(16);
    for (const [name, stack] of stacks) {
      const lead = arabicLead(stack);
      expect(lead.length, name).toBeGreaterThan(0);
      const covered = new Set(lead.flatMap((face) => [...drawable(face)]));
      expect(COMMON_ARABIC.filter((cp) => !covered.has(cp)).map(hex), name).toEqual([]);
    }
  });
});
