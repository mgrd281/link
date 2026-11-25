import { inflateSync } from "node:zlib";

/**
 * Link preview cards as JPEG (E-07, ADR 0008). WhatsApp skips previews over about 300 KB, and a card
 * with a photo weighs 400 to 1000 KB as a PNG, the only format next/og writes. Linkyo brings no image
 * library, so the card's PNG is read back here (8 bits per channel, not interlaced, as next/og writes
 * it) and written again as a baseline JPEG (ITU-T T.81): YCbCr with 4:2:0 subsampling, the example
 * quantisation tables of Annex K scaled to the quality the way libjpeg scales them, and Annex K's
 * Huffman tables. Server only (node:zlib).
 */

/** Pixels, RGBA with 8 bits per channel, row by row. */
export interface Bitmap {
  width: number;
  height: number;
  rgba: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const IHDR = 0x49484452;
const IDAT = 0x49444154;
const IEND = 0x49454e44;

/** The PNG filter "Paeth": whichever neighbour is closest to left + up − up-left. */
function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** A PNG's pixels: 8-bit RGB or RGBA, not interlaced (what next/og writes). Anything else throws. */
export function decodePng(png: Uint8Array): Bitmap {
  if (png.length < 8 || PNG_SIGNATURE.some((byte, index) => png[index] !== byte)) throw new Error("Not a PNG");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let width = 0;
  let height = 0;
  let channels = 0;
  const parts: Uint8Array[] = [];
  for (let offset = 8; offset + 12 <= png.length; ) {
    const length = view.getUint32(offset);
    const type = view.getUint32(offset + 4);
    const start = offset + 8;
    if (type === IHDR) {
      width = view.getUint32(start);
      height = view.getUint32(start + 4);
      const depth = png[start + 8];
      const color = png[start + 9];
      const interlace = png[start + 12];
      if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) throw new Error("Unsupported PNG");
      channels = color === 6 ? 4 : 3;
    } else if (type === IDAT) {
      parts.push(png.subarray(start, start + length));
    } else if (type === IEND) {
      break;
    }
    offset = start + length + 4;
  }
  if (width === 0 || height === 0 || channels === 0) throw new Error("PNG without a header");
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error("PNG data too short");

  const rgba = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  let current = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? (current[x - channels] ?? 0) : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? (previous[x - channels] ?? 0) : 0;
      let predicted: number;
      switch (filter) {
        case 0:
          predicted = 0;
          break;
        case 1:
          predicted = left;
          break;
        case 2:
          predicted = up;
          break;
        case 3:
          predicted = (left + up) >> 1;
          break;
        case 4:
          predicted = paeth(left, up, upLeft);
          break;
        default:
          throw new Error("Unknown PNG filter");
      }
      current[x] = ((raw[source + x] ?? 0) + predicted) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      rgba[to] = current[from] ?? 0;
      rgba[to + 1] = current[from + 1] ?? 0;
      rgba[to + 2] = current[from + 2] ?? 0;
      rgba[to + 3] = channels === 4 ? (current[from + 3] ?? 0) : 255;
    }
    [previous, current] = [current, previous];
  }
  return { width, height, rgba };
}

/** Coefficient order of a JPEG block: the zigzag through the 8 × 8 grid, as indexes into it row by row. */
export const ZIGZAG: readonly number[] = (() => {
  const order: number[] = [];
  for (let sum = 0; sum < 15; sum++) {
    const diagonal: number[] = [];
    for (let row = 0; row < 8; row++) {
      const column = sum - row;
      if (column >= 0 && column < 8) diagonal.push(row * 8 + column);
    }
    order.push(...(sum % 2 === 0 ? diagonal.reverse() : diagonal));
  }
  return order;
})();

/** T.81 Annex K, tables K.1 and K.2: the example quantisation tables, row by row. */
const LUMA_TABLE = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109,
  103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const CHROMA_TABLE = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, ...Array<number>(38).fill(99)];

/** A table scaled to a quality of 1–100 as libjpeg scales it (50 keeps the table, 100 is all ones). */
export function scaleTable(table: readonly number[], quality: number): number[] {
  const clamped = Math.min(100, Math.max(1, Math.round(quality)));
  const scale = clamped < 50 ? 5000 / clamped : 200 - clamped * 2;
  return table.map((value) => Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100))));
}

/** A Huffman table as a JPEG file carries it: how many codes of each length 1–16, then the symbols. */
export interface HuffmanTable {
  bits: readonly number[];
  values: readonly number[];
}

const DC_SYMBOLS = Array.from({ length: 12 }, (_, index) => index);

/** T.81 Annex K.3: the typical Huffman tables for luminance and chrominance, DC and AC. */
export const HUFFMAN: Record<"dcLuma" | "acLuma" | "dcChroma" | "acChroma", HuffmanTable> = {
  dcLuma: { bits: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], values: DC_SYMBOLS },
  dcChroma: { bits: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], values: DC_SYMBOLS },
  acLuma: {
    bits: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d],
    values: [
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
      0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
      0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
    ],
  },
  acChroma: {
    bits: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77],
    values: [
      0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91,
      0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
      0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
      0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
      0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4,
      0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
      0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
    ],
  },
};

/** The code and its length in bits for every symbol of a table (canonical codes, T.81 Annex C). */
interface Codes {
  code: Uint16Array;
  length: Uint8Array;
}

function codesOf({ bits, values }: HuffmanTable): Codes {
  const code = new Uint16Array(256);
  const length = new Uint8Array(256);
  let next = 0;
  let index = 0;
  for (let size = 1; size <= 16; size++) {
    for (let count = 0; count < (bits[size - 1] ?? 0); count++) {
      const symbol = values[index++] ?? 0;
      code[symbol] = next++;
      length[symbol] = size;
    }
    next <<= 1;
  }
  return { code, length };
}

/** cos((2x + 1)uπ / 16) · C(u) / 2 at [u · 8 + x], with C(0) = 1/√2: the 8-point DCT, used along rows and columns. */
const COSINES = Float64Array.from({ length: 64 }, (_, index) => {
  const u = index >> 3;
  const x = index & 7;
  return ((u === 0 ? Math.SQRT1_2 : 1) / 2) * Math.cos(((2 * x + 1) * u * Math.PI) / 16);
});

/** The bytes of the file, with the bit writer of the entropy-coded data (0xFF is followed by a 0x00). */
class Output {
  private bytes = new Uint8Array(1 << 18);
  private size = 0;
  private bits = 0;
  private count = 0;

  byte(value: number): void {
    if (this.size === this.bytes.length) {
      const grown = new Uint8Array(this.bytes.length * 2);
      grown.set(this.bytes);
      this.bytes = grown;
    }
    this.bytes[this.size++] = value;
  }

  /** A marker segment: FF, the marker, the length (counting its own two bytes), the payload. */
  segment(marker: number, payload: readonly number[]): void {
    this.byte(0xff);
    this.byte(marker);
    this.byte((payload.length + 2) >> 8);
    this.byte((payload.length + 2) & 0xff);
    for (const value of payload) this.byte(value);
  }

  /** The lowest `length` bits of `value`, the highest first (at most 16 at a time). */
  write(value: number, length: number): void {
    this.bits = (this.bits << length) | (value & ((1 << length) - 1));
    this.count += length;
    while (this.count >= 8) {
      const byte = (this.bits >> (this.count - 8)) & 0xff;
      this.byte(byte);
      if (byte === 0xff) this.byte(0);
      this.count -= 8;
    }
    this.bits &= (1 << this.count) - 1;
  }

  /** A symbol's Huffman code. */
  code(codes: Codes, symbol: number): void {
    const length = codes.length[symbol] ?? 0;
    if (length === 0) throw new Error(`No Huffman code for ${String(symbol)}`);
    this.write(codes.code[symbol] ?? 0, length);
  }

  /** Pads the last byte of the entropy-coded data with one bits. */
  flush(): void {
    if (this.count > 0) this.write((1 << (8 - this.count)) - 1, 8 - this.count);
  }

  result(): Uint8Array<ArrayBuffer> {
    return this.bytes.slice(0, this.size);
  }
}

/** Bits needed for a value's magnitude (its "category"): 0 for 0, 1 for ±1, 2 for ±2–3 … */
const category = (value: number) => 32 - Math.clz32(Math.abs(value));

/** A value of `size` bits as JPEG writes it: as is when positive, as value − 1 in `size` bits when negative. */
const valueBits = (value: number, size: number) => (value < 0 ? value + (1 << size) - 1 : value);

/** One 8 × 8 block: DCT, quantisation, then its DC difference and AC run lengths. Returns its DC value. */
function encodeBlock(samples: Float64Array, table: readonly number[], dc: Codes, ac: Codes, previousDc: number, out: Output, scratch: Float64Array): number {
  for (let y = 0; y < 8; y++) {
    for (let u = 0; u < 8; u++) {
      let sum = 0;
      for (let x = 0; x < 8; x++) sum += (samples[y * 8 + x] ?? 0) * (COSINES[u * 8 + x] ?? 0);
      scratch[y * 8 + u] = sum;
    }
  }
  const quantised = new Int16Array(64);
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let y = 0; y < 8; y++) sum += (scratch[y * 8 + u] ?? 0) * (COSINES[v * 8 + y] ?? 0);
      const position = v * 8 + u;
      quantised[position] = Math.round(sum / (table[position] ?? 1));
    }
  }

  const dcValue = quantised[0] ?? 0;
  const difference = dcValue - previousDc;
  const dcSize = category(difference);
  out.code(dc, dcSize);
  if (dcSize > 0) out.write(valueBits(difference, dcSize), dcSize);

  let run = 0;
  for (let index = 1; index < 64; index++) {
    const value = quantised[ZIGZAG[index] ?? 0] ?? 0;
    if (value === 0) {
      run++;
      continue;
    }
    while (run > 15) {
      out.code(ac, 0xf0);
      run -= 16;
    }
    const size = category(value);
    out.code(ac, (run << 4) | size);
    out.write(valueBits(value, size), size);
    run = 0;
  }
  if (run > 0) out.code(ac, 0x00);
  return dcValue;
}

/** Pixels as a baseline JPEG at `quality` (1–100), 4:2:0. Transparent pixels are laid on white. */
export function encodeJpeg({ width, height, rgba }: Bitmap, quality: number): Uint8Array<ArrayBuffer> {
  const lumaTable = scaleTable(LUMA_TABLE, quality);
  const chromaTable = scaleTable(CHROMA_TABLE, quality);
  const codes = { dcLuma: codesOf(HUFFMAN.dcLuma), acLuma: codesOf(HUFFMAN.acLuma), dcChroma: codesOf(HUFFMAN.dcChroma), acChroma: codesOf(HUFFMAN.acChroma) };
  const out = new Output();

  out.byte(0xff);
  out.byte(0xd8);
  // JFIF 1.01, no units, square pixels, no thumbnail.
  out.segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  out.segment(0xdb, [0x00, ...ZIGZAG.map((index) => lumaTable[index] ?? 1), 0x01, ...ZIGZAG.map((index) => chromaTable[index] ?? 1)]);
  // 8 bits, three components: luma sampled 2 × 2 against chroma's 1 × 1.
  out.segment(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const table = (id: number, { bits, values }: HuffmanTable) => [id, ...bits, ...values];
  out.segment(0xc4, [...table(0x00, HUFFMAN.dcLuma), ...table(0x10, HUFFMAN.acLuma), ...table(0x01, HUFFMAN.dcChroma), ...table(0x11, HUFFMAN.acChroma)]);
  out.segment(0xda, [3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0]);

  const luma = new Float64Array(256);
  const block = new Float64Array(64);
  const blue = new Float64Array(64);
  const red = new Float64Array(64);
  const scratch = new Float64Array(64);
  let previousY = 0;
  let previousBlue = 0;
  let previousRed = 0;
  for (let top = 0; top < height; top += 16) {
    for (let left = 0; left < width; left += 16) {
      blue.fill(0);
      red.fill(0);
      for (let dy = 0; dy < 16; dy++) {
        const y = Math.min(top + dy, height - 1);
        for (let dx = 0; dx < 16; dx++) {
          const x = Math.min(left + dx, width - 1);
          const at = (y * width + x) * 4;
          const alpha = (rgba[at + 3] ?? 255) / 255;
          const r = (rgba[at] ?? 0) * alpha + 255 * (1 - alpha);
          const g = (rgba[at + 1] ?? 0) * alpha + 255 * (1 - alpha);
          const b = (rgba[at + 2] ?? 0) * alpha + 255 * (1 - alpha);
          // JFIF's YCbCr, shifted to centre on 0; chroma averaged over 2 × 2 pixels.
          luma[dy * 16 + dx] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
          const cell = (dy >> 1) * 8 + (dx >> 1);
          blue[cell] = (blue[cell] ?? 0) + (-0.168736 * r - 0.331264 * g + 0.5 * b) / 4;
          red[cell] = (red[cell] ?? 0) + (0.5 * r - 0.418688 * g - 0.081312 * b) / 4;
        }
      }
      for (const [offsetX, offsetY] of [
        [0, 0],
        [8, 0],
        [0, 8],
        [8, 8],
      ] as const) {
        for (let row = 0; row < 8; row++) {
          for (let column = 0; column < 8; column++) block[row * 8 + column] = luma[(offsetY + row) * 16 + offsetX + column] ?? 0;
        }
        previousY = encodeBlock(block, lumaTable, codes.dcLuma, codes.acLuma, previousY, out, scratch);
      }
      previousBlue = encodeBlock(blue, chromaTable, codes.dcChroma, codes.acChroma, previousBlue, out, scratch);
      previousRed = encodeBlock(red, chromaTable, codes.dcChroma, codes.acChroma, previousRed, out, scratch);
    }
  }
  out.flush();
  out.byte(0xff);
  out.byte(0xd9);
  return out.result();
}

/**
 * A card drawn by next/og as a JPEG response, with the card's own headers (its cache rules): the PNG
 * read back and written again at `quality`. At 80 a photo card loses nothing visible at the sizes a
 * chat shows it, and weighs a fifth to a tenth of the PNG.
 */
export async function jpegCard(card: Response, quality = 80): Promise<Response> {
  const png = new Uint8Array(await card.arrayBuffer());
  const body = encodeJpeg(decodePng(png), quality);
  const headers = new Headers(card.headers);
  headers.set("content-type", "image/jpeg");
  headers.delete("content-length");
  return new Response(body, { status: card.status, headers });
}
