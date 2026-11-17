import { pageSchema } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { posterSamplePage } from "../poster/sample";
import { samplePage } from "./sample";

const messages = { en, de, ar } as const;
const translator = (locale: keyof typeof messages) => (key: string) => {
  const value = (messages[locale].sampleContent as Record<string, string>)[key];
  if (value === undefined) throw new Error(`Missing sampleContent.${key} in ${locale}`);
  return value;
};

describe("sample pages", () => {
  it.each(["en", "de", "ar"] as const)("%s sample page validates against the block schema", (locale) => {
    const result = pageSchema.safeParse(samplePage(locale, translator(locale)));
    expect(result.success, JSON.stringify(result.error?.issues.slice(0, 3))).toBe(true);
  });

  it.each(["en", "de", "ar"] as const)("%s Poster sample validates, keeps every block id unique and has titled sections", (locale) => {
    const t = translator(locale);
    const page = posterSamplePage(samplePage(locale, t), t);
    const result = pageSchema.safeParse(page);
    expect(result.success, JSON.stringify(result.error?.issues.slice(0, 3))).toBe(true);
    const ids = page.blocks.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(page.blocks.filter((block) => block.type === "header").length).toBeGreaterThanOrEqual(4);
  });
});
