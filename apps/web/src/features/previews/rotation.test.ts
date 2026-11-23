import { describe, expect, it } from "vitest";

import { libraryClip, MOTION_LIBRARY } from "@/features/creator/motion-library";

import { PREVIEWS, previewPage } from "./registry";
import { nextInRotation, rotationClips } from "./rotation";
import { SEVAG_SLUG } from "./sevag";

describe("a page that takes turns with clips (Sevag's)", () => {
  const preview = PREVIEWS[SEVAG_SLUG];
  const rotation = preview?.motionRotation ?? [];
  const page = previewPage(SEVAG_SLUG, "de")?.page;
  if (!page) throw new Error("Sevag's page is missing");

  it("takes turns with all four warehouse clips of the library, his own first", () => {
    expect(rotation).toEqual(["palette-packen", "barcode-scannen", "lagerarbeit", "ware-scannen"]);
    expect(rotationClips(rotation).map((clip) => clip.key)).toEqual(rotation);
    // Everywhere the rotation does not reach (the link preview card, a claim) the page keeps its own clip.
    expect(page.profile.motion?.src).toBe("sample:motion-palette-packen");
  });

  it("opens every visit with the next clip, so a refresh never repeats the one before", () => {
    const seen = Array.from({ length: rotation.length * 2 }, () => nextInRotation(page, rotation).profile.motion?.src);
    for (let index = 1; index < seen.length; index += 1) expect(seen[index]).not.toBe(seen[index - 1]);
    // Two rounds: every clip twice.
    for (const key of rotation) expect(seen.filter((src) => src === `sample:motion-${key}`)).toHaveLength(2);
  });

  it("always shows the clip's own first frame as the still, described in the page's language", () => {
    for (const _ of rotation) {
      const { profile } = nextInRotation(page, rotation);
      const clip = libraryClip(profile.motion?.src);
      expect(clip).toBeDefined();
      expect(profile.hero).toEqual({ src: clip?.poster, alt: clip?.alt.de, w: clip?.w, h: clip?.h });
      // Nothing else of the page changes.
      expect({ ...profile, motion: undefined, hero: undefined }).toEqual({ ...page.profile, motion: undefined, hero: undefined });
    }
  });

  it("leaves a page as it is when the rotation names no clip of the library", () => {
    expect(nextInRotation(page, ["not-a-clip"])).toBe(page);
    expect(nextInRotation(page, [])).toBe(page);
    expect(MOTION_LIBRARY.some((clip) => clip.key === "not-a-clip")).toBe(false);
  });
});
