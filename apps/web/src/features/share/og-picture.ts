/**
 * Which fetched photo a link preview card can draw. Satori (next/og) decodes JPEG and PNG only: a
 * WebP or AVIF picture would leave an empty or broken box on the card. Creators' own uploads are
 * often WebP (the dashboard stores pictures with transparency that way), so such a photo is left out
 * here and the card shows the creator's initials instead, as it does for a page without a photo.
 * Free of next/og and the file system, so the rule can be tested.
 */

export const MAX_PHOTO_BYTES = 1_500_000;

export type DrawableType = "image/jpeg" | "image/png";

/** JPEG or PNG by its first bytes; null for everything else (WebP, AVIF, GIF, SVG, HTML ...). */
export function drawableType(bytes: Uint8Array): DrawableType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "image/png";
  return null;
}

/** The media type a server named ("image/webp; charset=binary" → "image/webp"). */
export function mediaType(header: string | null): string {
  return header?.split(";")[0]?.trim().toLowerCase() ?? "";
}

/** Whether the server names a type the card can draw (checked before the body is read). */
export function isDrawableHeader(header: string | null): boolean {
  const type = mediaType(header);
  return type === "image/jpeg" || type === "image/png";
}

/**
 * A fetched photo as a data URL for the card, or null: the card then shows the initials. Both the
 * named type and the bytes must be JPEG or PNG (a mislabelled WebP is left out too), up to 1.5 MB.
 */
export function drawablePicture(header: string | null, bytes: Uint8Array): string | null {
  const type = drawableType(bytes);
  if (!isDrawableHeader(header) || !type || bytes.byteLength > MAX_PHOTO_BYTES) return null;
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}
