import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

/**
 * Linkyo has no Google sign-in (W-03): sign-up and log-in take an e-mail address only. No text may
 * promise it, also not the team console's hints about prepared pages. Google's other products
 * (Play, Pay, Maps, Drive, the Fonts CDN we do not use) are fine.
 */
const OTHER_PRODUCTS = /Google[ -](Play|Pay|Maps|Drive|Fonts|LLC)|خرائط Google/g;

const strings = (value: unknown, path = ""): [string, string][] =>
  typeof value === "string"
    ? [[path, value]]
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([key, child]) => strings(child, path ? `${path}.${key}` : key))
      : [];

describe("no text promises a Google sign-in", () => {
  it.each([
    ["de", de],
    ["en", en],
    ["ar", ar],
  ])("%s", (_, messages) => {
    const mentions = strings(messages).filter(([, text]) => text.replace(OTHER_PRODUCTS, "").includes("Google"));
    expect(mentions).toEqual([]);
  });
});
