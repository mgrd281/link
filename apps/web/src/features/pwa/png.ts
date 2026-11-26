import { inflateSync } from "node:zlib";

/**
 * A small PNG reader for the tests that measure the app's icons and screenshots (no image library is
 * a dependency): the size from the header, and the pixels of an 8-bit, non-interlaced picture in
 * RGB or RGBA, which is what Chromium's canvas and screenshots write. Server and test code only.
 */
export interface Png {
  width: number;
  height: number;
  /** Bytes per pixel: 3 (RGB) or 4 (RGBA). */
  channels: number;
  /** Unfiltered rows, `width * channels` bytes each. */
  pixels: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from the IHDR chunk (any PNG). */
export function pngSize(file: Buffer): { width: number; height: number } {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const toLeft = Math.abs(p - left);
  const toUp = Math.abs(p - up);
  const toUpLeft = Math.abs(p - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** The pixels of an 8-bit RGB or RGBA PNG without interlacing. */
export function decodePng(file: Buffer): Png {
  const { width, height } = pngSize(file);
  const depth = file[24];
  const colorType = file[25];
  const interlace = file[28];
  if (depth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) throw new Error("only 8-bit RGB(A) without interlacing");
  const channels = colorType === 6 ? 4 : 3;
  const parts: Buffer[] = [];
  for (let at = 8; at < file.length; ) {
    const length = file.readUInt32BE(at);
    const type = file.toString("ascii", at + 4, at + 8);
    if (type === "IDAT") parts.push(file.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? (pixels[out + x - channels] ?? 0) : 0;
      const up = y > 0 ? (pixels[out - stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= channels ? (pixels[out - stride + x - channels] ?? 0) : 0;
      const value = row[x] ?? 0;
      const predicted = filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(left, up, upLeft) : 0;
      pixels[out + x] = (value + predicted) & 0xff;
    }
  }
  return { width, height, channels, pixels };
}
