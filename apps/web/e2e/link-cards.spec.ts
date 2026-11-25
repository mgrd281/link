import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * A link card on a creator page answers the mouse clearly. Its colour did not change on hover (only
 * an overlay of 6 % of the text colour, a step of about 5 of 255 on the card), so a card under the
 * pointer looked like one beside it. Now a frame of 2 px in the card's own text colour appears inside its
 * edge (so it shows on every fill, theme and photo, and nothing moves), at the token strength
 * `opacity-secondary`; the keyboard keeps its focus ring. No shadow, no underline, no motion under
 * reduced motion.
 *
 * Checked on four of the six button styles: the accent-filled highlighted card (Messi, and Karim in Arabic,
 * mirrored), soft (Nocturne), glass (Aura) and outline (Signal). The "Card" style already stepped its border
 * on hover and now gets the frame as well; the minimal style is a line under a title, with no frame.
 */
const CARDS = [
  { name: "Messi (filled)", path: "/de/p/messi" },
  { name: "Nocturne (soft)", path: "/de/directions/poster?chrome=0&template=nocturne" },
  { name: "Aura (glass)", path: "/de/directions/poster?chrome=0&template=aura" },
  { name: "Signal (outline)", path: "/de/directions/poster?chrome=0&template=signal" },
  { name: "Karim in Arabic (filled, mirrored)", path: "/ar/p/karim-almansour" },
] as const;

/** The largest difference in any colour channel (0 to 255) between two PNGs, worked out in the page. */
const largestDifference = async (pair: string[]): Promise<number> => {
  const [a = "", b = ""] = pair;
  const load = async (data: string) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  };
  const [x, y] = await Promise.all([load(a), load(b)]);
  let largest = 0;
  for (let index = 0; index < x.width * x.height * 4; index += 1) {
    if (index % 4 === 3) continue;
    largest = Math.max(largest, Math.abs((x.data[index] ?? 0) - (y.data[index] ?? 0)));
  }
  return largest;
};

/** What the card shows of itself: its frame (the ::before), its own colours, its box. */
const state = (card: Locator) =>
  card.evaluate((element) => {
    const frame = getComputedStyle(element, "::before");
    const own = getComputedStyle(element);
    return {
      content: frame.content,
      opacity: Number(frame.opacity),
      width: frame.borderTopWidth,
      color: frame.borderTopColor,
      position: frame.position,
      transition: frame.transitionProperty,
      text: own.color,
      shadow: own.boxShadow,
      underline: own.textDecorationLine,
      outlineWidth: own.outlineWidth,
      outlineStyle: own.outlineStyle,
      height: element.getBoundingClientRect().height,
    };
  });

async function open(page: Page, path: string): Promise<Locator> {
  // A visitor who answered the privacy notice (it would cover the card).
  await page.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  const card = page.locator("a.min-h-creator-button").first();
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2);
  return card;
}

test.describe("link cards on creator pages answer the mouse clearly", () => {
  test.skip(({ isMobile }) => isMobile, "needs a mouse");
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const entry of CARDS) {
    test(`${entry.name}: a clear frame on hover, nothing moves, no shadow, no underline`, async ({ page }) => {
      const card = await open(page, entry.path);
      const rest = await state(card);
      expect(rest.content, "the card has a frame to show on hover").not.toBe("none");
      expect(rest.opacity, "no frame at rest").toBe(0);
      const restShot = await card.screenshot({ animations: "disabled" });
      await card.hover();
      // The frame fades in over the micro duration to the token strength (0.64).
      await expect.poll(async () => (await state(card)).opacity, { message: "the frame appears on hover" }).toBeGreaterThanOrEqual(0.6);
      const hover = await state(card);
      expect(hover.position).toBe("absolute");
      expect(hover.transition, "it fades in").toBe("opacity");
      expect(hover.width, "a frame of 2 px").toBe("2px");
      expect(hover.color, "in the card's own text colour").toBe(hover.text);
      expect(hover.height, "the card does not change size").toBe(rest.height);
      expect(hover.shadow).toBe("none");
      expect(hover.underline).toBe("none");
      const hoverShot = await card.screenshot({ animations: "disabled" });
      const difference = await page.evaluate(largestDifference, [restShot.toString("base64"), hoverShot.toString("base64")]);
      // The overlay alone moved a pixel by at most about 15 of 255; the frame is a different thing.
      expect(difference, "the card clearly differs from the card beside it").toBeGreaterThanOrEqual(60);
      // And it lets go again.
      await page.mouse.move(2, 2);
      await expect.poll(async () => (await state(card)).opacity).toBe(0);
    });
  }

  test("reduced motion: the frame is there at once, with no transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const card = await open(page, "/de/p/messi");
    await card.hover();
    const hover = await state(card);
    expect(hover.content, "the card has a frame to show on hover").not.toBe("none");
    expect(hover.opacity).toBeGreaterThanOrEqual(0.6);
    expect(hover.transition, "no fade").toBe("none");
  });

  test("keyboard focus keeps its ring around the card (the hover frame is for the mouse)", async ({ page }) => {
    const card = await open(page, "/de/p/messi");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let presses = 0; presses < 80 && !(await card.evaluate((element) => element === document.activeElement)); presses += 1) await page.keyboard.press("Tab");
    expect(await card.evaluate((element) => element === document.activeElement), "the card took focus by keyboard").toBe(true);
    const focused = await state(card);
    expect(focused.outlineStyle).toBe("solid");
    expect(parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(focused.content, "the card has a frame to show on hover").not.toBe("none");
    expect(focused.opacity, "the frame is not drawn inside the ring").toBe(0);
  });
});
