import { describe, expect, it } from "vitest";

import { aiRunRequestSchema, pipelineInput, pipelineInputSchema } from "./request";

const valid = {
  mode: "welcome",
  pageLocale: "de",
  ownerLocale: "de",
  about: "Ich mache elektronische Musik.",
  kind: null,
  sources: ["lio-vance.de"],
  pasted: [],
  photo: null,
};

const ok = (input: unknown) => aiRunRequestSchema.safeParse(input).success;

describe("AI run request", () => {
  it("accepts a normal request and trims its texts", () => {
    const parsed = aiRunRequestSchema.parse({ ...valid, about: "  Hi  ", name: " Lio ", kind: "music", photo: { vibrant: "#C2410C", dominant: "#1c1917", mode: "dark" } });
    expect(parsed.about).toBe("Hi");
    expect(parsed.name).toBe("Lio");
  });

  it("needs a sentence, a link or pasted links", () => {
    expect(ok({ ...valid, about: "", sources: [], pasted: [] })).toBe(false);
    expect(ok({ ...valid, about: "   ", sources: [], pasted: [] })).toBe(false);
    const missing = aiRunRequestSchema.safeParse({ ...valid, about: "", sources: [], pasted: [] });
    expect(missing.error?.issues[0]?.path).toEqual(["about"]);
    expect(ok({ ...valid, about: "", sources: ["lio-vance.de"], pasted: [] })).toBe(true);
    expect(ok({ ...valid, about: "", sources: [], pasted: ["https://example.com"] })).toBe(true);
    expect(ok({ ...valid, about: "Ich lege auf.", sources: [], pasted: [] })).toBe(true);
  });

  it("enforces every limit", () => {
    expect(ok({ ...valid, about: "x".repeat(600) })).toBe(true);
    expect(ok({ ...valid, about: "x".repeat(601) })).toBe(false);
    expect(ok({ ...valid, name: "x".repeat(61) })).toBe(false);
    expect(ok({ ...valid, sources: ["a.de", "b.de", "c.de", "d.de", "e.de"] })).toBe(true);
    expect(ok({ ...valid, sources: ["a.de", "b.de", "c.de", "d.de", "e.de", "f.de"] })).toBe(false);
    expect(ok({ ...valid, sources: ["x".repeat(301)] })).toBe(false);
    expect(ok({ ...valid, sources: [" "] })).toBe(false);
    expect(ok({ ...valid, pasted: Array.from({ length: 40 }, (_, i) => `https://example.com/${i}`) })).toBe(true);
    expect(ok({ ...valid, pasted: Array.from({ length: 41 }, (_, i) => `https://example.com/${i}`) })).toBe(false);
    expect(ok({ ...valid, pasted: [`https://example.com/${"x".repeat(2048)}`] })).toBe(false);
  });

  it("only takes known values", () => {
    expect(ok({ ...valid, mode: "team" })).toBe(false);
    expect(ok({ ...valid, pageLocale: "fr" })).toBe(false);
    expect(ok({ ...valid, kind: "astronaut" })).toBe(false);
    expect(ok({ ...valid, photo: { vibrant: "red", dominant: "#000000", mode: "dark" } })).toBe(false);
    expect(ok({ ...valid, photo: { vibrant: "#000000", dominant: "#000000", mode: "neon" } })).toBe(false);
  });

  it("turns a request into pipeline input; only a team run may carry a long briefing", () => {
    const input = pipelineInput(aiRunRequestSchema.parse({ ...valid, mode: "dashboard" }));
    expect(input.route).toBe("dashboard");
    expect("mode" in input).toBe(false);
    expect(pipelineInputSchema.safeParse({ ...input, route: "team", about: "x".repeat(2000) }).success).toBe(true);
    expect(pipelineInputSchema.safeParse({ ...input, route: "team", about: "x".repeat(2001) }).success).toBe(false);
    expect(pipelineInputSchema.safeParse({ ...input, route: "welcome", about: "x".repeat(601) }).success).toBe(false);
  });
});
