import { blockSchema, detectLink } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { EXAMPLES, sampleBlock, sampleOf } from "./try-samples";

describe("playground samples", () => {
  it("every example is detected as the block it shows, and recognised as a sample", () => {
    const types = EXAMPLES.map((example) => detectLink(example.url)?.type);
    expect(types).toEqual(["music", "video", "live", "product"]);
    for (const example of EXAMPLES) expect(sampleOf(detectLink(example.url)?.url ?? "")).toBe(example.id);
    expect(sampleOf("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeUndefined();
  });

  it("every sample is a valid block with Linkyo's own pictures, the typed name as artist", () => {
    for (const example of EXAMPLES) {
      const block = sampleBlock(example.id, `try-${example.id}`, example.url, { artist: "Juno Kade", channel: "juno_kade", texts: { video: "Live in Berlin", product: "Lichtfeld · vinyl" } });
      expect(blockSchema.safeParse(block).success).toBe(true);
      const pictures = JSON.stringify(block).match(/"src":"([^"]+)"/g) ?? [];
      for (const picture of pictures) expect(picture).toContain("sample:");
      if (block.type === "music") expect(block.artist).toBe("Juno Kade");
    }
  });
});
