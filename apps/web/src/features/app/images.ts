/**
 * Images picked in the dashboard are resized in the browser before they are stored, so pages stay
 * fast and the demo storage (a few MB) lasts. Photos become JPEG; logos keep transparency (WebP/PNG).
 * Real accounts upload the resized picture to Supabase Storage (EU, media-upload.ts) and keep its
 * address; our image optimizer serves the sizes.
 */

export const IMAGE_SIDE = { avatar: 512, photo: 1080, logo: 640, thumb: 480, work: 2400 } as const;
export type ImageKind = keyof typeof IMAGE_SIDE;

/**
 * Work pictures (a project's cover and pictures): 2400 px with real accounts, whose pictures live in
 * Storage; 1080 px in the demo, whose pictures are data URLs in this browser's few MB.
 */
export const workImageKind = (real: boolean): ImageKind => (real ? "work" : "photo");

/** Pictures one project holds: 20, or 6 in the demo (the same storage reason). */
export const projectPictureLimit = (real: boolean): number => (real ? 20 : 6);

/** A prepared picture as a page keeps it: its address, tone and measured size (`w`/`h`). */
export const storedImage = (prepared: PreparedImage, alt = ""): { src: string; alt: string; tone: "light" | "dark"; w: number; h: number } => ({
  src: prepared.src,
  alt,
  tone: prepared.tone,
  w: Math.min(8192, Math.max(1, Math.round(prepared.width))),
  h: Math.min(8192, Math.max(1, Math.round(prepared.height))),
});

export interface PreparedImage {
  src: string;
  tone: "light" | "dark";
  width: number;
  height: number;
}

const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export class ImageError extends Error {
  constructor(readonly reason: "type" | "size" | "decode" | "upload") {
    super(reason);
  }
}

/** Average luminance of a tiny copy decides whether the photo reads as light or dark. */
function measureTone(bitmap: ImageBitmap): "light" | "dark" {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "dark";
  context.drawImage(bitmap, 0, 0, 16, 16);
  const { data } = context.getImageData(0, 0, 16, 16);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
  return sum / (data.length / 4) > 150 ? "light" : "dark";
}

export async function prepareImage(file: File, kind: ImageKind): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new ImageError("type");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("size");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError("decode");
  }
  const max = IMAGE_SIDE[kind];
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageError("decode");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  const tone = measureTone(bitmap);
  bitmap.close();
  const keepAlpha = kind === "logo" || file.type === "image/png" || file.type === "image/svg+xml" || file.type === "image/webp";
  const src = keepAlpha ? canvas.toDataURL("image/webp", 0.9) : canvas.toDataURL("image/jpeg", 0.82);
  return { src, tone, width, height };
}

/**
 * Resizes a picked picture and keeps it where the account keeps pictures: Storage for real accounts,
 * the page itself in the demo. A failed upload is an `ImageError("upload")`. `owner` names another
 * account's media folder (`useMediaOwner`: the team's proposal editor stores under the customer).
 */
export async function prepareAndStore(file: File, kind: ImageKind, owner?: string | null): Promise<PreparedImage> {
  const prepared = await prepareImage(file, kind);
  try {
    // Loaded on first use: the website's playground resizes pictures too, without any account code.
    const { mediaDepsFor, storePreparedImage } = await import("./media-upload");
    return await (owner ? storePreparedImage(prepared, mediaDepsFor(owner)) : storePreparedImage(prepared));
  } catch {
    throw new ImageError("upload");
  }
}

/** Lets someone pick files without a visible input (the trigger is a real button). */
export function pickFiles(options: { multiple?: boolean; accept?: string } = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = options.accept ?? "image/*";
    input.multiple = options.multiple ?? false;
    input.addEventListener("change", () => resolve(Array.from(input.files ?? [])), { once: true });
    input.addEventListener("cancel", () => resolve([]), { once: true });
    input.click();
  });
}
