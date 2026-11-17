import { pageSchema } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";

import { samplePage } from "./sample";

const t = (key: string) => (en.sampleContent as Record<string, string>)[key] ?? key;

describe("sample pages", () => {
  it.each(["en", "de", "ar"])("%s sample page validates against the block schema", (locale) => {
    const result = pageSchema.safeParse(samplePage(locale, t));
    expect(result.success, JSON.stringify(result.error?.issues.slice(0, 3))).toBe(true);
  });
});
