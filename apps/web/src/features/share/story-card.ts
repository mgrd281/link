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

/**
 * Where a story's text must end. Instagram lays its reply bar and link stickers over roughly the
 * bottom 250 px of a 1080 × 1920 story (Meta asks to keep about 14 % at the top and the bottom free),
 * so the address pill, the one thing to remember, ends above this line.
 */
export const STORY_SAFE_BOTTOM = 1670;
/** The quiet "linkyo" at the foot is left out rather than drawn under the reply bar: the pill already says linkyo.app. */
const STORY_FOOT_LIMIT = 1660;

// The story stack sits higher than the post's: the photo band ends at 1120 so name, line and pill
// all fit above STORY_SAFE_BOTTOM; the top 250 px hold nothing but the photo (or the monogram).
const LAYOUT: Record<ShareFormat, { photo: number; name: number; minName: number; nameY: number; line: number; pillY: number; footY: number }> = {
  story: { photo: 1120, name: 160, minName: 84, nameY: 1190, line: 44, pillY: 1450, footY: 1560 },
  post: { photo: 820, name: 132, minName: 72, nameY: 900, line: 38, pillY: 1170, footY: 1290 },
};
const SIDE = 80;

const ARABIC_LETTER = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

/**
 * Up to two initials, for creators without a photo. An Arabic name gets one letter: Arabic letters
 * join, so two initials side by side read as a word of their own ("سلمى رحّال" would become "سر",
 * "secret"). It lives here, free of React, so the server-drawn link preview card can use it too.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = Array.from(words[0] ?? "")[0] ?? "";
  if (ARABIC_LETTER.test(first)) return first;
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]];
  return letters
    .map((word) => Array.from(word ?? "")[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

/** Where the text under the name goes: baselines of the line about them, the pill, and the foot (null: left out). */
export interface StoryStack {
  lineYs: number[];
  pillY: number;
  pillHeight: number;
  footY: number | null;
}

/**
 * The vertical stack under the photo, kept pure so it can be tested without a canvas. `descent` is how
 * far the name's last line reaches below its baseline (measured with the name's font): Arabic letters
 * and a "g" or "y" reach deep, and the first line about them starts below them instead of on them.
 */
export function storyStack(format: ShareFormat, { nameLines, nameSize, lineCount, descent }: { nameLines: number; nameSize: number; lineCount: number; descent: number }): StoryStack {
  const layout = LAYOUT[format];
  const deep = Number.isFinite(descent) ? Math.max(0, descent) : 0;
  let y = layout.nameY + (Math.max(1, nameLines) - 1) * nameSize * 0.98;
  const lineYs: number[] = [];
  for (let index = 0; index < lineCount; index += 1) {
    y += index === 0 ? Math.max(layout.line * 1.45, deep + layout.line * 0.9) : layout.line * 1.45;
    lineYs.push(y + layout.line * 0.4);
  }
  const pillHeight = Math.round(layout.line * 2.3);
  const pillY = Math.max(layout.pillY, y + layout.line * 2.2);
  if (format === "post") return { lineYs, pillY, pillHeight, footY: layout.footY };
  // A long name or line pushes the pill down; the foot follows it, and is left out once it would sit
  // in the zone Instagram covers.
  const footY = Math.max(layout.footY, pillY + pillHeight / 2 + layout.line * 1.6);
  return { lineYs, pillY, pillHeight, footY: footY > STORY_FOOT_LIMIT ? null : footY };
}

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
  // Measured while the name's font is still set: how deep its last line reaches below the baseline.
  const descent = context.measureText(nameLines.at(-1) ?? "").actualBoundingBoxDescent;

  // One line about them.
  context.font = `400 ${layout.line}px ${art.body}`;
  const lines = art.line ? wrap(context, art.line, width - 2 * SIDE - 40, 2) : [];
  const { lineYs, pillY, pillHeight, footY } = storyStack(format, { nameLines: nameLines.length, nameSize: size, lineCount: lines.length, descent });
  context.fillStyle = colors.muted;
  lineYs.forEach((lineY, index) => context.fillText(lines[index] ?? "", width / 2, lineY));

  // The address on an accent pill: the one thing to remember.
  context.direction = "ltr";
  context.font = `600 ${Math.round(layout.line * 1.05)}px ${art.body}`;
  const label = art.address;
  const pillWidth = Math.min(width - 2 * SIDE, context.measureText(label).width + pillHeight * 1.1);
  context.fillStyle = colors.accent;
  context.beginPath();
  context.roundRect((width - pillWidth) / 2, pillY - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
  context.fill();
  context.fillStyle = colors.accentFg;
  context.textBaseline = "middle";
  context.fillText(label, width / 2, pillY + 2);

  // A quiet credit at the foot, where there is room for it.
  if (footY === null) return;
  context.font = `700 ${Math.round(layout.line * 0.72)}px ${art.body}`;
  context.fillStyle = colors.muted;
  context.fillText("linkyo", width / 2, footY);
}

/** The page's faces load on use: load them before drawing (the canvas would fall back silently). */
export function loadFaces(display: string, displayWeight: string, body: string): Promise<unknown> {
  return Promise.all([document.fonts.load(`${displayWeight} 100px ${display}`), document.fonts.load(`600 40px ${body}`)]).catch(() => undefined);
}
