import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

/**
 * The AI run on /design is a specimen with test data. It has its own heading and description
 * (`design.aiRun`); the homepage's offer ("the first draft is free") does not belong on it.
 */
describe("the AI run section of the design page", () => {
  it("is headed and described by its own words, in the section and in the table of contents", () => {
    const specimen = source("./ai-run-specimen.tsx");
    expect(specimen).toContain('useTranslations("design.aiRun")');
    expect(specimen).not.toContain("marketing.try.ai");
    const page = source("../../app/[locale]/design/page.tsx");
    expect(page).toContain('t("aiRun.title")');
    expect(page).not.toContain("marketing.try.ai");
  });

  it.each([
    ["de", de, /Testdaten/, /kostenlos/],
    ["en", en, /test data/i, /free/i],
    ["ar", ar, /بيانات/, /مجان/],
  ] as const)("%s: says it runs on test data and makes no offer", (_locale, messages, says, offer) => {
    expect(messages.design.aiRun.title.trim()).not.toBe("");
    expect(messages.design.aiRun.description).toMatch(says);
    expect(messages.design.aiRun.description).not.toMatch(offer);
  });
});
