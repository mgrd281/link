/**
 * The facts of a TrueType font the documents need: its metrics (head, hhea, maxp, hmtx, OS/2, post),
 * its character map (cmap format 4) and its PostScript name (name ID 6). Read-only and pure; the
 * PDF embeds the whole file (pdf/fonts.ts) and the layout measures with these advances.
 */

export interface TrueTypeFont {
  /** The file as read (embedded whole as FontFile2). */
  bytes: Uint8Array;
  unitsPerEm: number;
  /** xMin, yMin, xMax, yMax in font units. */
  bbox: [number, number, number, number];
  ascender: number;
  descender: number;
  capHeight: number;
  xHeight: number;
  weightClass: number;
  /** Embedding permissions (OS/2 fsType): 0 means installable, embedding allowed. */
  fsType: number;
  italicAngle: number;
  postScriptName: string;
  numGlyphs: number;
  /** The glyph of a Unicode code point (0 when the font has none). */
  glyphOf: (codePoint: number) => number;
  /** A glyph's advance width in font units. */
  advanceOf: (glyph: number) => number;
}

interface Table {
  offset: number;
  length: number;
}

class Reader {
  private readonly view: DataView;

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  u8 = (at: number): number => this.view.getUint8(at);
  u16 = (at: number): number => this.view.getUint16(at);
  i16 = (at: number): number => this.view.getInt16(at);
  u32 = (at: number): number => this.view.getUint32(at);
  tag = (at: number): string => String.fromCharCode(this.u8(at), this.u8(at + 1), this.u8(at + 2), this.u8(at + 3));
  /** A 16.16 fixed-point number. */
  fixed = (at: number): number => this.view.getInt32(at) / 65536;
}

function tables(reader: Reader): Map<string, Table> {
  const count = reader.u16(4);
  const found = new Map<string, Table>();
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16;
    found.set(reader.tag(record), { offset: reader.u32(record + 8), length: reader.u32(record + 12) });
  }
  return found;
}

function need(found: Map<string, Table>, tag: string): Table {
  const table = found.get(tag);
  if (!table) throw new Error(`TrueType: no ${tag} table`);
  return table;
}

/** A cmap format 4 subtable (Unicode BMP), as a lookup. */
function format4(reader: Reader, at: number): (codePoint: number) => number {
  const segments = reader.u16(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  return (codePoint) => {
    if (codePoint > 0xffff) return 0;
    for (let segment = 0; segment < segments; segment += 1) {
      const end = reader.u16(ends + segment * 2);
      if (codePoint > end) continue;
      const start = reader.u16(starts + segment * 2);
      if (codePoint < start) return 0;
      const delta = reader.i16(deltas + segment * 2);
      const rangeAt = ranges + segment * 2;
      const range = reader.u16(rangeAt);
      if (range === 0) return (codePoint + delta) & 0xffff;
      const glyph = reader.u16(rangeAt + range + (codePoint - start) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

function characterMap(reader: Reader, table: Table): (codePoint: number) => number {
  const count = reader.u16(table.offset + 2);
  let best: number | null = null;
  for (let index = 0; index < count; index += 1) {
    const record = table.offset + 4 + index * 8;
    const platform = reader.u16(record);
    const encoding = reader.u16(record + 2);
    const at = table.offset + reader.u32(record + 4);
    const unicode = (platform === 3 && encoding === 1) || platform === 0;
    if (unicode && reader.u16(at) === 4) {
      best = at;
      if (platform === 3) break;
    }
  }
  if (best === null) throw new Error("TrueType: no Unicode cmap (format 4)");
  return format4(reader, best);
}

/** The PostScript name (name ID 6): Windows Unicode first, then Macintosh Roman. */
function postScriptName(reader: Reader, table: Table): string {
  const count = reader.u16(table.offset + 2);
  const storage = table.offset + reader.u16(table.offset + 4);
  let roman: string | null = null;
  for (let index = 0; index < count; index += 1) {
    const record = table.offset + 6 + index * 12;
    if (reader.u16(record + 6) !== 6) continue;
    const platform = reader.u16(record);
    const length = reader.u16(record + 8);
    const at = storage + reader.u16(record + 10);
    if (platform === 3 || platform === 0) {
      let name = "";
      for (let offset = 0; offset < length; offset += 2) name += String.fromCharCode(reader.u16(at + offset));
      return name;
    }
    if (platform === 1 && roman === null) {
      roman = "";
      for (let offset = 0; offset < length; offset += 1) roman += String.fromCharCode(reader.u8(at + offset));
    }
  }
  if (roman !== null) return roman;
  throw new Error("TrueType: no PostScript name");
}

export function parseTrueType(bytes: Uint8Array): TrueTypeFont {
  const reader = new Reader(bytes);
  const version = reader.u32(0);
  if (version !== 0x00010000 && version !== 0x74727565) throw new Error("TrueType: not a TrueType font");
  const found = tables(reader);
  const head = need(found, "head").offset;
  const hhea = need(found, "hhea").offset;
  const maxp = need(found, "maxp").offset;
  const hmtx = need(found, "hmtx").offset;
  const os2 = need(found, "OS/2").offset;
  const post = need(found, "post").offset;
  const metrics = reader.u16(hhea + 34);
  const os2Version = reader.u16(os2);
  const lastAdvance = reader.u16(hmtx + (metrics - 1) * 4);
  return {
    bytes,
    unitsPerEm: reader.u16(head + 18),
    bbox: [reader.i16(head + 36), reader.i16(head + 38), reader.i16(head + 40), reader.i16(head + 42)],
    ascender: reader.i16(hhea + 4),
    descender: reader.i16(hhea + 6),
    // OS/2 version 2 and later carry the x-height and cap height.
    xHeight: os2Version >= 2 ? reader.i16(os2 + 86) : 0,
    capHeight: os2Version >= 2 ? reader.i16(os2 + 88) : 0,
    weightClass: reader.u16(os2 + 4),
    fsType: reader.u16(os2 + 8),
    italicAngle: reader.fixed(post + 4),
    postScriptName: postScriptName(reader, need(found, "name")),
    numGlyphs: reader.u16(maxp + 4),
    glyphOf: characterMap(reader, need(found, "cmap")),
    advanceOf: (glyph) => (glyph < metrics ? reader.u16(hmtx + glyph * 4) : lastAdvance),
  };
}
