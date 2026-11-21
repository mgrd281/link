import { initialsOf } from "@linkyo/ui";
import { describe, expect, it } from "vitest";

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Mila Aurel")).toBe("MA");
    expect(initialsOf("mila aurel studio")).toBe("MA");
  });

  it("has none when no word starts with a letter, so the avatar shows a person glyph", () => {
    expect(initialsOf("1")).toBe("");
    expect(initialsOf("🎧")).toBe("");
    expect(initialsOf("  ")).toBe("");
    expect(initialsOf("")).toBe("");
  });

  it("skips numbers, emoji and symbols", () => {
    expect(initialsOf("🎧 Mila ✨")).toBe("M");
    expect(initialsOf("1 Mila 2 Aurel")).toBe("MA");
  });

  it("keeps one letter for an Arabic name (two would join into a word)", () => {
    expect(initialsOf("سلمى رحّال")).toBe("س");
  });

  it("takes whole letters, not halves of them", () => {
    expect(initialsOf("Ægir")).toBe("Æ");
    // "É" written as E + a combining accent stays one letter.
    expect(initialsOf("Émile Zola")).toBe("ÉZ");
  });
});
