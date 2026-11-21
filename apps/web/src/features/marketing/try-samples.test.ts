import { blockSchema, detectLink } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { socialProfile } from "@/features/app/import-links";

import { TRY_LOOKS } from "./try-looks";
import { sampleBlock } from "./try-page";
import { EXAMPLES, PERSONA, sampleOf } from "./try-samples";

const texts = { video: "Gala night: the look", necklace: "“Soleil” necklace · gold", perfume: "“Ambre” eau de parfum" };

describe("playground samples", () => {
  it("every example is detected as the block it shows, and recognised as a sample", () => {
    const types = EXAMPLES.map((example) => detectLink(example.url)?.type);
    expect(types).toEqual(["link", "product", "product", "video", "link"]);
    for (const example of EXAMPLES) expect(sampleOf(detectLink(example.url)?.url ?? "")).toBe(example.id);
    expect(sampleOf("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeUndefined();
  });

  it("every sample is a valid block with the persona's own pictures", () => {
    for (const example of EXAMPLES) {
      // Instagram and TikTok are profiles: icons under the name, not blocks.
      if (example.id === "instagram" || example.id === "tiktok") continue;
      const block = sampleBlock(example.id, `try-${example.id}`, example.url, texts);
      expect(blockSchema.safeParse(block).success).toBe(true);
      const pictures = JSON.stringify(block).match(/"src":"([^"]+)"/g) ?? [];
      expect(pictures.length).toBeGreaterThan(0);
      for (const picture of pictures) expect(picture).toContain("sample:");
    }
  });

  it("the persona's links exist, its profiles are profiles, and every look is complete", () => {
    for (const sample of PERSONA.links) expect(EXAMPLES.some((example) => example.id === sample)).toBe(true);
    expect(socialProfile(EXAMPLES[0]?.url ?? "", ["instagram"])).toEqual({ platform: "instagram", handle: "louferreira" });
    expect(socialProfile(EXAMPLES.find((example) => example.id === "tiktok")?.url ?? "", ["tiktok"])).toEqual({ platform: "tiktok", handle: "louferreira" });
    expect(TRY_LOOKS.map((look) => look.config.template)).toEqual(["mono", "nocturne", "studio", "aura", "bloom"]);
    expect(TRY_LOOKS.some((look) => look.id === PERSONA.look)).toBe(true);
  });
});
