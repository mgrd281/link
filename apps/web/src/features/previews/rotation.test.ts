import { describe, expect, it } from "vitest";

import { libraryClip, MOTION_LIBRARY } from "@/features/creator/motion-library";

import { PREVIEWS, previewPage } from "./registry";
import { rotationClips, rotationTurn, withRotationClip } from "./rotation";
import { ROTATION_PARAM } from "./rotation-param";
import { SEVAG_SLUG } from "./sevag";

describe("a page that takes turns with clips (Sevag's)", () => {
  const preview = PREVIEWS[SEVAG_SLUG];
  const rotation = preview?.motionRotation ?? [];
  const page = previewPage(SEVAG_SLUG, "de")?.page;
  if (!page) throw new Error("Sevag's page is missing");

  it("takes turns with the library's four real warehouse clips, his own first, and no drawing", () => {
    expect(rotation).toEqual(["hochregal", "barcode-scannen", "stapler-fahren", "hubwagen"]);
    // The founder's wish: real footage only.
    for (const clip of rotationClips(rotation)) expect(clip.kind, clip.key).toBe("film");
    expect(rotationClips(rotation).map((clip) => clip.key)).toEqual(rotation);
    // Everywhere the rotation does not reach (the link preview card, a claim) the page keeps its own clip.
    expect(page.profile.motion?.src).toBe("sample:motion-hochregal");
    expect(ROTATION_PARAM).toBe("clip");
  });

  it("opens a first visit (no clip in the address) with his own clip and names the next one", () => {
    const turn = rotationTurn(rotation, undefined);
    expect([turn?.clip.key, turn?.next.key]).toEqual(["hochregal", "barcode-scannen"]);
  });

  it("shows the clip the address names and then the next, round and round: a refresh never repeats the one before", () => {
    // Follow the chain a refresh follows: each visit's next clip is what the following visit asks for.
    let asked: string | undefined;
    const seen: string[] = [];
    for (let visit = 0; visit < rotation.length * 2; visit += 1) {
      const turn = rotationTurn(rotation, asked);
      if (!turn) throw new Error("no turn");
      seen.push(turn.clip.key);
      expect(turn.next.key).not.toBe(turn.clip.key);
      asked = turn.next.key;
    }
    expect(seen).toEqual([...rotation, ...rotation]);
    // Pure: the same address always gets the same answer, whichever server copy is asked.
    expect(rotationTurn(rotation, "stapler-fahren")).toEqual(rotationTurn(rotation, "stapler-fahren"));
    // A repeated parameter (?clip=a&clip=b) counts by its first value.
    expect(rotationTurn(rotation, ["hubwagen", "stapler-fahren"])?.clip.key).toBe("hubwagen");
  });

  it("falls back to his own clip for an address that names no clip of the rotation", () => {
    for (const asked of ["", "not-a-clip", "../hochregal", "HOCHREGAL"]) expect(rotationTurn(rotation, asked)?.clip.key).toBe("hochregal");
    // A library clip outside his rotation is not shown either.
    const outside = MOTION_LIBRARY.find((clip) => !rotation.includes(clip.key));
    if (outside) expect(rotationTurn(rotation, outside.key)?.clip.key).toBe("hochregal");
  });

  it("always shows the clip's own first frame as the still, described in the page's language, and changes nothing else", () => {
    for (const key of rotation) {
      const turn = rotationTurn(rotation, key);
      if (!turn) throw new Error("no turn");
      const { profile } = withRotationClip(page, turn.clip);
      const clip = libraryClip(profile.motion?.src);
      expect(clip?.key).toBe(key);
      expect(profile.hero).toEqual({ src: clip?.poster, alt: clip?.alt.de, w: clip?.w, h: clip?.h });
      expect({ ...profile, motion: undefined, hero: undefined }).toEqual({ ...page.profile, motion: undefined, hero: undefined });
    }
  });

  it("has no turn when the rotation names no clip of the library", () => {
    expect(rotationTurn(["not-a-clip"], undefined)).toBeNull();
    expect(rotationTurn([], "hochregal")).toBeNull();
    expect(MOTION_LIBRARY.some((clip) => clip.key === "not-a-clip")).toBe(false);
  });
});
