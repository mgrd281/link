import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { decodePng, encodeJpeg, HUFFMAN, jpegCard, scaleTable, ZIGZAG } from "./jpeg";

/** A PNG of the given rows (each already prefixed with its filter byte), 8-bit, RGB or RGBA. */
function png(width: number, height: number, channels: 3 | 4, rows: number[][]): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    out.set(data, 8);
    return out; // The reader does not check CRCs; they stay zero here.
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, channels === 4 ? 6 : 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(rows.flat()))),
    chunk("IEND", new Uint8Array()),
  ]);
}

/** The entropy-coded bytes between the start of scan's header and the end of image. */
function scanData(jpeg: Uint8Array): number[] {
  const bytes = [...jpeg];
  const sos = bytes.findIndex((byte, index) => byte === 0xff && bytes[index + 1] === 0xda);
  const length = ((bytes[sos + 2] ?? 0) << 8) | (bytes[sos + 3] ?? 0);
  return bytes.slice(sos + 2 + length, -2);
}

describe("JPEG link preview cards (E-07)", () => {
  it("walks the block in zigzag order", () => {
    expect(ZIGZAG.slice(0, 10)).toEqual([0, 1, 8, 16, 9, 2, 3, 10, 17, 24]);
    expect(ZIGZAG.slice(-8)).toEqual([53, 60, 61, 54, 47, 55, 62, 63]);
    expect([...ZIGZAG].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, index) => index));
  });

  it("carries complete Huffman tables: every DC category and every AC run and size once", () => {
    const acSymbols = [0x00, 0xf0, ...Array.from({ length: 16 }, (_, run) => Array.from({ length: 10 }, (__, size) => (run << 4) | (size + 1))).flat()];
    for (const [name, table] of Object.entries(HUFFMAN)) {
      expect(table.bits.reduce((sum, count) => sum + count, 0), name).toBe(table.values.length);
      const expected = name.startsWith("dc") ? Array.from({ length: 12 }, (_, index) => index) : acSymbols;
      expect([...table.values].sort((a, b) => a - b), name).toEqual([...expected].sort((a, b) => a - b));
    }
  });

  it("scales the quantisation tables as libjpeg does", () => {
    const table = [16, 11, 99, 1];
    expect(scaleTable(table, 50)).toEqual(table);
    expect(scaleTable(table, 100)).toEqual([1, 1, 1, 1]);
    expect(scaleTable(table, 80)).toEqual([6, 4, 40, 1]);
    expect(scaleTable(table, 10)).toEqual([80, 55, 255, 5]);
  });

  it("reads a PNG through every row filter", () => {
    // 2 × 5 RGBA; each row stores the same pixels [10, 20, 30, 255] and [50, 70, 90, 128] with another filter.
    const pixels = [10, 20, 30, 255, 50, 70, 90, 128];
    const rows = [
      [0, ...pixels], // None
      [1, 10, 20, 30, 255, 40, 50, 60, 129], // Sub: each byte minus the one a pixel to the left
      [2, 0, 0, 0, 0, 0, 0, 0, 0], // Up: equal to the row above
      [3, 5, 10, 15, 128, 20, 25, 30, 193], // Average of left and up
      [4, 0, 0, 0, 0, 0, 0, 0, 0], // Paeth: predicted from the row above
    ];
    const bitmap = decodePng(png(2, 5, 4, rows));
    expect(bitmap.width).toBe(2);
    expect(bitmap.height).toBe(5);
    for (let row = 0; row < 5; row++) expect([...bitmap.rgba.subarray(row * 8, row * 8 + 8)], `row ${String(row)}`).toEqual(pixels);
  });

  it("reads RGB as opaque, and refuses what next/og never writes", () => {
    expect([...decodePng(png(1, 1, 3, [[0, 1, 2, 3]])).rgba]).toEqual([1, 2, 3, 255]);
    expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow("Not a PNG");
    const palette = png(1, 1, 3, [[0, 1, 2, 3]]);
    palette[25] = 3; // colour type 3, indexed
    expect(() => decodePng(palette)).toThrow("Unsupported PNG");
  });

  it("writes a baseline JPEG with its tables and size", () => {
    const width = 20;
    const height = 9;
    const rgba = new Uint8Array(width * height * 4).map((_, index) => (index % 4 === 3 ? 255 : (index * 7) % 256));
    const jpeg = encodeJpeg({ width, height, rgba }, 80);
    expect([...jpeg.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(Buffer.from(jpeg.subarray(6, 11)).toString("latin1")).toBe("JFIF\0");
    expect([...jpeg.subarray(-2)]).toEqual([0xff, 0xd9]);
    const frame = Buffer.from(jpeg).indexOf(Buffer.from([0xff, 0xc0]));
    // Baseline, 8 bits, height, width, three components with luma sampled 2 × 2.
    expect([...jpeg.subarray(frame + 4, frame + 19)]).toEqual([8, 0, height, 0, width, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    // Inside the scan every 0xFF byte is followed by a stuffed 0x00.
    const scan = scanData(jpeg);
    scan.forEach((byte, index) => {
      if (byte === 0xff) expect(scan[index + 1]).toBe(0);
    });
  });

  it("codes a flat grey block as nothing but its zero DC and an end of block", () => {
    // 16 × 16 mid grey: four luma blocks (DC "00", EOB "1010") and two chroma blocks (DC "00", EOB "00").
    const rgba = new Uint8Array(16 * 16 * 4).map((_, index) => (index % 4 === 3 ? 255 : 128));
    expect(scanData(encodeJpeg({ width: 16, height: 16, rgba }, 80))).toEqual([0b00101000, 0b10100010, 0b10001010, 0b00000000]);
  });

  it("turns a next/og card into a JPEG response and keeps its cache headers", async () => {
    const card = new Response(new Uint8Array(png(1, 1, 4, [[0, 200, 100, 50, 255]])), { headers: { "content-type": "image/png", "cache-control": "public, max-age=60" } });
    const response = await jpegCard(card);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect([...new Uint8Array(await response.arrayBuffer()).subarray(0, 2)]).toEqual([0xff, 0xd8]);
  });
});
