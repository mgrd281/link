import type { LaidDocument } from "./layout/types";
import type { MiniatureMark } from "./offer";
import { MINIATURE, mm, toMm } from "./print-tokens";

/**
 * A document's first page as the page's miniature draws it (PaperMiniature): every text run a bar of
 * its measured width and a share of its type size tall, sitting on its baseline; the accent rule and
 * the skills' squares in the accent; a photo as a grey box. Contact values (phone, e-mail, address)
 * become bars of one fixed width, so the page's HTML holds no contact data, not even its length.
 * Numbers and tones only: no text, ever. Millimetres on the A4 sheet, rounded to 0.1 mm.
 */
export function miniatureOf(document: LaidDocument): MiniatureMark[] {
  const page = document.pages[0];
  if (!page) return [];
  const round = (points: number) => Math.round(toMm(points) / MINIATURE.precision) * MINIATURE.precision;
  const fixed = (value: number) => Number(value.toFixed(1));
  const mark = (x: number, y: number, w: number, h: number, tone: MiniatureMark["tone"]): MiniatureMark => ({
    x: fixed(round(x)),
    y: fixed(round(y)),
    w: fixed(Math.max(MINIATURE.precision, round(w))),
    h: fixed(Math.max(MINIATURE.precision, round(h))),
    tone,
  });
  return page.boxes.flatMap((box): MiniatureMark[] => {
    switch (box.kind) {
      case "text": {
        if (box.text.trim() === "") return [];
        const height = box.style.size * MINIATURE.barHeight;
        const width = box.contact ? mm(MINIATURE.contactBar) : box.width;
        const tone: MiniatureMark["tone"] =
          box.style.tone === "accent" ? "accent" : box.style.tone === "muted" ? "muted" : box.style.face === "regular" ? "strong" : "ink";
        return [mark(box.x, box.y - height, width, height, tone)];
      }
      case "rect":
        return [mark(box.x, box.y, box.w, box.h, box.tone === "accent" ? "accent" : "strong")];
      case "image":
        return [mark(box.x, box.y, box.w, box.h, "strong")];
      default:
        return [];
    }
  });
}
