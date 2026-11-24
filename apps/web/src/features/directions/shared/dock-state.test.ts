import { describe, expect, it } from "vitest";

import { pastHero } from "./dock-state";

describe("pastHero (when the Linkyo bar slides in)", () => {
  it("never at rest at the top, even when a short hero ends above the line", () => {
    // Tiefdruck's statement hero in Arabic at 1440 x 900: the hero ends 384 px down, above 45 % (405 px).
    expect(pastHero(384, 900, 0)).toBe(false);
    expect(pastHero(120, 900, 0)).toBe(false);
  });

  it("not while a tall hero is still on the first screen", () => {
    expect(pastHero(948, 900, 0)).toBe(false);
    expect(pastHero(500, 900, 448)).toBe(false);
  });

  it("once the visitor has scrolled and the hero's end has passed 45 % of the screen", () => {
    expect(pastHero(300, 900, 648)).toBe(true);
    expect(pastHero(383, 900, 1)).toBe(true);
    expect(pastHero(-200, 844, 1200)).toBe(true);
  });

  it("not exactly on the line", () => {
    expect(pastHero(405, 900, 543)).toBe(false);
  });
});
