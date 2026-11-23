import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The portfolio page on its two templates (Werkbogen, Tiefdruck): the sample page of
 * /directions/poster?page=portfolio in de, en and ar. What a visitor sees on the first screen, that
 * reading order and source order agree in every layout and both directions, that nothing overflows
 * with the longest texts a page can hold, that it works without script and without motion, and
 * that the wide canvas only reaches the templates that ask for it.
 */
const TEMPLATES = ["werkbogen", "tiefdruck"] as const;
const LOCALES = ["de", "en", "ar"] as const;
const LAYOUTS = ["bento", "list", "rail"] as const;
type Template = (typeof TEMPLATES)[number] | "folio";

/** The sample's projects, in page order. */
const SLUGS = ["hafenlicht", "stadtbad", "termine", "rasterblick", "werkhalle", "schneiderinnen"] as const;
const PRIMARY = { de: "Projekt anfragen", en: "Ask about a project", ar: "اسأل عن مشروع" } as const;

const url = (locale: string, template: Template, extra = "", sample = "portfolio") => `/${locale}/directions/poster?chrome=0&template=${template}&page=${sample}${extra}`;

/** Opens a page as a visitor who has answered the privacy notice (it would cover the first screen). */
async function open(page: Page, path: string, viewport?: { width: number; height: number }) {
  if (viewport) await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("linkyo.privacy.v1", "essential");
    } catch {
      // No storage: the notice stays, which no check here depends on.
    }
  });
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

const box = async (page: Page, selector: string) => {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`No box for ${selector}`);
  return rect;
};

test.describe("first screen", () => {
  for (const locale of LOCALES) {
    for (const viewport of [
      { width: 390, height: 664 },
      { width: 360, height: 640 },
    ]) {
      test(`Werkbogen ${locale} at ${String(viewport.width)} × ${String(viewport.height)}: the plate fills at least 35 % of the screen`, async ({ page }) => {
        await open(page, url(locale, "werkbogen"), viewport);
        const plate = await box(page, "header [data-plate]");
        const visible = Math.min(plate.y + plate.height, viewport.height) - Math.max(plate.y, 0);
        expect(visible / viewport.height).toBeGreaterThanOrEqual(0.35);
        // The plate runs from edge to edge on a phone.
        expect(plate.x).toBe(0);
        expect(plate.width).toBe(viewport.width);
      });

      test(`Werkbogen ${locale} at ${String(viewport.width)} × ${String(viewport.height)}: with the longest name and role line the plate still starts on the first screen`, async ({ page }) => {
        await open(page, url(locale, "werkbogen", "", "portfolio-long"), viewport);
        const plate = await box(page, "header [data-plate]");
        expect(plate.y).toBeLessThan(viewport.height);
      });
    }

    test(`Werkbogen ${locale} at 390 × 844: the whole primary button is on the first screen`, async ({ page }) => {
      await open(page, url(locale, "werkbogen"), { width: 390, height: 844 });
      const button = page.locator("[data-hero-actions] a").first();
      await expect(button).toHaveText(PRIMARY[locale]);
      const rect = await box(page, "[data-hero-actions] a");
      expect(rect.y + rect.height).toBeLessThanOrEqual(844);
      // Full width on a phone, and a full control.
      expect(rect.width).toBe(350);
      expect(rect.height).toBeGreaterThanOrEqual(56);
      // The plate is the first project, named with its place.
      const total = String(SLUGS.length);
      const name = { de: `Projekt 1 von ${total}: Hafenlicht`, en: `Project 1 of ${total}: Hafenlicht`, ar: `المشروع 1 من ${total}: ضوء الميناء` }[locale];
      // The name starts with these words; role and year follow.
      await expect(page.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
    });

    test(`Tiefdruck ${locale} at 390 × 844: name, role line, the whole primary button and the top of the first row are on the first screen`, async ({ page }) => {
      await open(page, url(locale, "tiefdruck"), { width: 390, height: 844 });
      const name = await box(page, "header h1");
      expect(name.y + name.height).toBeLessThanOrEqual(844);
      const role = await box(page, "header h1 >> xpath=../following-sibling::p[1]");
      expect(role.y + role.height).toBeLessThanOrEqual(844);
      const button = await box(page, "[data-hero-actions] a");
      expect(button.y + button.height).toBeLessThanOrEqual(844);
      const row = await box(page, "main ol > li");
      expect(row.y).toBeLessThan(844);
      // No large picture in this hero: only the small round portrait.
      expect(await page.locator("header img").count()).toBe(1);
    });

    test(`Tiefdruck ${locale} at 320 × 640: the primary button is on the first screen`, async ({ page }) => {
      await open(page, url(locale, "tiefdruck"), { width: 320, height: 640 });
      const button = await box(page, "[data-hero-actions] a");
      expect(button.y + button.height).toBeLessThanOrEqual(640);
    });
  }
});

test.describe("reading order", () => {
  for (const template of TEMPLATES) {
    for (const layout of LAYOUTS) {
      for (const locale of ["de", "ar"] as const) {
        for (const width of [390, 1440]) {
          test(`${template} ${layout} ${locale} at ${String(width)}: cards stand in source order, in the reading direction`, async ({ page }) => {
            await open(page, url(locale, template, `&projects=${layout}`), { width, height: 900 });
            // The layout asked for is the layout shown.
            const shape = layout === "bento" ? "main [role=list]" : layout === "rail" ? "main [role=region] > ol" : "main ol";
            await expect(page.locator(shape).first()).toBeVisible();
            const ids = await page.evaluate((slugs) => Array.from(document.querySelectorAll("[id]")).map((element) => element.id).filter((id) => slugs.includes(id)), [...SLUGS] as string[]);
            expect(ids).toEqual([...SLUGS]);
            const rects = await page.evaluate(
              (slugs) =>
                slugs.map((slug) => {
                  const rect = document.getElementById(slug)?.getBoundingClientRect();
                  return rect ? { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY, left: rect.left, right: rect.right } : null;
                }),
              [...SLUGS] as string[],
            );
            for (let index = 1; index < rects.length; index += 1) {
              const before = rects[index - 1];
              const after = rects[index];
              if (!before || !after) throw new Error(`No box for ${SLUGS[index] ?? ""}`);
              const below = after.top >= before.bottom - 1;
              const beside = locale === "ar" ? after.right <= before.left + 1 : after.left >= before.right - 1;
              expect(below || beside, `${SLUGS[index] ?? ""} follows ${SLUGS[index - 1] ?? ""}`).toBe(true);
            }
          });
        }
      }
    }
  }

  test("in Arabic the rail's first card touches the inline-start gutter", async ({ page }) => {
    for (const template of TEMPLATES) {
      // The first card of the run the rail shows (Werkbogen's plate has taken the first project).
      const first = template === "werkbogen" ? "stadtbad" : "hafenlicht";
      await open(page, url("ar", template, "&projects=rail"), { width: 390, height: 844 });
      const phone = await box(page, `main [role=region] #${first}`);
      expect(Math.round(phone.x + phone.width), `${template} phone`).toBe(390 - 20);
      await open(page, url("ar", template, "&projects=rail"), { width: 1440, height: 900 });
      const edges = await page.evaluate((id) => {
        const track = document.querySelector("main [role=region] > ol");
        const card = document.getElementById(id);
        if (!track || !card) return null;
        return { track: track.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(track).paddingInlineStart), card: card.getBoundingClientRect().right, main: document.querySelector("main")?.getBoundingClientRect().right ?? 0 };
      }, first);
      expect(edges, template).not.toBeNull();
      expect(Math.abs((edges?.card ?? 0) - (edges?.track ?? 0)), `${template} desktop`).toBeLessThanOrEqual(1);
      // On the wide canvas that is the canvas's own edge.
      expect(Math.abs((edges?.card ?? 0) - (edges?.main ?? 0)), `${template} canvas`).toBeLessThanOrEqual(1);
    }
  });

  test("in Arabic the calm template sets the name light and the bold one heavy", async ({ page }) => {
    const weights: Record<string, string> = {};
    for (const template of TEMPLATES) {
      await open(page, url("ar", template));
      weights[template] = await page.locator("header h1").evaluate((element) => getComputedStyle(element).fontWeight);
      await expect(page.locator(".poster-scope")).toHaveAttribute("dir", "rtl");
    }
    expect(weights).toEqual({ werkbogen: "400", tiefdruck: "700" });
  });
});

test.describe("longest texts", () => {
  for (const template of TEMPLATES) {
    for (const locale of ["de", "ar"] as const) {
      for (const layout of LAYOUTS) {
        test(`${template} ${layout} ${locale} at 320 px: nothing is wider than the screen`, async ({ page }) => {
          await open(page, url(locale, template, `&projects=${layout}`, "portfolio-long"), { width: 320, height: 640 });
          const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
          expect(size.scroll).toBeLessThanOrEqual(size.client);
          // No card pokes out of the page (a rail scrolls inside its own region).
          const out = await page.evaluate(() =>
            Array.from(document.querySelectorAll("header *, main *"))
              .filter((element) => !element.closest("[role=region]") && !element.closest(".sr-only"))
              .filter((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && (rect.left < -0.5 || rect.right > window.innerWidth + 0.5);
              })
              .map((element) => `${element.tagName.toLowerCase()}.${(element.getAttribute("class") ?? "").slice(0, 60)}`),
          );
          expect(out).toEqual([]);
          // Eight projects: six show, two wait behind "Show all".
          await expect(page.locator("main details summary")).toBeVisible();
        });
      }
    }
  }
});

test.describe("touch targets", () => {
  for (const template of TEMPLATES) {
    for (const layout of LAYOUTS) {
      test(`${template} ${layout}: everything that can be tapped is at least 44 × 44`, async ({ page }) => {
        await open(page, url("de", template, `&projects=${layout}`, "portfolio-long"), { width: 390, height: 844 });
        await page.locator("main details summary").click();
        const small = await page.evaluate(() =>
          Array.from(document.querySelectorAll("header a, header button, main a, main button, main summary, main [tabindex='0']"))
            .map((element) => ({ element, rect: element.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && rect.height > 0)
            .filter(({ rect }) => rect.width < 44 || rect.height < 44)
            .map(({ element, rect }) => `${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 30)}" ${String(Math.round(rect.width))}×${String(Math.round(rect.height))}`),
        );
        expect(small).toEqual([]);
      });
    }
  }

  test("once the hero has scrolled away the bar repeats the primary action, with the same words", async ({ page }) => {
    for (const template of TEMPLATES) {
      await open(page, url("de", template), { width: 390, height: 844 });
      const hero = page.locator("[data-hero-actions] a").first();
      const action = page.locator("[data-bar-action]");
      await expect(action).toBeHidden();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(action).toBeVisible();
      expect(await action.innerText()).toBe(await hero.innerText());
      await expect(action).toHaveAttribute("href", (await hero.getAttribute("href")) ?? "");
      const rect = await box(page, "[data-bar-action]");
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("reduced motion", () => {
  for (const template of TEMPLATES) {
    test(`${template}: nothing moves and every section is fully there`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, ...(baseURL ? { baseURL } : {}) });
      const page = await context.newPage();
      await open(page, url("de", template));
      // Time-based animations only: the hero's scroll-linked fade is opacity only with reduced motion.
      const moving = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running" && animation.timeline === document.timeline)
          .map((animation) => (animation instanceof CSSAnimation ? animation.animationName : "transition")),
      );
      expect(moving).toEqual([]);
      for (const y of [0, 600, 1400, 2400]) {
        await page.evaluate((to) => window.scrollTo(0, to), y);
        const faint = await page.evaluate(() =>
          Array.from(document.querySelectorAll("main > *, header > *"))
            .filter((element) => {
              const style = getComputedStyle(element);
              return style.opacity !== "1" || (style.transform !== "none" && style.transform !== "matrix(1, 0, 0, 1, 0, 0)") || (style.translate !== "none" && style.translate !== "0px");
            })
            .map((element) => element.tagName.toLowerCase()),
        );
        expect(faint, `at ${String(y)}`).toEqual([]);
      }
      await context.close();
    });
  }
});

test.describe("without script", () => {
  for (const template of TEMPLATES) {
    for (const locale of ["de", "ar"] as const) {
      test(`${template} ${locale}: every title, sentence and link is in the page, and "Show all" opens`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, ...(baseURL ? { baseURL } : {}) });
        const page = await context.newPage();
        const response = await page.goto(url(locale, template, "", "portfolio-long"));
        expect(response?.status()).toBe(200);
        // Name, role line and the primary action.
        await expect(page.locator("header h1")).toBeVisible();
        await expect(page.locator("[data-hero-actions] a").first()).toHaveAttribute("href", /^mailto:/);
        // Eight projects, each with its title and its sentence; seven with a link (six pages, one address).
        const cards = page.locator("header [id], main [id]").filter({ has: page.locator("p") });
        await expect(cards).toHaveCount(8);
        const texts = await cards.evaluateAll((elements) => elements.map((element) => ({ id: element.id, title: element.querySelector("h3, p")?.textContent ?? "", lines: element.querySelectorAll("p").length, href: element.querySelector("a")?.getAttribute("href") ?? null })));
        for (const card of texts) {
          expect(card.title.trim().length, card.id).toBeGreaterThan(0);
          expect(card.lines, card.id).toBeGreaterThanOrEqual(1);
          expect(card.href, card.id).not.toBeNull();
        }
        const base = `/${locale}/directions/poster/work`;
        expect(texts.map((card) => card.href)).toEqual([
          `${base}/hafenlicht?chrome=0&template=${template}`,
          `${base}/stadtbad?chrome=0&template=${template}`,
          `${base}/termine?chrome=0&template=${template}`,
          `${base}/rasterblick?chrome=0&template=${template}`,
          `${base}/werkhalle?chrome=0&template=${template}`,
          "https://example.com/schneiderinnen",
          `${base}/termine-2?chrome=0&template=${template}`,
          `${base}/rasterblick-2?chrome=0&template=${template}`,
        ]);
        // "Show all" is a native details element: it opens without script.
        const more = page.locator("main details");
        const hidden = more.locator("li").first();
        await expect(hidden).toBeHidden();
        await more.locator("summary").click();
        await expect(hidden).toBeVisible();
        await expect(more.locator("li a")).toHaveCount(2);
        // The section titles of the other sections are there too.
        expect(await page.locator("main h2").count()).toBeGreaterThanOrEqual(5);
        await context.close();
      });
    }
  }
});

test.describe("the wide canvas", () => {
  const workWidth = async (page: Page) =>
    page.evaluate(() => {
      const first = document.getElementById("stadtbad");
      const list = first?.closest("[role=list], ol");
      return list ? list.getBoundingClientRect().width : 0;
    });

  for (const template of TEMPLATES) {
    test(`${template} at 1280 px: the work is wider than 1000 px`, async ({ page }) => {
      await open(page, url("de", template), { width: 1280, height: 800 });
      expect(await workWidth(page)).toBeGreaterThan(1000);
      const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(size.scroll).toBeLessThanOrEqual(size.client);
    });

    test(`${template} between phone and desktop: the page is the 560 px column`, async ({ page }) => {
      await open(page, url("de", template), { width: 1000, height: 800 });
      expect(await workWidth(page)).toBe(560);
    });
  }

  test("Folio at 1280 px shows the same sample in its 560 px column", async ({ page }) => {
    await open(page, url("de", "folio"), { width: 1280, height: 800 });
    expect(await workWidth(page)).toBe(560);
    // Every project is on the page, as a card.
    for (const slug of SLUGS) await expect(page.locator(`#${slug}`)).toBeVisible();
  });

  test("a text section reads beside its title on the wide canvas, and under it on a phone", async ({ page }) => {
    // The default sample has link and date sections; the portfolio templates show them too.
    await open(page, "/de/directions/poster?chrome=0&template=werkbogen", { width: 1440, height: 900 });
    const wide = await page.evaluate(() => {
      const section = Array.from(document.querySelectorAll("main > section")).find((element) => element.querySelector("a[href^='https://tickets']"));
      const title = section?.querySelector("h2")?.getBoundingClientRect();
      const content = section?.lastElementChild?.getBoundingClientRect();
      return title && content ? { titleRight: title.right, contentLeft: content.left, contentWidth: content.width, sameRow: Math.abs(title.top - content.top) < 40 } : null;
    });
    expect(wide).not.toBeNull();
    expect(wide?.sameRow).toBe(true);
    expect(wide?.contentLeft).toBeGreaterThanOrEqual(wide?.titleRight ?? Infinity);
    expect(wide?.contentWidth).toBe(560);
    await open(page, "/de/directions/poster?chrome=0&template=werkbogen", { width: 390, height: 844 });
    const phone = await page.evaluate(() => {
      const section = Array.from(document.querySelectorAll("main > section")).find((element) => element.querySelector("a[href^='https://tickets']"));
      const title = section?.querySelector("h2")?.getBoundingClientRect();
      const content = section?.lastElementChild?.getBoundingClientRect();
      return title && content ? content.top >= title.bottom : null;
    });
    expect(phone).toBe(true);
  });
});

test.describe("accessibility", () => {
  for (const template of TEMPLATES) {
    for (const locale of ["de", "ar"] as const) {
      for (const layout of LAYOUTS) {
        test(`axe: ${template} ${layout} ${locale}`, async ({ page }) => {
          await page.emulateMedia({ reducedMotion: "reduce" });
          await open(page, url(locale, template, `&projects=${layout}`));
          await page.waitForLoadState("load");
          const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
          expect(results.violations.map((violation) => `${violation.id} (${String(violation.impact)}): ${String(violation.nodes.length)}× — ${violation.nodes[0]?.target.join(" ") ?? ""}`)).toEqual([]);
        });
      }
      test(`axe: ${template} ${locale} with the longest texts and "Show all" open`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await open(page, url(locale, template, "", "portfolio-long"));
        await page.locator("main details summary").click();
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(results.violations.map((violation) => `${violation.id} (${String(violation.impact)}): ${String(violation.nodes.length)}× — ${violation.nodes[0]?.target.join(" ") ?? ""}`)).toEqual([]);
      });
    }
  }
});
