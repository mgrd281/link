import { NO_IMAGE, profileSchema, type Page } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { libraryClip, MOTION_LIBRARY, posterClip } from "@/features/creator/motion-library";
import { withoutThirdParties } from "@/features/creator/public-page";

import { withClip, withoutClip } from "./motion-picker";

const base: Page["profile"] = profileSchema.parse({
  displayName: "Mila Aurel",
  username: "mila-aurel",
  bio: "",
  locale: "en",
  avatar: { src: NO_IMAGE, alt: "" },
});
const photo = { src: "data:image/webp;base64,AAAA", alt: "Mila Aurel", w: 1200, h: 800 };

const [first, second] = MOTION_LIBRARY;
if (!first || !second) throw new Error("the library needs two clips for these tests");

describe("choosing a library clip as the moving header", () => {
  it("sets the clip and its first frame as the header picture, described in the page's language", () => {
    const next = withClip({ ...base, locale: "de" }, first);
    expect(libraryClip(next.motion?.src)).toBe(first);
    expect(posterClip(next.hero?.src)).toBe(first);
    expect(next.hero?.alt).toBe(first.alt.de);
    // The still's real size, so the header keeps its shape before the clip starts.
    expect(next.hero?.w).toBeGreaterThan(0);
    expect(next.hero?.h).toBeGreaterThan(0);
    expect(profileSchema.safeParse(next).success).toBe(true);
  });

  it("keeps the clip and its still on the public page, which drops clips from elsewhere", () => {
    const shown = withoutThirdParties({ profile: withClip(base, second), blocks: [] }).profile;
    expect(shown.motion?.src).toBe(withClip(base, second).motion?.src);
    expect(shown.hero?.src).toBe(second.poster);
    const own = withoutThirdParties({ profile: { ...base, motion: { src: "https://cdn.example.com/clip.mp4" } }, blocks: [] }).profile;
    expect(own.motion).toBeUndefined();
  });

  it("leaving a clip gives back the header picture from before; a picture chosen since stays", () => {
    const withPhoto = { ...base, hero: photo };
    const chosen = withClip(withPhoto, first);
    const back = withoutClip(chosen, photo);
    expect(back.motion).toBeUndefined();
    expect(back.hero).toEqual(photo);

    const replaced = { ...chosen, hero: { ...photo, src: "data:image/webp;base64,BBBB" } };
    expect(withoutClip(replaced, photo).hero?.src).toBe("data:image/webp;base64,BBBB");

    // No picture before: none after. The keys stay (as undefined), so a save that merges the draft
    // into the stored profile clears them.
    const cleared = withoutClip(withClip(base, first), undefined);
    expect(cleared.hero).toBeUndefined();
    expect(Object.keys(cleared)).toEqual(expect.arrayContaining(["hero", "motion"]));
  });

  it("switching to an own link keeps the link and drops the clip's still", () => {
    const own = { src: "https://cdn.example.com/clip.mp4" };
    const next = withoutClip(withClip(base, first), undefined, own);
    expect(next.motion).toEqual(own);
    expect(next.hero).toBeUndefined();
  });
});
