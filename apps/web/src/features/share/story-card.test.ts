import { describe, expect, it } from "vitest";

import { initials, STORY_SAFE_BOTTOM, storyStack } from "./story-card";

describe("story picture layout", () => {
  it("keeps the address pill above Instagram's reply bar, even for a long name and two lines", () => {
    const stack = storyStack("story", { nameLines: 2, nameSize: 160, lineCount: 2, descent: 40 });
    expect(stack.pillY + stack.pillHeight / 2).toBeLessThanOrEqual(STORY_SAFE_BOTTOM);
    // The foot credit is either left out or stays clear of the covered zone.
    if (stack.footY !== null) expect(stack.footY).toBeLessThanOrEqual(1660);
    expect(stack.lineYs).toHaveLength(2);
  });

  it("puts the pill at its usual place for a short name and one line", () => {
    const stack = storyStack("story", { nameLines: 1, nameSize: 160, lineCount: 1, descent: 40 });
    expect(stack.pillY).toBe(1450);
    // The foot is drawn, under the pill and above the covered zone.
    expect(stack.footY).not.toBeNull();
    expect(stack.footY ?? 0).toBeGreaterThan(stack.pillY + stack.pillHeight / 2);
    expect(stack.footY ?? Infinity).toBeLessThanOrEqual(1660);
  });

  it("starts the line below deep letters (Arabic descenders) instead of on them", () => {
    const shallow = storyStack("story", { nameLines: 1, nameSize: 160, lineCount: 1, descent: 10 });
    const deep = storyStack("story", { nameLines: 1, nameSize: 160, lineCount: 1, descent: 70 });
    const [shallowY = 0] = shallow.lineYs;
    const [deepY = 0] = deep.lineYs;
    expect(deepY).toBeGreaterThan(shallowY);
    // The line's top (about three quarters of its size above the baseline) stays below the letters.
    expect(deepY - 44 * 0.75).toBeGreaterThan(1190 + 70);
  });

  it("leaves the post format's foot where it was", () => {
    expect(storyStack("post", { nameLines: 1, nameSize: 132, lineCount: 1, descent: 30 }).footY).toBe(1290);
  });
});

describe("initials", () => {
  it("takes the first and last name's first letters", () => {
    expect(initials("Mara Vale")).toBe("MV");
    expect(initials("  lea  maria hartmann ")).toBe("LH");
    expect(initials("Nizar")).toBe("N");
  });

  it("gives an Arabic name one letter, so the initials never read as a word", () => {
    expect(initials("سلمى رحّال")).toBe("س");
    expect(initials("ليا هارتمان")).toBe("ل");
  });
});
