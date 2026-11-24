import { describe, expect, it } from "vitest";

import { plainImageSrc } from "./media";

describe("an address a plain <img> can load", () => {
  it("resolves a sample picture's key to its file", () => {
    const src = plainImageSrc("sample:mila-avatar");
    expect(src).toBeTruthy();
    expect(src).not.toMatch(/^sample:/);
  });

  it("keeps a real address and gives nothing for an unknown key (the avatar then shows initials)", () => {
    expect(plainImageSrc("https://example.supabase.co/storage/v1/object/public/media/a.webp")).toBe("https://example.supabase.co/storage/v1/object/public/media/a.webp");
    expect(plainImageSrc("sample:no-such-picture")).toBeUndefined();
  });
});
