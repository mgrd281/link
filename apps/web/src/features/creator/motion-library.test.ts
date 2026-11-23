import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { exampleMedia } from "@/features/examples/media";

import { libraryClip, MOTION_LIBRARY, motionSrc } from "./motion-library";

describe("the motion library", () => {
  it("serves every clip from our own origin, with its first frame as a sample picture", () => {
    for (const clip of MOTION_LIBRARY) {
      expect(existsSync(join(process.cwd(), "public", "media", "motion", `${clip.key}.mp4`)), clip.key).toBe(true);
      expect(clip.poster in exampleMedia, clip.poster).toBe(true);
      expect(clip.w / clip.h, clip.key).toBeCloseTo(4 / 5);
    }
  });

  it("knows each still's real size (read from the JPEG's frame header)", () => {
    for (const clip of MOTION_LIBRARY) {
      const file = readFileSync(join(process.cwd(), "src", "assets", "examples", `${clip.poster.replace("sample:", "")}.jpg`));
      // The first SOF0/SOF2 marker holds height and width.
      const at = file.findIndex((byte, i) => byte === 0xff && (file[i + 1] === 0xc0 || file[i + 1] === 0xc2));
      expect(at, clip.key).toBeGreaterThan(0);
      expect([file.readUInt16BE(at + 7), file.readUInt16BE(at + 5)], clip.key).toEqual([clip.w, clip.h]);
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
