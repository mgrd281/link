import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { hasImage, type Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { ImageResponse } from "next/og";

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

/** A sample picture ("sample:<key>") as a data URL, read from the bundled assets. */
async function pictureData(src: string): Promise<string | null> {
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
 * Satori has only partial bidi: at plain spaces it breaks text into words and lays them out left to
 * right. Measured on the renderer, an Arabic run whose words are joined by no-break spaces is shaped
 * and ordered right to left with natural spacing. So right-to-left text is broken into lines here
 * (by an estimate of the width), each line is split into Arabic and Latin runs, the runs are placed
 * from the right (row-reverse), and each run keeps its own direction.
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
        // Arabic words and Latin words ("Inter Miami") form runs; signs like "·" stand alone, since
        // Satori misplaces a neutral sign inside an Arabic run.
        const runs: { kind: "arabic" | "latin" | "sign"; words: string[] }[] = [];
        for (const word of line) {
          const kind = ARABIC.test(word) ? "arabic" : /[A-Za-z0-9]/.test(word) ? "latin" : "sign";
          const last = runs.at(-1);
          if (last && kind !== "sign" && last.kind === kind) last.words.push(word);
          else runs.push({ kind, words: [word] });
        }
        return (
          <div key={`${index}-${line.join(" ")}`} style={{ display: "flex", flexDirection: "row-reverse", columnGap: "0.25em" }}>
            {runs.map((run, at) => (
              <span key={`${at}-${run.words.join(" ")}`}>{run.kind === "arabic" ? run.words.join("\u00A0") : run.words.join(" ")}</span>
            ))}
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

  // The name as large as two lines of the text column allow.
  const column = OG_SIZE.width - (photo ? PHOTO_WIDTH : 0) - 2 * 72;
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
        ) : null}
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: "64px 72px 56px", textAlign: rtl ? "right" : "left" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: rtl ? "flex-end" : "flex-start", gap: 22 }}>
            {badge ? (
              <Words text={badge} rtl={rtl} size={22} width={column} style={{ padding: "8px 18px", borderRadius: 999, background: palette.surface2, color: palette.fgMuted, fontWeight: 600 }} />
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
