import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

import { TEMPLATE_PREVIEWS } from "./template-previews";

const ASSETS = path.resolve(import.meta.dirname, "../../../assets/templates");

describe("template previews", () => {
  it("has a captured first screen for every template, and nothing else", () => {
    const missing = TEMPLATE_IDS.filter((id) => !TEMPLATE_PREVIEWS[id] || !existsSync(path.join(ASSETS, `${id}.webp`)));
    expect(missing, "capture with: node scripts/capture-example-shots.mjs template:<id>, then import it in template-previews.ts").toEqual([]);
    const files = readdirSync(ASSETS).filter((file) => file.endsWith(".webp")).map((file) => file.replace(/\.webp$/, ""));
    expect(files.sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  it("are WebP files of a sensible size", () => {
    for (const id of TEMPLATE_IDS) {
      const bytes = readFileSync(path.join(ASSETS, `${id}.webp`));
      // "RIFF" … "WEBP"
      expect(bytes.subarray(0, 4).toString("latin1"), id).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("latin1"), id).toBe("WEBP");
      expect(bytes.length, id).toBeLessThan(120_000);
    }
  });
});
