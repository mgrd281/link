import { describe, expect, it } from "vitest";

import { classifySource, hasReadableSource } from "./classify";

describe("classifySource", () => {
  it.each([
    ["https://lio-vance.de", "website", true],
    ["lio-vance.de/about", "website", true],
    ["https://beacons.ai/lio", "linkinbio", true],
    ["mila.carrd.co", "linkinbio", true],
    ["https://www.tiktok.com/@lio.vance", "tiktok", true],
    ["https://linktr.ee/lio", "linktree", false],
    ["https://instagram.com/lio.vance", "instagram", false],
    ["https://x.com/liovance", "x", false],
    ["https://www.youtube.com/@liovance", "youtube", false],
    ["https://www.threads.net/@lio.vance", "social", false],
    ["https://www.facebook.com/liovance", "social", false],
    ["https://www.linkedin.com/in/lio-vance", "social", false],
    ["https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "pasted", false],
    ["https://www.tiktok.com/@lio.vance/video/7300000000000000000", "pasted", false],
  ] as const)("%s → %s (read: %s)", (input, kind, readable) => {
    const source = classifySource(input);
    expect(source?.kind).toBe(kind);
    expect(source?.readable).toBe(readable);
  });

  it("only links social profiles and channels (nothing is fetched), and skips Linktree with a reason", () => {
    expect(classifySource("https://instagram.com/lio.vance")).toMatchObject({ handleOnly: true, readable: false, label: "instagram.com/lio.vance" });
    expect(classifySource("https://www.youtube.com/@liovance")).toMatchObject({ handleOnly: true });
    expect(classifySource("linktr.ee/lio")).toMatchObject({ kind: "linktree", pasteOnly: true, readable: false });
  });

  it("normalizes the address and gives a short label", () => {
    expect(classifySource("http://www.lio-vance.de/?utm_source=x")).toMatchObject({ url: "https://www.lio-vance.de/", label: "lio-vance.de" });
  });

  it("is null for text that is not an address", () => {
    expect(classifySource("just words")).toBeNull();
    expect(classifySource("")).toBeNull();
  });

  it("knows when the sentence may stay empty: a readable source exists", () => {
    expect(hasReadableSource(["https://instagram.com/lio.vance"])).toBe(false);
    expect(hasReadableSource(["https://instagram.com/lio.vance", "https://lio-vance.de"])).toBe(true);
    expect(hasReadableSource(["linktr.ee/lio"])).toBe(false);
  });
});
