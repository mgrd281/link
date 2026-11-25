import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { tokens } from "@linkyo/tokens";
import { ImageResponse } from "next/og";

import { jpegCard } from "./jpeg";
import { OG_SIZE, RtlText } from "./og-card";

/**
 * The link preview of linkyo.app itself (home, gallery, sign-up): the promise in the brand colors,
 * next to three example pages. Drawn in pixels on Satori's fixed canvas, served as JPEG (its photos
 * made a PNG of over 400 KB, E-07).
 */
const dataUrl = (data: Buffer, mime: string) => `data:${mime};base64,${data.toString("base64")}`;

const FONTS = Promise.all([
  readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf")).then((data) => ({ name: "Geist", data, weight: 600 as const })),
  readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Black.ttf")).then((data) => ({ name: "Geist", data, weight: 900 as const })),
  readFile(join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff")).then((data) => ({ name: "Plex Arabic", data, weight: 700 as const })),
]);

/**
 * Three example pages fanned out on the right: name and photo. `focal` keeps each face in view in the
 * narrow cards, which crop the 4:5 portraits at the sides. Mara's face sits right of centre and the
 * middle card covers her card's right third, so her photo is pinned to its right edge: centred, the
 * card showed her only up to the nose.
 */
const PAGES = Promise.all(
  [
    { file: "ex4-motion-mara.jpg", name: "Mara Vale", focal: "100% 15%" },
    { file: "ex5-nela-voss.jpg", name: "Nela Voss", focal: "50% 20%" },
    { file: "ex4-motion-timo.jpg", name: "Timo Lacht", focal: "50% 20%" },
  ].map(async ({ file, name, focal }) => ({ name, focal, photo: dataUrl(await readFile(join(process.cwd(), "src/assets/examples", file)), "image/jpeg") })),
);

/** White tile with a teal y (generated with the logo): the card itself is Linkyo Teal. */
const LOGO = readFile(join(process.cwd(), "public/logo-on-teal.svg")).then((svg) => dataUrl(svg, "image/svg+xml"));

const v = tokens.color.teal;

export async function brandCard({ kicker, title1, title2, rtl }: { kicker: string; title1: string; title2: string; rtl: boolean }) {
  const [fonts, pages, logo] = await Promise.all([FONTS, PAGES, LOGO]);
  const font = rtl ? "Plex Arabic" : "Geist";
  const cardWidth = 230;
  const cardHeight = 340;
  const card = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: rtl ? "row-reverse" : "row",
          alignItems: "center",
          backgroundImage: `linear-gradient(135deg, ${v["950"]} 0%, ${v["700"]} 55%, ${v["600"]} 100%)`,
          color: tokens.color.white,
          fontFamily: font,
          padding: "0 72px",
        }}
      >
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: rtl ? "flex-end" : "flex-start", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Geist", fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> elements */}
            <img src={logo} alt="" width={46} height={46} />
            linkyo
          </div>
          {/* One wrapper per direction: Satori lays out React fragments unreliably. */}
          {rtl ? (
            // Arabic: the promise alone. Satori over-measures long Arabic runs, so a wrapped kicker would
            // not line up on the right; two short lines do.
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontWeight: 700, lineHeight: 1.3 }}>
              <RtlText text={title1} size={62} width={560} />
              <RtlText text={title2} size={62} width={560} style={{ color: v["300"] }} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 560 }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: v["200"] }}>{kicker}</div>
              <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.035em" }}>
                <span>{title1}</span>
                <span style={{ color: v["300"] }}>{title2}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", position: "relative", width: 520, height: 470 }}>
          {pages.map((page, index) => (
            <div
              key={page.name}
              style={{
                display: "flex",
                position: "absolute",
                left: 20 + index * 140,
                top: index === 1 ? 20 : 80,
                width: cardWidth,
                height: cardHeight,
                borderRadius: 28,
                overflow: "hidden",
                border: `4px solid ${tokens.color.white}`,
                transform: `rotate(${(index - 1) * 6}deg)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> elements */}
              <img src={page.photo} alt="" width={cardWidth} height={cardHeight} style={{ objectFit: "cover", objectPosition: page.focal }} />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  padding: "60px 18px 18px",
                  backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.75))",
                  fontFamily: "Geist",
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                }}
              >
                {page.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
  return jpegCard(card);
}
