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
export const plexArabic = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-face-plex-arabic",
  display: "swap",
  preload: false,
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
]
  .map((font) => font.variable)
  .join(" ");
