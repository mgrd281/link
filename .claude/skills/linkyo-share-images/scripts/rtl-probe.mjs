// Measures how Satori orders words: node rtl-probe.mjs  (run from the repo root)
// Draws each test line, then prints the x-position and width of every inked word.
// A short word (ب) next to a long one (الاستقلال) shows the order without reading Arabic.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const W = join(process.cwd(), "apps/web/node_modules");
const { ImageResponse } = await import(join(W, "next/dist/compiled/@vercel/og/index.node.js"));
const React = (await import(join(W, "react/index.js"))).default;
const h = React.createElement;
const fonts = [
  { name: "Geist", data: await readFile(join(W, "geist/dist/fonts/geist-sans/Geist-Black.ttf")), weight: 700 },
  { name: "Plex", data: await readFile(join(W, "@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff")), weight: 700 },
];
const cases = process.argv.slice(2).length ? process.argv.slice(2) : ["ب الاستقلال", "ب الاستقلال", "ب · الاستقلال"];
const element = h(
  "div",
  { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#000", color: "#fff", padding: 20, fontFamily: "Plex, Geist", fontSize: 60 } },
  ...cases.map((text) => h("div", { style: { display: "flex", height: 100 } }, text)),
);
const png = Buffer.from(await new ImageResponse(element, { width: 1000, height: 40 + cases.length * 100, fonts }).arrayBuffer());
await writeFile("rtl-probe.png", png);
console.log("Wrote rtl-probe.png. Measure ink columns per row (e.g. with Pillow) to get word order:");
console.log("correct right-to-left = the first logical word is the rightmost segment.");
