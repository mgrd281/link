import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { tokens } from "@linkyo/tokens";
import { ImageResponse } from "next/og";

import { OG_SIZE, RtlText } from "./og-card";

/**
 * The link preview of a page of the website (help, contact, features, about, changelog, security):
 * Linkyo's mark, the page's name and its title, in the site card's Linkyo Teal (brand-card.tsx). Words
 * only, no photo, so it stays a small PNG. Arabic lines are placed word by word (RtlText, og-card.tsx),
 * so they keep their shape and order. Pixels on Satori's fixed 1200 × 630 canvas.
 */
const dataUrl = (data: Buffer, mime: string) => `data:${mime};base64,${data.toString("base64")}`;

const FONTS = Promise.all([
  readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf")).then((data) => ({ name: "Geist", data, weight: 600 as const })),
  readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Black.ttf")).then((data) => ({ name: "Geist", data, weight: 900 as const })),
  readFile(join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff")).then((data) => ({ name: "Plex Arabic", data, weight: 700 as const })),
]);

/** White tile with a teal y (generated with the logo): the card itself is Linkyo Teal. */
const LOGO = readFile(join(process.cwd(), "public/logo-on-teal.svg")).then((svg) => dataUrl(svg, "image/svg+xml"));

const v = tokens.color.teal;

export async function pageCard({ kicker, title, rtl }: { kicker: string; title: string; rtl: boolean }) {
  const [fonts, logo] = await Promise.all([FONTS, LOGO]);
  // As large as about three lines of the card allow (Geist Black averages about 0.56 em).
  const chars = Math.max(Array.from(title).length, 8);
  const size = Math.round(Math.min(96, Math.max(56, (1000 * 2.4) / (chars * 0.56))));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: rtl ? "flex-end" : "flex-start",
          backgroundImage: `linear-gradient(135deg, ${v["950"]} 0%, ${v["700"]} 55%, ${v["600"]} 100%)`,
          color: tokens.color.white,
          fontFamily: rtl ? "Plex Arabic" : "Geist",
          padding: "72px 88px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Geist", fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> elements */}
          <img src={logo} alt="" width={46} height={46} />
          linkyo
        </div>
        {/* One wrapper per direction: Satori lays out React fragments unreliably. */}
        {rtl ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 22, fontWeight: 700, lineHeight: 1.3 }}>
            <RtlText text={kicker} size={34} width={980} style={{ color: v["200"] }} />
            <RtlText text={title} size={Math.min(size, 76)} width={1000} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: v["200"] }}>{kicker}</div>
            <div style={{ display: "flex", fontSize: size, fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.035em" }}>{title}</div>
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
