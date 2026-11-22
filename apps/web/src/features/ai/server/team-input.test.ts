import { describe, expect, it } from "vitest";

import { pipelineInputSchema } from "../request";

import { teamRunInput } from "./team-input";

describe("teamRunInput", () => {
  const links = Array.from({ length: 12 }, (_, index) => `https://example.com/link-${String(index + 1)}`);

  it("reads the first five links as sources, pastes the rest, and uses the wishes as the owner text", () => {
    const input = teamRunInput({ locale: "de", displayName: "Lio Vance", kind: "music" }, { links: ["  ", ...links], wishes: "  Dunkel, Musik zuerst.  ", pageLocale: "ar" });
    expect(input).toEqual({
      route: "team",
      pageLocale: "ar",
      ownerLocale: "de",
      about: "Dunkel, Musik zuerst.",
      name: "Lio Vance",
      kind: "music",
      sources: links.slice(0, 5),
      pasted: links.slice(5),
      photo: null,
    });
    expect(pipelineInputSchema.safeParse(input).success).toBe(true);
  });

  it("keeps up to 2,000 characters of wishes and never sends a photo", () => {
    const input = teamRunInput({ locale: "en", displayName: null, kind: "unknown-kind" }, { links: [], wishes: "w".repeat(2500), pageLocale: "en" });
    expect(input.about).toHaveLength(2000);
    expect(input.photo).toBeNull();
    expect(input.kind).toBeNull();
    expect(input).not.toHaveProperty("name");
    expect(pipelineInputSchema.safeParse(input).success).toBe(true);
  });
});
