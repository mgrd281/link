import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Design system v2 (Stage 2 WP2.3): the icon registry on /design, directional glyphs that mirror
 * exactly once in right-to-left text, the UI kit by keyboard and screen reader, the Arabic companion
 * faces of the creator templates, and no Arabic font on a German page.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axe(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  const results = await (include ? builder.include(include) : builder).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact ?? ""}): ${String(v.nodes.length)}× — ${v.nodes[0]?.target.join(" ") ?? ""}`);
}

/** The computed `scale` of every svg in a list: "-1 1" when mirrored, "none" when not. */
const scales = (page: Page, selector: string) =>
  page.locator(`${selector} svg`).evaluateAll((svgs) => svgs.map((svg) => getComputedStyle(svg).scale));

test.describe("/design: icons", () => {
  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: the registry, and directional glyphs mirrored exactly once by writing direction`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}/design#icons`);
      const section = page.locator("#icons");
      await expect(section.getByRole("heading", { level: 2 })).toBeVisible();
      // Six groups, every meaning a glyph with its code name; playback glyphs are filled.
      await expect(section.locator("[data-icon-group]")).toHaveCount(6);
      const tiles = section.locator("[data-icon-group] li");
      expect(await tiles.count()).toBeGreaterThan(70);
      expect(await section.locator("[data-icon-group] li svg").count()).toBe(await tiles.count());
      for (const fill of await section.locator('[data-icon-group="media"] svg').evaluateAll((svgs) => svgs.map((svg) => svg.getAttribute("fill")))) {
        expect(fill).toBe("currentColor");
      }
      // The same row in both directions: left to right nothing flips; right to left every glyph
      // flips once (the flip follows the row's own direction, also inside a page of the other one).
      const ltr = await scales(page, '[data-direction="ltr"]');
      const rtl = await scales(page, '[data-direction="rtl"]');
      expect(ltr.length).toBe(12);
      expect(new Set(ltr)).toEqual(new Set(["none"]));
      expect(new Set(rtl)).toEqual(new Set(["-1 1"]));
      // No list item or button around them is flipped too (a second flip would undo the first).
      const flippedParents = await page.locator('[data-testid="directional-icons"] li').evaluateAll((items) => items.filter((item) => getComputedStyle(item).scale !== "none").length);
      expect(flippedParents).toBe(0);
      expect(await axe(page, "#icons")).toEqual([]);
    });
  }

  test("strokes are the token widths in pixels at every size", async ({ page }) => {
    await page.goto("/de/design#icons");
    const widths = await page.locator("#icons figure svg").evaluateAll((svgs) =>
      svgs.slice(0, 4).map((svg) => {
        const box = svg.getBoundingClientRect();
        return Math.round(((Number(svg.getAttribute("stroke-width")) * box.width) / 24) * 100) / 100;
      }),
    );
    expect(widths).toEqual([1.5, 1.5, 1.6, 1.75]);
  });
});

test.describe("/design: UI kit", () => {
  test("de: the select works by keyboard", async ({ page }) => {
    await page.goto("/de/design#controls");
    const role = page.getByLabel("Rolle", { exact: true });
    await role.focus();
    await expect(role).toBeFocused();
    await expect(role).toHaveValue("");
    await page.keyboard.press("ArrowDown");
    await expect(role).toHaveValue("owner");
    await page.keyboard.press("End");
    await expect(role).toHaveValue("support");
    await page.keyboard.press("Home");
    await expect(role).toHaveValue("");
    // The hint is the field's description.
    await expect(role).toHaveAccessibleDescription("Was jemand im Team sehen und ändern darf.");
  });

  test("ar: the select runs right to left, with its chevron at the start of the line's end", async ({ page }) => {
    await page.goto("/ar/design#controls");
    const role = page.getByLabel("الدور", { exact: true });
    await expect(role).toHaveCSS("direction", "rtl");
    await role.focus();
    await page.keyboard.press("ArrowDown");
    await expect(role).toHaveValue("owner");
    const box = await role.boundingBox();
    const chevron = await role.locator("xpath=following-sibling::*[local-name()='svg']").boundingBox();
    expect(box && chevron).toBeTruthy();
    // In Arabic the end of the line is the left: the chevron sits in the field's left half.
    expect((chevron?.x ?? 0) + (chevron?.width ?? 0) / 2).toBeLessThan((box?.x ?? 0) + (box?.width ?? 0) / 2);
  });

  test("filters: a sheet by keyboard, chips that say they are on, and focus back on the trigger", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/de/design#controls");
    // The name is the visible label; how many filters are on is the description.
    const trigger = page.getByRole("button", { name: "Filter", exact: true });
    await expect(trigger).toHaveAccessibleDescription("1 Filter aktiv");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: "Filter" });
    await expect(sheet).toBeVisible();
    const free = sheet.getByRole("button", { name: "Free" });
    await expect(free).toHaveAttribute("aria-pressed", "false");
    await free.focus();
    await page.keyboard.press("Space");
    await expect(free).toHaveAttribute("aria-pressed", "true");
    expect(await axe(page, '[role="dialog"]')).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAccessibleDescription("2 Filter aktiv");
    // Each active filter can be removed on its own, and says which.
    await page.getByRole("button", { name: "Filter Pro entfernen" }).click();
    await expect(trigger).toHaveAccessibleDescription("1 Filter aktiv");
    expect(await axe(page, "#controls")).toEqual([]);
  });

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: the command palette by keyboard`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}/design#states`);
      await page.getByRole("button", { name: locale === "de" ? "Befehle öffnen" : "فتح الأوامر" }).click();
      const field = page.getByRole("combobox", { name: locale === "de" ? "Befehle" : "الأوامر" });
      await expect(field).toBeFocused();
      await expect(page.getByRole("option")).toHaveCount(5);
      await field.fill(locale === "de" ? "kunden" : "العملاء");
      const options = page.getByRole("option");
      await expect(options.first()).toHaveAttribute("aria-selected", "true");
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
      if (count > 1) {
        await page.keyboard.press("ArrowDown");
        await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
        await expect(field).toHaveAttribute("aria-activedescendant", (await options.nth(1).getAttribute("id")) ?? "");
        await page.keyboard.press("ArrowUp");
      }
      expect(await axe(page, '[role="dialog"]')).toEqual([]);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.getByText(locale === "de" ? "Ausgeführt: Kunden" : "تم: العملاء").first()).toBeVisible();
    });
  }

  test("figures: a change by arrow and words, and the numbers as a real table", async ({ page }) => {
    await page.goto("/de/design#states");
    const kpis = page.getByTestId("kit-kpis");
    await expect(kpis.getByText("Gestiegen:")).toBeAttached();
    await expect(kpis.getByText("Gesunken:")).toBeAttached();
    const toggle = page.getByRole("button", { name: "Als Tabelle zeigen" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.getByRole("button", { name: "Tabelle ausblenden" })).toHaveAttribute("aria-expanded", "true");
    const table = page.getByRole("table", { name: "Aufrufe pro Woche" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveCount(2);
    await expect(table.getByRole("rowheader")).toHaveCount(8);
    expect(await axe(page, "#states")).toEqual([]);
  });
});

test.describe("Arabic companions (C-03)", () => {
  const h1Font = async (page: Page, template: string) => {
    await page.goto(`/ar/directions/poster?chrome=0&template=${template}`);
    await page.evaluate(() => document.fonts.ready);
    return page.locator("h1").first().evaluate((element) => getComputedStyle(element).fontFamily);
  };

  test("Nocturne, Marquee and Daylight each keep their own face in Arabic", async ({ page }) => {
    const fonts = { nocturne: await h1Font(page, "nocturne"), marquee: await h1Font(page, "marquee"), daylight: await h1Font(page, "daylight") };
    expect(new Set(Object.values(fonts)).size).toBe(3);
  });

  test("Laufbahn keeps exactly the Arabic face it had", async ({ page }) => {
    const font = await h1Font(page, "laufbahn");
    const plex = await page.evaluate(() => getComputedStyle(document.querySelector(".poster-scope") ?? document.body).getPropertyValue("--font-face-plex-arabic").trim());
    expect(plex).not.toBe("");
    // The variable holds quoted names; the computed value drops the quotes around single words.
    const unquote = (value: string) => value.replace(/["']/g, "");
    expect(unquote(font)).toBe(unquote(`${plex}, "Geeza Pro", sans-serif`));
    expect(await page.locator("h1").first().evaluate((element) => getComputedStyle(element).fontWeight)).toBe("700");
  });

  test("the Arabic letters of a name are drawn in the companion, not in a fallback", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Reads the drawn fonts through the Chrome DevTools Protocol");
    const drawn: Record<string, string[]> = {};
    // Marquee shows a logo and keeps its name out of sight, so Signal stands for the Plex companion here.
    for (const template of ["nocturne", "daylight", "signal", "atelier", "folio", "pulse"]) {
      await h1Font(page, template);
      const session = await page.context().newCDPSession(page);
      await session.send("DOM.enable");
      await session.send("CSS.enable");
      const { root } = await session.send("DOM.getDocument", { depth: -1 });
      // The name's text sits in a bdi inside the heading (or straight in the heading).
      const inner = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: "h1 bdi" });
      const nodeId = inner.nodeId || (await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: "h1" })).nodeId;
      const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
      drawn[template] = fonts.map((font) => font.familyName);
      await session.detach();
    }
    expect(drawn.nocturne).toContain("Rakkas");
    expect(drawn.daylight).toContain("Lalezar");
    expect(drawn.signal).toContain("IBM Plex Sans Arabic");
    expect(drawn.atelier).toContain("Amiri");
    expect(drawn.folio).toContain("Readex Pro");
    expect(drawn.pulse).toContain("Changa");
  });
});

test.describe("no Arabic font on a German page", () => {
  /** The files of every Arabic face the page's styles declare (an Arabic-only unicode-range). */
  const arabicFaceFiles = (page: Page) =>
    page.evaluate(() => {
      const files: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (!(rule instanceof CSSFontFaceRule)) continue;
          if (!/^U\+600/i.test(rule.style.getPropertyValue("unicode-range").trim())) continue;
          for (const match of rule.style.getPropertyValue("src").matchAll(/url\("?([^")]+)"?\)/g)) files.push(new URL(match[1] ?? "", sheet.href ?? location.href).href);
        }
      }
      return [...new Set(files)];
    });

  test("/de/p/ronja-feldkamp loads none of them; an Arabic page does", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => {
      if (/\.woff2(\?|$)/.test(request.url())) requested.push(request.url());
    });
    await page.goto("/de/p/ronja-feldkamp");
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    });
    await page.waitForLoadState("networkidle");
    const arabic = await arabicFaceFiles(page);
    // Plex (product and companion) and the five vendored companions, seven files at least.
    expect(arabic.length).toBeGreaterThanOrEqual(7);
    expect(requested.filter((url) => arabic.includes(url))).toEqual([]);

    // The check sees them when they are used: an Arabic Nocturne page asks for its companion.
    requested.length = 0;
    await page.goto("/ar/directions/poster?chrome=0&template=nocturne");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("networkidle");
    const arabicHere = await arabicFaceFiles(page);
    expect(requested.filter((url) => arabicHere.includes(url)).length).toBeGreaterThan(0);
  });
});
