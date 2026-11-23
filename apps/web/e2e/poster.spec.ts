import { expect, test } from "@playwright/test";

test.describe("poster creator page", () => {
  test("releases open in place to show where to listen (no JavaScript needed)", async ({ browser }) => {
    // <details> works without JS: prove it by disabling JavaScript entirely.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/en/directions/poster?chrome=0");
    const release = page.locator("details", { hasText: "Lichtfeld" });
    await expect(release.getByRole("link", { name: "Listen on Spotify" })).toBeHidden();
    await release.locator("summary").click();
    await expect(release.getByRole("link", { name: "Listen on Spotify" })).toBeVisible();
    await context.close();
  });

  test("content is grouped in titled sections, products in a two-up grid", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    for (const title of ["Shows & tickets", "Music", "Mixes", "Videos", "Latest shorts", "Shop", "Partners", "Booking & more"]) {
      await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
    }
    const shop = page.getByRole("region", { name: "Shop", exact: true });
    await expect(shop.getByRole("listitem")).toHaveCount(2);
  });

  test("plain links show where they lead", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    await expect(page.getByRole("link", { name: /Book me for your club.*booking@milaaurel\.com/ })).toBeVisible();
  });

  test("every template renders the same content structure", async ({ page }) => {
    // Numbered, marker and headline titles add a decorative "01", monospace titles a "//" (all hidden
    // from screen readers); the number may stand on a line of its own before the title.
    const headings = async (template: string) => {
      await page.goto(`/en/directions/poster?chrome=0&template=${template}`);
      return (await page.getByRole("heading", { level: 2 }).allInnerTexts()).map((text) => text.replace(/^\s*(\d{2}|\/\/)\s*/, "").trim().toLowerCase());
    };
    const reference = await headings("nocturne");
    for (const template of ["daylight", "marquee", "pulse", "atelier", "mono", "studio", "aura", "folio", "signal", "bloom", "werkbogen", "tiefdruck"]) {
      expect(await headings(template), template).toEqual(reference);
    }
  });

  test("the newer templates bring their own layout: a cinema still, a halo, a framed picture, corner marks, an arch", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0&template=studio");
    // Studio: the name sits over the still, at the reading start; titles are numbered.
    const name = page.getByRole("heading", { level: 1 });
    await expect(name).toHaveCSS("text-align", "start");
    // The first titled section is number 01 (the number is decoration: the heading's name stays the title).
    await expect(page.getByRole("heading", { level: 2, name: "Shows & tickets", exact: true })).toContainText("01");
    await page.goto("/en/directions/poster?chrome=0&template=signal");
    await expect(page.locator(".poster-corner")).toHaveCount(4);
    await expect(page.locator(".poster-grid")).toHaveCount(1);
    await page.goto("/en/directions/poster?chrome=0&template=aura");
    await expect(page.locator(".poster-halo")).toHaveCount(1);
    await expect(page.locator(".poster-glow")).toHaveCount(3);
    await page.goto("/en/directions/poster?chrome=0&template=bloom");
    await expect(page.locator(".poster-arch-line")).toHaveCount(1);
  });

  test("with reduced motion nothing on the newer templates moves", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const template of ["studio", "aura", "signal", "bloom", "folio"]) {
      await page.goto(`/en/directions/poster?chrome=0&template=${template}`);
      // Time-based animations only: the hero's scroll-linked fade stays (opacity only with reduced motion).
      // Named, so a failure says which animation ran (and on what) instead of only how many.
      const moving = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running" && animation.timeline === document.timeline)
          .map((animation) => {
            const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
            const name = animation instanceof CSSAnimation ? animation.animationName : animation instanceof CSSTransition ? `transition:${animation.transitionProperty}` : "script";
            return `${name} on ${target?.tagName.toLowerCase() ?? "?"}.${(target?.getAttribute("class") ?? "").split(" ").slice(0, 4).join(".")}`;
          }),
      );
      expect(moving, template).toEqual([]);
    }
    await context.close();
  });

  test("Marquee shows the logo as the page heading", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0&template=marquee");
    await expect(page.getByRole("heading", { level: 1, name: "Mila Aurel" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).getByRole("img")).toBeVisible();
  });

  test("month tabs filter the dates and follow the keyboard", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    const shows = page.getByRole("region", { name: "Shows & tickets", exact: true });
    const tabs = shows.getByRole("tab");
    const rows = shows.getByRole("tabpanel").getByRole("listitem");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(rows).toHaveCount(6);
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(rows).toHaveCount(1);
    await page.keyboard.press("End");
    await expect(rows).toHaveCount(1);
    await page.keyboard.press("Home");
    await expect(rows).toHaveCount(6);
  });

  test("a long run of mixes becomes a two-row rail; ads are labelled", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    const rail = page.getByRole("region", { name: "Mixes, scrollable row" });
    await expect(rail.getByRole("listitem")).toHaveCount(4);
    await expect(page.getByRole("link", { name: /The headphones I mix on.*Ad/ })).toBeVisible();
  });
});

test.describe("poster dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/directions/poster/dashboard?chrome=0");
    await page.waitForLoadState("load");
  });

  test("adding a section shows a new titled section in the preview, ready to rename", async ({ page }) => {
    const preview = page.getByRole("complementary", { name: "Live preview" });
    await page.getByRole("button", { name: "Add section" }).click();
    await expect(preview.getByRole("heading", { level: 2, name: "New section" })).toBeVisible();
    const title = page.getByRole("textbox", { name: "Section title: New section" });
    await expect(title).toBeFocused();
    await title.fill("Merch drops");
    await title.press("Enter");
    await expect(preview.getByRole("heading", { level: 2, name: "Merch drops" })).toBeVisible();
  });

  test("picking a template restyles the live preview in one click", async ({ page }) => {
    const preview = page.getByRole("complementary", { name: "Live preview" });
    const background = () => preview.locator("[lang]").first().evaluate((node) => getComputedStyle(node).backgroundColor);
    const before = await background();
    const pulse = page.getByRole("radio", { name: /^Pulse/ });
    await page.getByText("Pulse", { exact: true }).click();
    await expect(pulse).toBeChecked();
    await expect(pulse).toBeFocused();
    await expect.poll(background).not.toBe(before);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: /^Atelier/ })).toBeChecked();
  });
});
