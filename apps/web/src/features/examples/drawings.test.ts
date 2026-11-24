import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import de from "@/messages/de.json";

import { LOOKS } from "./looks";

/**
 * An example page's note says whose its pictures are. Where some are original Linkyo drawings (boards,
 * plans, screens; CREDITS.md says "Original Linkyo"), the note must not credit them to the
 * photographers: those looks carry `drawings`, and only those.
 */
describe("example pages with drawings", () => {
  const credits = readFileSync(path.resolve(import.meta.dirname, "../../assets/examples/CREDITS.md"), "utf8");
  const drawn = new Set([...credits.matchAll(/^\| (ex-pf-[a-z]+)-\d+\.jpg \| Original Linkyo/gm)].map((match) => match[1]));

  it("finds the drawn pictures in the credits", () => {
    expect([...drawn].sort()).toEqual(["ex-pf-ines", "ex-pf-rana", "ex-pf-tobin"]);
  });

  it("mark exactly the looks whose pictures include Linkyo drawings", () => {
    // The looks that credit photographers are the portfolio examples (their pictures are their work).
    const portfolios = Object.entries(LOOKS).filter(([, look]) => "credit" in look);
    expect(portfolios.length).toBeGreaterThan(5);
    for (const [slug, look] of portfolios) {
      const prefix = `ex-pf-${slug.split("-")[0] ?? ""}`;
      expect("drawings" in look, slug).toBe(drawn.has(prefix));
    }
  });

  it("say so in the note", () => {
    expect(de.preview.samplePicturesDrawn).toContain("Zeichnungen");
    expect(de.preview.samplePictures).not.toContain("Zeichnungen");
  });
});
