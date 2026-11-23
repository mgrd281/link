import { describe, expect, it } from "vitest";

import { drawablePicture, drawableType, isDrawableHeader, MAX_PHOTO_BYTES } from "./og-picture";

const bytes = (head: number[], length = 64) => Uint8Array.from({ length }, (_, index) => head[index] ?? 0);
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0]);
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// "RIFF" <size> "WEBP": what the dashboard uploads for pictures with transparency.
const WEBP = bytes([...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBPVP8 ")]);
const AVIF = bytes([0, 0, 0, 0x1c, ...ascii("ftypavif")]);
const GIF = bytes(ascii("GIF89a"));

describe("photos on link preview cards", () => {
  it("draws JPEG and PNG", () => {
    expect(drawableType(JPEG)).toBe("image/jpeg");
    expect(drawableType(PNG)).toBe("image/png");
    expect(drawablePicture("image/jpeg", JPEG)).toMatch(/^data:image\/jpeg;base64,\/9j\//);
    expect(drawablePicture("image/png; charset=binary", PNG)).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
  });

  it("leaves a WebP avatar out, so the card shows the initials instead of a broken picture", () => {
    expect(drawableType(WEBP)).toBeNull();
    expect(isDrawableHeader("image/webp")).toBe(false);
    expect(drawablePicture("image/webp", WEBP)).toBeNull();
    // Mislabelled either way: a WebP served as JPEG, a JPEG served as WebP.
    expect(drawablePicture("image/jpeg", WEBP)).toBeNull();
    expect(drawablePicture("image/webp", JPEG)).toBeNull();
  });

  it("leaves out everything else it cannot draw, and photos that are too large", () => {
    for (const [header, body] of [["image/avif", AVIF], ["image/gif", GIF], ["image/svg+xml", bytes(ascii("<svg"))], ["text/html", bytes(ascii("<!doctype html>"))], [null, JPEG], ["image/jpeg", new Uint8Array(0)]] as const) {
      expect(drawablePicture(header, body), String(header)).toBeNull();
    }
    expect(drawablePicture("image/jpeg", bytes([0xff, 0xd8, 0xff], MAX_PHOTO_BYTES + 1))).toBeNull();
    expect(drawablePicture("image/jpeg", bytes([0xff, 0xd8, 0xff], MAX_PHOTO_BYTES))).not.toBeNull();
  });
});
