import { describe, expect, it } from "vitest";

import { coverCost, pickToastSide, type Box } from "../src/toast-placement";

/** A 390 × 844 phone: the toast is 358 × 48, 16 px in from the sides, 64 px above the bottom (the tab bar) or 72 px below the top (its bar). */
const bottom: Box = { left: 16, top: 732, right: 374, bottom: 780 };
const top: Box = { left: 16, top: 72, right: 374, bottom: 120 };
const bands = { bottom, top };
/** A row of the screen, full width, 48 px tall, from `y`. */
const row = (y: number): Box => ({ left: 16, top: y, right: 374, bottom: y + 48 });

describe("where a toast stands on a phone", () => {
  it("stays at the bottom, above the tab bar, when nothing is under either place", () => {
    expect(pickToastSide({ bands, controls: [row(400)] })).toBe("bottom");
    expect(pickToastSide({ bands, controls: [] })).toBe("bottom");
  });

  it("takes the top when the bottom would cover the rows below the link just copied", () => {
    // Home: the share button, the QR code row and the story picture row stand under the bottom band; nothing under the top.
    expect(pickToastSide({ bands, controls: [row(700), row(748)] })).toBe("top");
  });

  it("never covers the control just used, even when the top has more controls", () => {
    const used = row(740);
    expect(pickToastSide({ bands, controls: [used, row(80), row(100)], used })).toBe("top");
    // …and it keeps to the bottom when the used control is under the top band instead.
    expect(pickToastSide({ bands, controls: [row(80), row(740)], used: row(80) })).toBe("bottom");
  });

  it("does not cover the preview that shows what a change did, unless both places would", () => {
    const preview = { left: 0, top: 64, right: 390, bottom: 275 };
    // The bottom covers two controls, the top the preview: the bottom, the preview stays in sight.
    expect(pickToastSide({ bands, controls: [row(740), row(760)], keepClear: [preview] })).toBe("bottom");
    // Both covered: the bottom, where toasts live.
    expect(pickToastSide({ bands, controls: [], keepClear: [preview, row(740)] })).toBe("bottom");
  });

  it("keeps the bottom on a tie, and when the top covers more", () => {
    expect(pickToastSide({ bands, controls: [row(740), row(80)] })).toBe("bottom");
    expect(pickToastSide({ bands, controls: [row(740), row(80), row(100)] })).toBe("bottom");
  });

  it("counts a control only where it really overlaps the band (touching edges do not)", () => {
    expect(coverCost(bottom, { controls: [row(684)] })).toBe(0); // ends exactly where the band starts
    expect(coverCost(bottom, { controls: [row(685)] })).toBe(1);
    expect(coverCost(bottom, { controls: [{ left: 374, top: 732, right: 390, bottom: 780 }] })).toBe(0); // beside it
  });
});
