import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MOTION_LIBRARY } from "./motion-library";

/**
 * The library's stills and clips are shown edge to edge (a header plate may run the whole width of a
 * phone), so a band of pure black at a side reads as a stripe where the picture seems to stop short.
 * This reads a JPEG's brightness per 8 × 8 block from the blocks' DC coefficients alone (a baseline
 * file's scan, or a progressive file's first scan, which holds the DC coefficients of every block):
 * enough to see such a band, with no image decoder to depend on.
 */
interface LumaBlocks {
  width: number;
  height: number;
  /** The mean luma (0 to 255) of the 8 × 8 luma block in block column `col`, block row `row`. */
  mean: (col: number, row: number) => number;
}

interface FrameComponent {
  id: number;
  h: number;
  v: number;
  quant: number;
}

function lumaBlocks(file: Buffer): LumaBlocks {
  if (file.readUInt16BE(0) !== 0xffd8) throw new Error("not a JPEG");
  const dcQuant = new Map<number, number>();
  // Huffman tables by (class << 4 | id); each maps (code length << 16 | code) to its symbol.
  const huffman = new Map<number, Map<number, number>>();
  let frame: { progressive: boolean; width: number; height: number; components: FrameComponent[] } | undefined;
  let interval = 0;
  for (let at = 2; ; ) {
    const marker = file.readUInt16BE(at);
    const body = at + 4;
    const end = at + 2 + file.readUInt16BE(at + 2);
    if (marker === 0xffdb) {
      for (let p = body; p < end; ) {
        const wide = file.readUInt8(p) >> 4 === 1;
        dcQuant.set(file.readUInt8(p) & 15, wide ? file.readUInt16BE(p + 1) : file.readUInt8(p + 1));
        p += 1 + 64 * (wide ? 2 : 1);
      }
    } else if (marker === 0xffc4) {
      for (let p = body; p < end; ) {
        const table = new Map<number, number>();
        let code = 0;
        let symbol = p + 17;
        for (let length = 1; length <= 16; length++) {
          for (let n = file.readUInt8(p + length); n > 0; n--) table.set((length << 16) | code++, file.readUInt8(symbol++));
          code <<= 1;
        }
        huffman.set(file.readUInt8(p), table);
        p = symbol;
      }
    } else if (marker === 0xffc0 || marker === 0xffc1 || marker === 0xffc2) {
      const components = Array.from({ length: file.readUInt8(body + 5) }, (_, k) => {
        const c = body + 6 + 3 * k;
        const sampling = file.readUInt8(c + 1);
        return { id: file.readUInt8(c), h: sampling >> 4, v: sampling & 15, quant: file.readUInt8(c + 2) };
      });
      frame = { progressive: marker === 0xffc2, height: file.readUInt16BE(body + 1), width: file.readUInt16BE(body + 3), components };
    } else if (marker === 0xffdd) {
      interval = file.readUInt16BE(body);
    } else if (marker === 0xffda) {
      if (!frame) throw new Error("a scan before the frame header");
      return firstScan(file, body, end, frame, dcQuant, huffman, interval);
    } else if (marker === 0xffd9) {
      throw new Error("no scan");
    }
    at = end;
  }
}

function firstScan(
  file: Buffer,
  body: number,
  start: number,
  frame: { progressive: boolean; width: number; height: number; components: FrameComponent[] },
  dcQuant: ReadonlyMap<number, number>,
  huffman: ReadonlyMap<number, ReadonlyMap<number, number>>,
  interval: number,
): LumaBlocks {
  const count = file.readUInt8(body);
  const table = (key: number) => {
    const found = huffman.get(key);
    if (!found) throw new Error(`no Huffman table ${key}`);
    return found;
  };
  const scan = Array.from({ length: count }, (_, k) => {
    const component = frame.components.find(({ id }) => id === file.readUInt8(body + 1 + 2 * k));
    if (!component) throw new Error("a scan of an unknown component");
    const tables = file.readUInt8(body + 2 + 2 * k);
    // A progressive file's DC scan names no AC table; a baseline scan needs one to skip the AC coefficients.
    const ac = frame.progressive ? undefined : table(16 | (tables & 15));
    return { ...component, luma: component === frame.components[0], dc: table(tables >> 4), ac };
  });
  if (file.readUInt8(body + 1 + 2 * count) !== 0) throw new Error("the first scan holds no DC coefficients");
  const shift = file.readUInt8(body + 3 + 2 * count) & 15;
  const luma = frame.components[0];
  const quant = luma && dcQuant.get(luma.quant);
  if (!luma || quant === undefined || !scan.some((c) => c.luma)) throw new Error("the first scan has no luma");

  let pos = start;
  let byte = 0;
  let left = 0;
  const bit = () => {
    if (left === 0) {
      byte = file.readUInt8(pos++);
      if (byte === 0xff && file.readUInt8(pos++) !== 0) throw new Error("a marker inside the scan");
      left = 8;
    }
    left--;
    return (byte >> left) & 1;
  };
  const receive = (size: number) => {
    let value = 0;
    for (let i = 0; i < size; i++) value = (value << 1) | bit();
    return size > 0 && value < 1 << (size - 1) ? value - (1 << size) + 1 : value;
  };
  const decode = (codes: ReadonlyMap<number, number>) => {
    let code = 0;
    for (let length = 1; length <= 16; length++) {
      code = (code << 1) | bit();
      const symbol = codes.get((length << 16) | code);
      if (symbol !== undefined) return symbol;
    }
    throw new Error("not a Huffman code");
  };

  // Interleaved scans go by MCU (each component's h × v blocks); a single-component scan by block.
  const hMax = Math.max(...frame.components.map((c) => c.h));
  const vMax = Math.max(...frame.components.map((c) => c.v));
  const interleaved = count > 1;
  const cols = interleaved ? Math.ceil(frame.width / (8 * hMax)) : Math.ceil((frame.width * luma.h) / hMax / 8);
  const rows = interleaved ? Math.ceil(frame.height / (8 * vMax)) : Math.ceil((frame.height * luma.v) / vMax / 8);
  const stride = interleaved ? cols * luma.h : cols;
  const dc = new Float64Array(stride * (interleaved ? rows * luma.v : rows));
  const predictions = scan.map(() => 0);
  for (let mcu = 0; mcu < cols * rows; mcu++) {
    if (interval > 0 && mcu > 0 && mcu % interval === 0) {
      // A restart marker: whole bytes again, and the predictions start over.
      left = 0;
      if (file.readUInt8(pos) !== 0xff || (file.readUInt8(pos + 1) & 0xf8) !== 0xd0) throw new Error("no restart marker");
      pos += 2;
      predictions.fill(0);
    }
    const x = mcu % cols;
    const y = Math.floor(mcu / cols);
    scan.forEach((component, k) => {
      const across = interleaved ? component.h : 1;
      const down = interleaved ? component.v : 1;
      for (let v = 0; v < down; v++) {
        for (let h = 0; h < across; h++) {
          predictions[k] = (predictions[k] ?? 0) + receive(decode(component.dc));
          if (component.ac) {
            // A baseline block goes on with its 63 AC coefficients: skip them.
            for (let i = 1; i < 64; ) {
              const symbol: number = decode(component.ac);
              if ((symbol & 15) === 0 && symbol !== 0xf0) break; // the end of the block
              i += (symbol >> 4) + 1; // a run of zeros, then one coefficient (or 16 zeros)
              receive(symbol & 15);
            }
          }
          if (component.luma) dc[(y * down + v) * stride + x * across + h] = (predictions[k] ?? 0) * 2 ** shift;
        }
      }
    });
  }
  // The DC coefficient is eight times the block's mean, less the level shift of 128.
  return { width: frame.width, height: frame.height, mean: (col, row) => 128 + ((dc[row * stride + col] ?? 0) * quant) / 8 };
}

/** The mean luma of each 8 px column of blocks that the outer `share` of the width touches on one side. */
function edgeColumns(blocks: LumaBlocks, side: "left" | "right", share: number): number[] {
  const band = Math.ceil(blocks.width * share);
  const cols = Math.ceil(blocks.width / 8);
  const rows = Math.ceil(blocks.height / 8);
  const first = side === "left" ? 0 : Math.floor((blocks.width - band) / 8);
  const last = side === "left" ? Math.ceil(band / 8) - 1 : cols - 1;
  return Array.from({ length: last - first + 1 }, (_, i) => {
    let sum = 0;
    for (let row = 0; row < rows; row++) sum += blocks.mean(first + i, row);
    return sum / rows;
  });
}

// 32 × 16 px, the left half black, the right half grey 200 (4:2:0): baseline with a restart marker
// after each MCU, and progressive as every motion still is saved.
const FIXTURES = {
  baseline: [
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQ",
    "ERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU",
    "FBQUFBQUFBQUFBQUFBT/wAARCAAQACADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAgJ/8QAFBABAAAAAAAAAAAA",
    "AAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/90ABAAB/9oADAMBAAIRAxEAPwDK",
    "oAH/0LAAB//Z",
  ],
  progressive: [
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQ",
    "ERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU",
    "FBQUFBQUFBQUFBQUFBT/wgARCAAQACADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAgJ/8QAFAEBAAAAAAAAAAAA",
    "AAAAAAAAAP/aAAwDAQACEAMQAAABlQGhYP/EABQQAQAAAAAAAAAAAAAAAAAAADD/2gAIAQEAAQUCD//EABQRAQAAAAAAAAAA",
    "AAAAAAAAABD/2gAIAQMBAT8BP//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8BP//EABQQAQAAAAAAAAAAAAAAAAAA",
    "ADD/2gAIAQEABj8CD//EABQQAQAAAAAAAAAAAAAAAAAAADD/2gAIAQEAAT8hD//aAAwDAQACAAMAAAAQ8A//xAAUEQEAAAAA",
    "AAAAAAAAAAAAAAAQ/9oACAEDAQE/ED//xAAUEQEAAAAAAAAAAAAAAAAAAAAQ/9oACAECAQE/ED//xAAUEAEAAAAAAAAAAAAA",
    "AAAAAAAw/9oACAEBAAE/EA//2Q==",
  ],
};

// A side darker than this on average is a band of pure black: the darkest colour of the drawn scenes
// (#0a0a0b, luma 10) stays above it, an empty edge reads 0.
const NEAR_BLACK = 8;

describe("the motion library's stills", () => {
  it("are read block by block from a JPEG, baseline or progressive", () => {
    for (const [kind, parts] of Object.entries(FIXTURES)) {
      const blocks = lumaBlocks(Buffer.from(parts.join(""), "base64"));
      expect([blocks.width, blocks.height], kind).toEqual([32, 16]);
      for (const luma of edgeColumns(blocks, "left", 0.5)) expect(Math.abs(luma), kind).toBeLessThan(2);
      for (const luma of edgeColumns(blocks, "right", 0.5)) expect(Math.abs(luma - 200), kind).toBeLessThan(3);
    }
  });

  it("run to both edges: no band of pure black in the outer 2 % on either side", () => {
    for (const clip of MOTION_LIBRARY) {
      const file = readFileSync(join(process.cwd(), "src", "assets", "examples", `${clip.poster.replace("sample:", "")}.jpg`));
      const blocks = lumaBlocks(file);
      expect([blocks.width, blocks.height], clip.key).toEqual([clip.w, clip.h]);
      for (const side of ["left", "right"] as const) {
        const columns = edgeColumns(blocks, side, 0.02);
        expect(columns.length, `${clip.key} ${side}`).toBeGreaterThan(0);
        for (const luma of columns) expect(luma, `${clip.key}, ${side} edge`).toBeGreaterThan(NEAR_BLACK);
      }
    }
  });
});
