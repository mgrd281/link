import localFont from "next/font/local";

/**
 * Self-hosted fonts (GDPR: no Google Fonts CDN). Each exposes `--font-face-<id>`, which the token
 * font stacks reference (see @linkyo/tokens). Only Geist is preloaded; creator faces load on use.
 */
export const geist = localFont({
  src: "../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-face-geist",
  weight: "100 900",
  display: "swap",
});
export const geistMono = localFont({
  src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-face-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});
/*
 * Arabic faces carry a `unicode-range` of Arabic letters plus the word spaces (U+0020, U+00A0), the
 * joiners and marks U+200C–U+200F and the hyphen U+2010: no Latin letter or digit, so a page downloads
 * them only when it has Arabic text to set (a German page never does: Geist and its local fallback draw
 * its spaces first). The spaces stay in: a stack that starts with an Arabic face (every Arabic creator
 * page, the Arabic pairing) draws the gaps between Arabic words in that face, as before the range (the
 * Plex file maps nothing else outside it). next/font needs the value written out in each call.
 */
export const plexArabic = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-face-plex-arabic",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-2010, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});

/*
 * Arabic companions of the creator pairings (C-03, @linkyo/tokens `creator.pairing.*.arabic`). On an
 * Arabic page each sits before its template's Latin stack; the unicode-range sends Latin letters and
 * digits on to the Latin face and keeps the spaces between Arabic words in the Arabic face (a
 * monospace or wide Latin space would pull an Arabic sentence apart). No metric fallback
 * (`adjustFontFallback: false`): the generated one is local Arial with every Latin glyph, and it would
 * take the Latin text away from the template's face. Vendored OFL files (Arabic subset only), licences
 * next to them in assets/fonts.
 */
export const arabicPlex = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-face-arabic-plex",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-2010, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});
export const arabicLalezar = localFont({
  src: "./assets/fonts/lalezar/lalezar-arabic-400-normal.woff2",
  variable: "--font-face-arabic-lalezar",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-2010, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});
export const arabicRakkas = localFont({
  src: "./assets/fonts/rakkas/rakkas-arabic-400-normal.woff2",
  variable: "--font-face-arabic-rakkas",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-2010, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});
export const arabicAmiri = localFont({
  src: [
    { path: "./assets/fonts/amiri/amiri-arabic-400-normal.woff2", weight: "400" },
    { path: "./assets/fonts/amiri/amiri-arabic-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-face-arabic-amiri",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-2010, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});
export const arabicReadex = localFont({
  src: [
    { path: "./assets/fonts/readex-pro/readex-pro-arabic-400-normal.woff2", weight: "400" },
    { path: "./assets/fonts/readex-pro/readex-pro-arabic-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-face-arabic-readex",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-2010, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});
export const arabicChanga = localFont({
  src: "./assets/fonts/changa/changa-arabic-700-normal.woff2",
  variable: "--font-face-arabic-changa",
  weight: "700",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-2010, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});
export const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-face-inter",
  weight: "100 900",
  display: "swap",
  preload: false,
});
export const anton = localFont({
  src: "../node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2",
  variable: "--font-face-anton",
  weight: "400",
  display: "swap",
  preload: false,
});
export const instrumentSerif = localFont({
  src: "../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2",
  variable: "--font-face-instrument-serif",
  weight: "400",
  display: "swap",
  preload: false,
});
export const spaceGrotesk = localFont({
  src: "../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  variable: "--font-face-space-grotesk",
  weight: "300 700",
  display: "swap",
  preload: false,
});
export const bricolage = localFont({
  src: "../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-face-bricolage",
  weight: "200 800",
  display: "swap",
  preload: false,
});
export const playfair = localFont({
  src: "../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2",
  variable: "--font-face-playfair",
  weight: "400 900",
  display: "swap",
  preload: false,
});
export const lato = localFont({
  src: [
    { path: "../node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-face-lato",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  geist,
  geistMono,
  plexArabic,
  inter,
  anton,
  instrumentSerif,
  spaceGrotesk,
  bricolage,
  playfair,
  lato,
  arabicPlex,
  arabicLalezar,
  arabicRakkas,
  arabicAmiri,
  arabicReadex,
  arabicChanga,
]
  .map((font) => font.variable)
  .join(" ");
