import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { hasImage, type Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { ImageResponse } from "next/og";

import { isProxiedImage, isStorageImage, PROXIED_IMAGE_HOSTS } from "@/features/directions/shared/remote-images";

import { drawablePicture, isDrawableHeader, MAX_PHOTO_BYTES } from "./og-picture";
import { initials } from "./story-card";

/**
 * Link previews (Open Graph images): the card WhatsApp, iMessage, X, LinkedIn or Slack shows when a
 * Linkyo address is shared. Drawn on the server from the page itself (photo, name, line, address)
 * in its template's colors and display face, so every share looks like the page it leads to.
 * Satori lays the card out; its style objects are pixels on a fixed 1200 × 630 canvas, not UI.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
const PHOTO_WIDTH = 470;

const fontFile = (path: string) => readFile(join(process.cwd(), "node_modules", path));

/** Faces the card can draw (Satori reads TTF/WOFF, not WOFF2): the display face per pairing, and Geist. */
const FONTS = Promise.all([
  fontFile("geist/dist/fonts/geist-sans/Geist-Regular.ttf").then((data) => ({ name: "Geist", data, weight: 400 as const })),
  fontFile("geist/dist/fonts/geist-sans/Geist-SemiBold.ttf").then((data) => ({ name: "Geist", data, weight: 600 as const })),
  fontFile("geist/dist/fonts/geist-sans/Geist-Black.ttf").then((data) => ({ name: "Geist", data, weight: 900 as const })),
  fontFile("@fontsource/anton/files/anton-latin-400-normal.woff").then((data) => ({ name: "Anton", data, weight: 400 as const })),
  fontFile("@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff").then((data) => ({ name: "Instrument Serif", data, weight: 400 as const })),
  fontFile("@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff").then((data) => ({ name: "Plex Arabic", data, weight: 700 as const })),
]);

/** The display face per pairing; faces that only ship as WOFF2 fall back to the closest one we can draw. */
const DISPLAY: Record<string, { family: string; weight: 400 | 700 | 900; width: number }> = {
  stage: { family: "Anton", weight: 400, width: 0.47 },
  editorial: { family: "Instrument Serif", weight: 400, width: 0.44 },
  elegant: { family: "Instrument Serif", weight: 400, width: 0.44 },
  arabic: { family: "Plex Arabic", weight: 700, width: 0.62 },
};
const FALLBACK_DISPLAY = { family: "Geist", weight: 900 as const, width: 0.58 };

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

/**
 * Platform hosts a card may take a photo from: the ones our image optimizer already re-serves, and
 * YouTube's channel pictures (prepared pages use them as the avatar). Exact hosts, https only.
 */
const PHOTO_HOSTS = new Set<string>([...PROXIED_IMAGE_HOSTS, "yt3.googleusercontent.com"]);

/**
 * A creator's photo on a platform or in our own Storage, fetched once when the card is drawn and
 * embedded, so whoever opens the card never contacts the platform. Only allowlisted hosts (and our
 * public media bucket), no redirects (they could lead off the list), JPEG or PNG up to 1.5 MB, five
 * seconds at most: anything else (a WebP upload, see og-picture.ts), or any error, gives no photo,
 * and the card shows the initials instead.
 */
async function remotePicture(src: string): Promise<string | null> {
  try {
    const url = new URL(src);
    if (!isProxiedImage(src) && !(url.protocol === "https:" && PHOTO_HOSTS.has(url.hostname))) return null;
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000), headers: { accept: "image/jpeg,image/png" } });
    const type = response.headers.get("content-type");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || !isDrawableHeader(type) || length > MAX_PHOTO_BYTES) {
      await response.body?.cancel();
      return null;
    }
    return drawablePicture(type, new Uint8Array(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * A photo as a data URL: a sample picture ("sample:<key>") from the bundled assets, an allowlisted
 * platform picture, or one the creator uploaded to our Storage.
 */
async function pictureData(src: string): Promise<string | null> {
  if (src.startsWith("https:") || isStorageImage(src)) return remotePicture(src);
  if (!src.startsWith("sample:")) return null;
  const key = src.slice("sample:".length);
  const candidates = [
    ...[".jpg", ".png"].flatMap((ext) => [join("examples", key + ext), join("samples", key + ext)]),
    ...(key.startsWith("star-") ? [join("stars", `${key.slice("star-".length)}.jpg`)] : []),
  ].map((path) => join(process.cwd(), "src/assets", path));
  const file = candidates.find((path) => existsSync(path));
  if (!file) return null;
  // Link previews are drawn at build time (static params), so the server bundle needs no assets.
  const data = await readFile(/*turbopackIgnore: true*/ file);
  return `data:${MIME[extname(file)] ?? "image/jpeg"};base64,${data.toString("base64")}`;
}

const LOGO = readFile(join(process.cwd(), "public/favicon.svg"), "utf8").then(
  (svg) => `data:image/svg+xml;base64,${Buffer.from(svg.replace(/@media[^}]*\}\}/, "")).toString("base64")}`,
);

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Arabic letters and the first of their presentation forms (isolated, then final, initial, medial),
 * with 4 forms for letters that join on both sides and 2 for those that join only to the right.
 */
const JOINING: readonly (readonly [number, number, 2 | 4])[] = [
  [0x0622, 0xfe81, 2], [0x0623, 0xfe83, 2], [0x0624, 0xfe85, 2], [0x0625, 0xfe87, 2], [0x0626, 0xfe89, 4],
  [0x0627, 0xfe8d, 2], [0x0628, 0xfe8f, 4], [0x0629, 0xfe93, 2], [0x062a, 0xfe95, 4], [0x062b, 0xfe99, 4],
  [0x062c, 0xfe9d, 4], [0x062d, 0xfea1, 4], [0x062e, 0xfea5, 4], [0x062f, 0xfea9, 2], [0x0630, 0xfeab, 2],
  [0x0631, 0xfead, 2], [0x0632, 0xfeaf, 2], [0x0633, 0xfeb1, 4], [0x0634, 0xfeb5, 4], [0x0635, 0xfeb9, 4],
  [0x0636, 0xfebd, 4], [0x0637, 0xfec1, 4], [0x0638, 0xfec5, 4], [0x0639, 0xfec9, 4], [0x063a, 0xfecd, 4],
  [0x0641, 0xfed1, 4], [0x0642, 0xfed5, 4], [0x0643, 0xfed9, 4], [0x0644, 0xfedd, 4], [0x0645, 0xfee1, 4],
  [0x0646, 0xfee5, 4], [0x0647, 0xfee9, 4], [0x0648, 0xfeed, 2], [0x0649, 0xfeef, 2], [0x064a, 0xfef1, 4],
  // Persian peh, tcheh, jeh, keheh, gaf and yeh, for Persian and Urdu names.
  [0x067e, 0xfb56, 4], [0x0686, 0xfb7a, 4], [0x0698, 0xfb8a, 2], [0x06a9, 0xfb8e, 4], [0x06af, 0xfb92, 4], [0x06cc, 0xfbfc, 4],
];
const FORMS = new Map(JOINING.map(([letter, first, forms]) => [letter, { first, dual: forms === 4 }]));
/** The tatweel (kashida) has no forms of its own but joins on both sides. */
const TATWEEL = 0x0640;
/** Lam followed by an alef becomes one ligature (isolated; the next code point is the final form). */
const LAM_ALEF: Partial<Record<number, number>> = { 0x0622: 0xfef5, 0x0623: 0xfef7, 0x0625: 0xfef9, 0x0627: 0xfefb };
/** Vowel signs, shadda and other marks sit on a letter and do not interrupt the joining. */
const MARK = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/;
/** Yeh, Farsi yeh and alef maksura: at the end of a word Plex Arabic tucks them under the letter before. */
const FINAL_YEH = new Set([0x064a, 0x06cc, 0x0649]);
/**
 * How much narrower (in em) Plex Arabic Bold, the only Arabic face the cards load, draws a final yeh
 * after these letters than their presentation forms measure: it tucks the yeh under a toothed letter
 * (beh, teh, noon, lam, kaf ...) and further under feh and qaf. Measured on Satori's output, e.g. the
 * preposition "fi" is 0.47 em narrower; every other letter pair measured within 0.16 em.
 */
const TUCK: Partial<Record<number, number>> = {
  0x0628: 0.25, 0x062a: 0.25, 0x062b: 0.25, 0x0626: 0.25, 0x0646: 0.25, 0x064a: 0.25, 0x06cc: 0.25, 0x067e: 0.25,
  0x0644: 0.25, 0x0643: 0.25, 0x06a9: 0.25, 0x0641: 0.45, 0x0642: 0.45, 0x0633: 0.1, 0x0634: 0.1,
};

/**
 * A word spelled in the presentation forms its letters take when joined, and how much narrower the
 * font draws it than those forms measure (only used to size a box).
 */
function joinedForms(word: string): { forms: string; tuck: number } {
  const chars = Array.from(word);
  const code = (index: number) => chars[index]?.codePointAt(0) ?? 0;
  const letterFrom = (index: number, step: 1 | -1) => {
    let at = index;
    while (at >= 0 && at < chars.length && MARK.test(chars[at] ?? "")) at += step;
    return at;
  };
  let out = "";
  let tuck = 0;
  for (let index = 0; index < chars.length; index += 1) {
    const form = FORMS.get(code(index));
    if (!form) {
      out += chars[index] ?? "";
      continue;
    }
    const before = code(letterFrom(index - 1, -1));
    const joinsBefore = before === TATWEEL || FORMS.get(before)?.dual === true;
    const next = letterFrom(index + 1, 1);
    const ligature = code(index) === 0x0644 ? LAM_ALEF[code(next)] : undefined;
    if (ligature !== undefined) {
      out += String.fromCodePoint(ligature + (joinsBefore ? 1 : 0)) + chars.slice(index + 1, next).join("");
      index = next;
      continue;
    }
    const joinsAfter = form.dual && (code(next) === TATWEEL || FORMS.has(code(next)));
    out += String.fromCodePoint(form.first + (joinsBefore ? (joinsAfter ? 3 : 1) : joinsAfter ? 2 : 0));
    if (joinsBefore && !joinsAfter && FINAL_YEH.has(code(index))) tuck += TUCK[before] ?? 0;
  }
  return { forms: out, tuck };
}

/**
 * One Arabic word in a box exactly as wide as its ink. Satori measures Arabic with the letters'
 * unjoined widths but draws them joined, so the box comes out far wider than the glyphs (Messi's
 * surname: 332 px for 232 px of ink at 100 px) and the glyphs sit at its left, off the right edge the
 * badge, name and line share. Spelled in presentation forms the word is measured as drawn: that copy,
 * invisible, sizes the box, and the real word (shaped by Satori) is drawn over it from the left.
 * A closing sign (".", "!", the Arabic comma) goes to the word's left end, where Arabic ends a sentence.
 */
function ArabicWord({ word }: { word: string }) {
  const [, core = word, tail = ""] = /^(.*?)([.!?\u060C\u061B\u061F\u2026:]*)$/u.exec(word) ?? [];
  const { forms, tuck } = joinedForms(core);
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse" }}>
      <div style={{ display: "flex", position: "relative" }}>
        <span style={{ color: "transparent", marginRight: `${-tuck}em` }}>{forms}</span>
        <span style={{ position: "absolute", top: 0, left: 0, whiteSpace: "nowrap" }}>{core}</span>
      </div>
      {tail ? <span>{tail}</span> : null}
    </div>
  );
}

/**
 * Satori has only partial bidi: it lays words out left to right and measures Arabic wrongly (see
 * ArabicWord). So right-to-left text is broken into lines here (by an estimate of the width), each
 * line is split into Arabic words and Latin runs ("Inter Miami"), and they are placed from the right
 * (row-reverse) with a word space between them, each keeping its own direction.
 */
export function RtlText({ text, size, width, style }: { text: string; size: number; width: number; style?: Record<string, string | number> }) {
  const words = text.split(/\s+/).filter(Boolean);
  // Plex Arabic averages about 0.6 em per character (measured), a little more to be safe.
  const perLine = Math.max(8, Math.floor(width / (size * 0.62)));
  const lines: string[][] = [];
  for (const word of words) {
    const line = lines.at(-1);
    if (line && [...line, word].join(" ").length <= perLine) line.push(word);
    else lines.push([word]);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: size, ...style }}>
      {lines.map((line, index) => {
        // Latin words form runs; signs like "·" stand alone, since Satori misplaces a neutral sign
        // next to Arabic.
        const runs: { kind: "arabic" | "latin" | "sign"; words: string[] }[] = [];
        for (const word of line) {
          const kind = ARABIC.test(word) ? "arabic" : /[A-Za-z0-9]/.test(word) ? "latin" : "sign";
          const last = runs.at(-1);
          if (last && kind === "latin" && last.kind === kind) last.words.push(word);
          else runs.push({ kind, words: [word] });
        }
        return (
          <div key={`${index}-${line.join(" ")}`} style={{ display: "flex", flexDirection: "row-reverse", columnGap: "0.25em" }}>
            {runs.map((run, at) =>
              run.kind === "arabic" ? <ArabicWord key={`${at}-${run.words.join(" ")}`} word={run.words.join(" ")} /> : <span key={`${at}-${run.words.join(" ")}`}>{run.words.join(" ")}</span>,
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Text in the page's direction: plain for left-to-right, word by word for right-to-left. */
function Words({ text, rtl, size, width, style }: { text: string; rtl: boolean; size: number; width: number; style: Record<string, string | number> }) {
  return rtl ? <RtlText text={text} size={size} width={width} style={style} /> : <div style={{ display: "flex", fontSize: size, maxWidth: width, ...style }}>{text}</div>;
}

export async function ogCard({ page, theme, address, badge }: { page: Page; theme: ResolvedCreatorTheme; address: string; badge?: string | undefined }) {
  const { profile } = page;
  const rtl = profile.locale === "ar";
  const { palette } = theme;
  const pairing = PAIRING_IDS.find((id) => creatorTokens.pairings[id] === theme.pairing) ?? "classic";
  const display = DISPLAY[pairing] ?? FALLBACK_DISPLAY;
  const upper = Boolean((theme.pairing.display as { uppercase?: boolean }).uppercase);
  const photoSource = profile.hero ?? profile.avatar;
  const [fonts, logo, photo] = await Promise.all([FONTS, LOGO, hasImage(photoSource) ? pictureData(photoSource.src) : Promise.resolve(null)]);
  const focal = photoSource.focal ? `${Math.round(photoSource.focal[0] * 100)}% ${Math.round(photoSource.focal[1] * 100)}%` : "50% 30%";

  // The name as large as two lines of the text column allow. The column is the same with or without
  // a photo (the initials take the photo's place), so a card without one is never half empty.
  const column = OG_SIZE.width - PHOTO_WIDTH - 2 * 72;
  const chars = Math.max(Array.from(profile.displayName).length, 4);
  // Latin names may take two lines; Arabic names stay on one (the line breaking above is an estimate).
  const nameSize = Math.round(Math.min(124, Math.max(56, (column * (rtl ? 0.95 : 1.85)) / (chars * display.width))));
  const line = profile.tagline ?? profile.bio;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: rtl ? "row-reverse" : "row", background: palette.bg, color: palette.fg, fontFamily: "Geist" }}>
        {photo ? (
          <div style={{ display: "flex", position: "relative", width: PHOTO_WIDTH, height: OG_SIZE.height }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> elements */}
            <img src={photo} alt="" width={PHOTO_WIDTH} height={OG_SIZE.height} style={{ objectFit: "cover", objectPosition: focal }} />
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundImage: `linear-gradient(to ${rtl ? "left" : "right"}, rgba(0,0,0,0) 62%, ${palette.bg})`,
              }}
            />
          </div>
        ) : (
          // No photo: the creator's initials on their accent color, as on the page and the story picture.
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: PHOTO_WIDTH, height: OG_SIZE.height }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 300,
                height: 300,
                borderRadius: 999,
                background: palette.accent,
                color: palette.accentFg,
                fontFamily: display.family,
                fontWeight: display.weight,
                fontSize: 132,
                lineHeight: 1,
              }}
            >
              {initials(profile.displayName)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: "64px 72px 56px", textAlign: rtl ? "right" : "left" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: rtl ? "flex-end" : "flex-start", gap: 22 }}>
            {badge ? (
              // 28 px: about 8 pt once a chat bubble shrinks the card, the smallest that still reads.
              <Words text={badge} rtl={rtl} size={28} width={column} style={{ padding: "10px 22px", borderRadius: 999, background: palette.surface2, color: palette.fgMuted, fontWeight: 600 }} />
            ) : null}
            <Words
              text={profile.displayName}
              rtl={rtl}
              size={nameSize}
              width={column}
              style={{
                fontFamily: display.family,
                fontWeight: display.weight,
                lineHeight: rtl ? 1.25 : 1.02,
                letterSpacing: display.family === "Geist" ? "-0.03em" : "0",
                textTransform: upper ? "uppercase" : "none",
              }}
            />
            {line ? <Words text={clip(line, 120)} rtl={rtl} size={30} width={column} style={{ lineHeight: 1.35, color: palette.fgMuted }} /> : null}
          </div>
          <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", padding: "14px 28px", borderRadius: 999, background: palette.accent, color: palette.accentFg, fontSize: 28, fontWeight: 600 }}>{address}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 30, fontWeight: 900, color: palette.fg, letterSpacing: "-0.03em" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> elements */}
              <img src={logo} alt="" width={38} height={38} />
              linkyo
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await Promise.resolve(fonts) },
  );
}
