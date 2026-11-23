import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { exampleMedia } from "@/features/examples/media";

import { libraryClip, MOTION_LIBRARY, motionSrc } from "./motion-library";

describe("the motion library", () => {
  it("serves every clip from our own origin, with its first frame as a sample picture", () => {
    for (const clip of MOTION_LIBRARY) {
      expect(existsSync(join(process.cwd(), "public", "media", "motion", `${clip.key}.mp4`)), clip.key).toBe(true);
      expect(clip.poster in exampleMedia, clip.poster).toBe(true);
    }
  });

  it("finds a clip by the profile's motion value, and nothing else", () => {
    const [first] = MOTION_LIBRARY;
    if (!first) throw new Error("empty library");
    expect(libraryClip(motionSrc(first))).toBe(first);
    expect(libraryClip("sample:motion-lina")).toBeUndefined();
    expect(libraryClip("https://example.com/clip.mp4")).toBeUndefined();
    expect(libraryClip(undefined)).toBeUndefined();
  });
});
