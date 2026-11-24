import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { tokens } from "@linkyo/tokens";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { EXAMPLES } from "@/features/examples/catalog";
import { portfolioExamples } from "@/features/marketing/portfolio/model";
import { OG_SIZE, RtlText } from "@/features/share/og-card";
import { routing } from "@/i18n/routing";

/**
 * The link preview of /portfolio: the promise in Linkyo Teal beside two real portfolio pages on
 * phones (the first screens the homepage band shows). Drawn in pixels on Satori's fixed canvas; the
 * Arabic lines are placed word by word (RtlText), so they keep their shape and order.
 */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Linkyo Portfolio";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const dataUrl = (data: Buffer, mime: string) => `data:${mime};base64,${data.toString("base64")}`;

const FONTS = Promise.all([
  readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf")).then((data) => ({ name: "Geist", data, weight: 600 as const })),
  readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Black.ttf")).then((data) => ({ name: "Geist", data, weight: 900 as const })),
  readFile(join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff")).then((data) => ({ name: "Plex Arabic", data, weight: 700 as const })),
]);

/** White tile with a teal y (generated with the logo): the card itself is Linkyo Teal. */
const LOGO = readFile(join(process.cwd(), "public/logo-on-teal.svg")).then((svg) => dataUrl(svg, "image/svg+xml"));

/** The first two portfolio pages that have a phone picture (src/assets/marketing/examples). */
const PAGES = Promise.all(
  portfolioExamples().map(async (slug) => {
    const file = await readFile(join(process.cwd(), "src/assets/marketing/examples", `${slug}.jpg`)).catch(() => null);
    return file ? [{ name: EXAMPLES[slug]?.profile.displayName ?? slug, shot: dataUrl(file, "image/jpeg") }] : [];
  }),
).then((found) => found.flat().slice(0, 2));

const v = tokens.color.teal;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const rtl = locale === "ar";
  const t = await getTranslations({ locale, namespace: "portfolioLanding.hero" });
  const [fonts, logo, pages] = await Promise.all([FONTS, LOGO, PAGES]);
  const phoneWidth = 214;
  const phoneHeight = Math.round((phoneWidth * 844) / 390);
  return new ImageResponse(
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
          fontFamily: rtl ? "Plex Arabic" : "Geist",
          padding: "0 72px",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: rtl ? "flex-end" : "flex-start", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Geist", fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em" }}>
            <img src={logo} alt="" width={46} height={46} />
            linkyo
          </div>
          {rtl ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 18 }}>
              <RtlText text={t("eyebrow")} size={28} width={560} style={{ color: v["200"] }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontWeight: 700, lineHeight: 1.3 }}>
                <RtlText text={t("title1")} size={64} width={600} />
                <RtlText text={t("title2")} size={64} width={600} style={{ color: v["300"] }} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 600 }}>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: v["200"] }}>{t("eyebrow")}</div>
              <div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.035em" }}>
                <span>{t("title1")}</span>
                <span style={{ color: v["300"] }}>{t("title2")}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", position: "relative", width: 470, height: 630 }}>
          {pages.map((page, index) => (
            <div
              key={page.name}
              style={{
                display: "flex",
                position: "absolute",
                left: index === 0 ? 10 : 236,
                top: index === 0 ? 70 : 150,
                width: phoneWidth,
                height: phoneHeight,
                borderRadius: 30,
                overflow: "hidden",
                border: `8px solid ${tokens.color.ink}`,
                backgroundColor: tokens.color.ink,
              }}
            >
              <img src={page.shot} alt="" width={phoneWidth - 16} height={phoneHeight - 16} style={{ objectFit: "cover", objectPosition: "top", borderRadius: 22 }} />
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
