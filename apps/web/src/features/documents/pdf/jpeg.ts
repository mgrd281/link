/**
 * A JPEG as a PDF image (DCTDecode passes its bytes through unchanged): its size and colour
 * components, read from the frame header (SOF0 baseline, SOF1 extended, SOF2 progressive). Anything
 * else (PNG, WebP, a lossless or arithmetic-coded JPEG) is refused: the CV then has no photo.
 */
export interface Jpeg {
  bytes: Uint8Array;
  width: number;
  height: number;
  components: 1 | 3 | 4;
  /** An Adobe APP14 marker: its CMYK is stored inverted, so the PDF decodes it with /Decode [1 0 …]. */
  adobe: boolean;
  /** Where the picture's subject is (the owner's focal point, 0–1 across and down): the cover crop keeps it in view. */
  focal?: readonly [number, number] | undefined;
}

const SOI = 0xd8;
const FRAMES = new Set([0xc0, 0xc1, 0xc2]);
const STANDALONE = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);
const APP14 = 0xee;
const SOS = 0xda;

export function parseJpeg(bytes: Uint8Array): Jpeg | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  let at = 2;
  let adobe = false;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (STANDALONE.has(marker)) {
      at += 2;
      continue;
    }
    const length = ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0);
    const body = at + 4;
    if (marker === APP14 && String.fromCharCode(...bytes.slice(body, body + 5)) === "Adobe") adobe = true;
    if (FRAMES.has(marker)) {
      const height = ((bytes[body + 1] ?? 0) << 8) | (bytes[body + 2] ?? 0);
      const width = ((bytes[body + 3] ?? 0) << 8) | (bytes[body + 4] ?? 0);
      const components = bytes[body + 5] ?? 0;
      if (width === 0 || height === 0 || (components !== 1 && components !== 3 && components !== 4)) return null;
      return { bytes, width, height, components, adobe };
    }
    if (marker === SOS || (marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)) return null;
    at += 2 + length;
  }
  return null;
}

/** The image's colour space and, for Adobe CMYK, the inverted decode array. */
export function colourSpace(jpeg: Jpeg): string {
  if (jpeg.components === 1) return "/ColorSpace /DeviceGray";
  if (jpeg.components === 3) return "/ColorSpace /DeviceRGB";
  return `/ColorSpace /DeviceCMYK${jpeg.adobe ? " /Decode [1 0 1 0 1 0 1 0]" : ""}`;
}
