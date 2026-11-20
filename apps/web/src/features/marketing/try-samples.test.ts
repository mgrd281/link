import { blockSchema, detectLink } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { socialProfile } from "@/features/app/import-links";

import { TRY_LOOKS } from "./try-looks";
import { sampleBlock } from "./try-page";
import { EXAMPLES, PERSONA, sampleOf } from "./try-samples";

describe("playground samples", () => {
  it("every example is detected as the block it shows, and recognised as a sample", () => {
    const types = EXAMPLES.map((example) => detectLink(example.url)?.type);
    expect(types).toEqual(["link", "music", "video", "product", "live"]);
    for (const example of EXAMPLES) expect(sampleOf(detectLink(example.url)?.url ?? "")).toBe(example.id);
    expect(sampleOf("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeUndefined();
  });

  it("every sample is a valid block with the persona's pictures, the typed name as artist", () => {
    for (const example of EXAMPLES) {
      // Instagram is a profile: an icon under the name, not a block.
      if (example.id === "instagram") continue;
      const block = sampleBlock(example.id, `try-${example.id}`, example.url, { artist: "Juno Kade", channel: "juno_kade", texts: { video: "Rooftop set", product: "Afterglow · vinyl" } });
      expect(blockSchema.safeParse(block).success).toBe(true);
      const pictures = JSON.stringify(block).match(/"src":"([^"]+)"/g) ?? [];
      for (const picture of pictures) expect(picture).toContain("sample:");
      if (block.type === "music") expect(block.artist).toBe("Juno Kade");
    }
  });

  it("the persona's links exist, Instagram is a profile, and every look is complete", () => {
    for (const sample of PERSONA.links) expect(EXAMPLES.some((example) => example.id === sample)).toBe(true);
    expect(socialProfile(EXAMPLES[0]?.url ?? "", ["instagram"])).toEqual({ platform: "instagram", handle: "junokade" });
    expect(TRY_LOOKS.map((look) => look.config.template)).toEqual(["nocturne", "daylight", "pulse", "atelier", "mono"]);
    expect(TRY_LOOKS.some((look) => look.id === PERSONA.look)).toBe(true);
  });
});
