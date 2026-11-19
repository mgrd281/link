/**
 * Pictures to post (Instagram story 9:16, feed post 4:5): the creator's photo melting into the page
 * color, the name in the template's display face, one line, and the address on an accent pill.
 * Drawn on a <canvas> in the browser, so it uses the fonts and colors the page already has, Arabic
 * shaping and right-to-left included. Pixel values describe the fixed canvas, not the UI.
 */
export type ShareFormat = "story" | "post";

export const SHARE_SIZES: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
};

export interface ShareArt {
  name: string;
  line?: string | undefined;
  address: string;
  photo: HTMLImageElement | null;
  /** Where the photo stays in view when cropped (0–1, 0–1). */
  focal?: readonly [number, number] | undefined;
  colors: { bg: string; fg: string; muted: string; accent: string; accentFg: string; surface: string };
  /** Resolved CSS font-family lists of the page's display and body faces. */
  display: string;
  displayWeight: string;
  body: string;
  upper: boolean;
  rtl: boolean;
  grey: boolean;
  initials: string;
}

const LAYOUT: Record<ShareFormat, { photo: number; name: number; minName: number; nameY: number; line: number; pillY: number; footY: number }> = {
  story: { photo: 1240, name: 168, minName: 84, nameY: 1300, line: 44, pillY: 1640, footY: 1840 },
  post: { photo: 820, name: 132, minName: 72, nameY: 900, line: 38, pillY: 1170, footY: 1290 },
};
const SIDE = 80;

/** Splits text into at most `max` lines that fit `width`; the last one ends with "…" if cut. */
function wrap(context: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= width || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1] ?? "";
  while (last && context.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

function coverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, focal: readonly [number, number]) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - drawWidth) * focal[0], (height - drawHeight) * focal[1], drawWidth, drawHeight);
}

export function drawShareArt(canvas: HTMLCanvasElement, format: ShareFormat, art: ShareArt) {
  const { width, height } = SHARE_SIZES[format];
  const layout = LAYOUT[format];
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const { colors } = art;
  context.direction = art.rtl ? "rtl" : "ltr";
  context.textAlign = "center";
  context.fillStyle = colors.bg;
  context.fillRect(0, 0, width, height);

  // Photo, melting into the page color (as on the page itself).
  if (art.photo) {
    context.save();
    // Only the photo band: the fade below needs plain page color under it.
    context.beginPath();
    context.rect(0, 0, width, layout.photo);
    context.clip();
    if (art.grey) context.filter = "grayscale(1)";
    coverImage(context, art.photo, width, layout.photo, art.focal ?? [0.5, 0.3]);
    context.restore();
    const fade = context.createLinearGradient(0, layout.photo * 0.5, 0, layout.photo);
    fade.addColorStop(0, `${colors.bg}00`);
    fade.addColorStop(1, colors.bg);
    context.fillStyle = fade;
    context.fillRect(0, 0, width, layout.photo + 2);
  } else {
    const radius = layout.photo * 0.22;
    context.fillStyle = colors.accent;
    context.beginPath();
    context.arc(width / 2, layout.photo * 0.5, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = colors.accentFg;
    context.font = `${art.displayWeight} ${Math.round(radius * 0.9)}px ${art.display}`;
    context.textBaseline = "middle";
    context.fillText(art.initials, width / 2, layout.photo * 0.5);
  }
  context.textBaseline = "alphabetic";

  // Name: as large as fits one line, two lines for long names.
  const name = art.upper ? art.name.toLocaleUpperCase() : art.name;
  let size = layout.name;
  context.font = `${art.displayWeight} ${size}px ${art.display}`;
  while (size > layout.minName && context.measureText(name).width > width - 2 * SIDE) {
    size -= 4;
    context.font = `${art.displayWeight} ${size}px ${art.display}`;
  }
  context.fillStyle = colors.fg;
  const nameLines = wrap(context, name, width - 2 * SIDE, 2);
  nameLines.forEach((text, index) => context.fillText(text, width / 2, layout.nameY + index * size * 0.98));
  let y = layout.nameY + (nameLines.length - 1) * size * 0.98;

  // One line about them.
  if (art.line) {
    context.font = `400 ${layout.line}px ${art.body}`;
    context.fillStyle = colors.muted;
    for (const text of wrap(context, art.line, width - 2 * SIDE - 40, 2)) {
      y += layout.line * 1.45;
      context.fillText(text, width / 2, y + layout.line * 0.4);
    }
  }

  // The address on an accent pill: the one thing to remember.
  context.direction = "ltr";
  context.font = `600 ${Math.round(layout.line * 1.05)}px ${art.body}`;
  const label = art.address;
  const pillHeight = Math.round(layout.line * 2.3);
  const pillWidth = Math.min(width - 2 * SIDE, context.measureText(label).width + pillHeight * 1.1);
  const pillY = Math.max(layout.pillY, y + layout.line * 2.2);
  context.fillStyle = colors.accent;
  context.beginPath();
  context.roundRect((width - pillWidth) / 2, pillY - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
  context.fill();
  context.fillStyle = colors.accentFg;
  context.textBaseline = "middle";
  context.fillText(label, width / 2, pillY + 2);

  // A quiet credit at the foot.
  context.font = `700 ${Math.round(layout.line * 0.72)}px ${art.body}`;
  context.fillStyle = colors.muted;
  context.fillText("linkyo", width / 2, layout.footY);
}

/** The page's faces load on use: load them before drawing (the canvas would fall back silently). */
export function loadFaces(display: string, displayWeight: string, body: string): Promise<unknown> {
  return Promise.all([document.fonts.load(`${displayWeight} 100px ${display}`), document.fonts.load(`600 40px ${body}`)]).catch(() => undefined);
}
