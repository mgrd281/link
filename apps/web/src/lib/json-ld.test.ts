import { describe, expect, it } from "vitest";

import { jsonLd } from "./json-ld";

describe("jsonLd", () => {
  const hostile = "</script><script>alert(1)</script>";

  it("writes no character that could end the script element or start markup", () => {
    const data = { "@type": "CreativeWork", name: `${hostile} & more`, description: `line\u2028break\u2029end <!-- -->`, keywords: ["a>b", "c<d"] };
    const out = jsonLd(data);
    expect(out).not.toMatch(/[<>&\u2028\u2029]/);
    expect(out).toContain("\\u003c/script\\u003e");
  });

  it("reads back as the original strings", () => {
    const data = { name: `${hostile} & more`, description: "a\u2028b\u2029c", nested: { list: ["<", ">", "&", "\u2028"] } };
    expect(JSON.parse(jsonLd(data))).toEqual(data);
  });

  it("leaves other text as JSON.stringify writes it", () => {
    const data = { name: "Hafenlicht · Ronja", value: "9 → 3", arabic: "نايا الدباس" };
    expect(jsonLd(data)).toBe(JSON.stringify(data));
  });
});
