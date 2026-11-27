import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Laufbahn round 6 ("Dossier", ADR 0069) on fictional pages only: the application example (Jonas
 * Brandt in German and English, Karim Nasser in Arabic) on the sample route and as example pages, and
 * the portfolio sample. Its first screen, the documents offer (de and en) with the real PDFs behind
 * every link and a press that downloads one (ADR 0089), and its absence (ar), the
 * bar on ink with one Share, the contents sheet with its documents group, axe, the white focus ring on
 * ink, no shadow and no underline, reduced motion, and Geist as the only face.
 *
 *   PORT=<port> npx playwright test e2e/laufbahn-dossier-app.spec.ts
 *
 * Phone checks run on the mobile project at their own sizes; laptop checks on the desktop project.
 * With LB_SHOTS=<folder> the checks also save their pictures there (review captures, not compared).
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SHOTS = process.env.LB_SHOTS;

const application = (locale: string) => `/${locale}/directions/poster?chrome=0&template=laufbahn&page=application`;
const portfolio = (locale: string) => `/${locale}/directions/poster?chrome=0&template=laufbahn&page=portfolio`;
/** The same applicant without his contact block: the hero then leads with "Anschreiben lesen". */
const noContact = (locale: string) => `/${locale}/directions/poster?chrome=0&template=laufbahn&page=application-no-contact`;
/** The page every document of the example lives under (the sample route offers the example page's own). */
const BASES: Record<string, string> = { de: "/de/p/jonas-brandt", en: "/en/p/jonas-brandt" };
const FILES: Record<string, Record<string, string>> = {
  de: { cv: "Lebenslauf_Jonas_Brandt.pdf", letter: "Anschreiben_Jonas_Brandt.pdf", application: "Bewerbung_Jonas_Brandt.pdf" },
  en: { cv: "CV_Jonas_Brandt.pdf", letter: "Cover_letter_Jonas_Brandt.pdf", application: "Application_Jonas_Brandt.pdf" },
};
const ROUTES = [application("de"), application("en"), application("ar"), portfolio("de"), "/de/p/jonas-brandt", "/en/p/jonas-brandt", "/ar/p/karim-nasser"];

async function open(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string, fullPage = false) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage, animations: "disabled" });
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

/** The bottom edge of the first element a selector names, in CSS px from the top of the page. */
const bottom = (page: Page, selector: string) => page.locator(selector).first().evaluate((element) => element.getBoundingClientRect().bottom + window.scrollY);

/** Scrolls until the name has passed under the bar (the bar then fades in; at once with reduced motion). */
async function pastName(page: Page) {
  await page.evaluate(() => {
    const name = document.querySelector("[data-lb-name]");
    window.scrollTo({ top: (name?.getBoundingClientRect().bottom ?? 0) + window.scrollY + 200, behavior: "instant" });
  });
  await expect(page.locator(".poster-bar")).toHaveAttribute("data-lb-shown", "");
}

test.describe("on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone sizes on the mobile project");

  for (const locale of ["de", "en"] as const) {
    test(`${locale}: the first screen holds the status, the name, the role, the target line and both actions (390 × 844, 360 × 780)`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, application(locale));
      for (const selector of ["[data-lb-head] p:has(.bg-success)", "h1", "[data-lb-role]", "[data-lb-target]", "[data-hero-actions]"]) {
        expect(await bottom(page, selector), selector).toBeLessThanOrEqual(844);
      }
      await shot(page, `${locale}-390-fold`);
      await shot(page, `${locale}-390-full`, true);
      await page.setViewportSize({ width: 360, height: 780 });
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      for (const selector of ["h1", "[data-lb-target]", "[data-hero-actions]", "[data-lb-head] dl dd"]) {
        expect(await bottom(page, selector), selector).toBeLessThanOrEqual(780);
      }
      await shot(page, `${locale}-360-fold`);
    });
  }

  test("ar: mirrored, no documents anywhere, Share as the second action (390 × 844)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, application("ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await page.locator('a[href$="/cv"], a[href$="/letter"], a[href$="/application"], a[download]').count()).toBe(0);
    expect(await page.locator("body").innerText()).not.toContain("PDF");
    await expect(page.locator("[data-hero-actions] > *").nth(1)).toHaveText("مشاركة");
    await shot(page, "ar-390-fold");
    await shot(page, "ar-390-full", true);
  });

  test("de without a contact block: 'Anschreiben lesen' and 'Lebenslauf' side by side at 390 px, stacked at full width at 360 px", async ({ page }) => {
    for (const [width, height, together] of [
      [390, 844, true],
      [360, 780, false],
    ] as const) {
      await page.setViewportSize({ width, height });
      await open(page, noContact("de"));
      const actions = page.locator("[data-hero-actions]");
      const lead = actions.getByRole("link", { name: "Anschreiben lesen" });
      const cv = actions.getByRole("link", { name: /^Lebenslauf herunterladen \(PDF, \d+ Seiten?\)$/ });
      await expect(lead).toHaveAttribute("href", /#section-letter/);
      await expect(cv).toHaveAttribute("download", "Lebenslauf_Jonas_Brandt.pdf");
      const [a, b, row] = [await lead.boundingBox(), await cv.boundingBox(), await actions.boundingBox()];
      const where = `${String(width)}: ${JSON.stringify([a, b, row])}`;
      expect(a && b && row, where).toBeTruthy();
      if (!a || !b || !row) continue;
      expect(a.height >= 48 && Math.abs(b.height - a.height) < 1, where).toBe(true);
      if (together) expect(Math.abs(a.y - b.y) < 1 && a.width > b.width, where).toBe(true);
      else expect(b.y >= a.y + a.height && Math.abs(a.x - b.x) < 1 && Math.abs(a.width - row.width) < 1 && Math.abs(b.width - row.width) < 1, where).toBe(true);
      expect(b.y + b.height, where).toBeLessThanOrEqual(height);
      await shot(page, `de-${String(width)}-no-contact`);
    }
  });

  test("the bar stays away while the name is on screen, comes in on ink, and opens the contents with the documents", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, application("de"));
    const bar = page.locator(".poster-bar");
    await expect(bar).toBeHidden();
    await pastName(page);
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(10, 10, 11)");
    // Phones: the CV as one round download, the primary action round and white, and no Share beside the download.
    // (Hidden links, such as the wide canvas's pills and the closed sheet's rows, have no role here.)
    await expect(bar.getByRole("link", { name: "Lebenslauf herunterladen (PDF)" })).toHaveAttribute("download", "Lebenslauf_Jonas_Brandt.pdf");
    await expect(bar.getByRole("button", { name: "Seite teilen" })).toBeHidden();
    await shot(page, "de-390-bar");
    const opener = bar.getByRole("button", { name: /Inhalt öffnen/ });
    await opener.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Unterlagen" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Lebenslauf · PDF herunterladen" })).toHaveAttribute("download", "Lebenslauf_Jonas_Brandt.pdf");
    await expect(sheet.getByRole("link", { name: "Anschreiben · PDF herunterladen" })).toHaveAttribute("href", "/de/p/jonas-brandt/letter");
    // Both in one file, as the third row of the group, its name ending "(PDF)".
    const both = sheet.getByRole("link", { name: "Beides in einer Datei · 2 Seiten: Anschreiben und Lebenslauf (PDF)" });
    await expect(both).toHaveAttribute("download", "Bewerbung_Jonas_Brandt.pdf");
    await expect(both).toHaveText("Beides in einer Datei · 2 Seiten");
    await expect(sheet.getByRole("list", { name: "Unterlagen" }).getByRole("link")).toHaveCount(3);
    await shot(page, "de-390-sheet");
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("the Arabic contents sheet has no documents group", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, application("ar"));
    await pastName(page);
    await page.locator(".poster-bar").getByRole("button", { name: /فتح/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    expect(await sheet.locator("a[download]").count()).toBe(0);
    await shot(page, "ar-390-sheet");
  });
});

test.describe("on a laptop", () => {
  test.skip(({ isMobile }) => isMobile, "laptop sizes on the desktop project");

  for (const locale of ["de", "en", "ar"] as const) {
    test(`${locale}: the head's words, actions and figures are on the first screen (1440 × 900), one Share in the bar`, async ({ page }) => {
      await open(page, application(locale));
      for (const selector of ["h1", "[data-lb-role]", "[data-lb-target]", "[data-hero-actions]", "[data-lb-head] dl"]) {
        expect(await bottom(page, selector), selector).toBeLessThanOrEqual(900);
      }
      await shot(page, `${locale}-1440-fold`);
      await shot(page, `${locale}-1440-full`, true);
      await pastName(page);
      const bar = page.locator(".poster-bar");
      // Never two Share buttons: the phone's fallback stays on phones.
      const shares = bar.getByRole("button", { name: locale === "ar" ? "شارك الصفحة" : locale === "en" ? "Share page" : "Seite teilen" });
      await expect(shares).toHaveCount(1);
      await expect(shares).toBeVisible();
      if (locale !== "ar") {
        await expect(bar.getByRole("link", { name: locale === "de" ? "Lebenslauf herunterladen (PDF)" : "Download CV (PDF)" })).toBeVisible();
        await expect(bar.getByRole("link", { name: locale === "de" ? "Anschreiben herunterladen (PDF)" : "Download cover letter (PDF)", exact: true })).toBeVisible();
        // The bar keeps to the two documents (both in one file is the sheet's and the Unterlagen section's).
        await expect(bar.locator('a[href$="/application"]:visible')).toHaveCount(0);
      }
      await shot(page, `${locale}-1440-bar`);
    });
  }

  test("de: Werdegang, Unterlagen and Kontakt on the wide canvas, the cards' hover and focus", async ({ page }) => {
    await open(page, application("de"));
    for (const [name, selector] of [
      ["werdegang", "#section-career"],
      ["unterlagen", "#unterlagen"],
      ["kontakt", "[data-lb-contact]"],
      ["anschreiben", "#section-letter-title"],
    ] as const) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.evaluate((target) => document.querySelector(target)?.scrollIntoView({ block: "start", behavior: "instant" }), selector);
      await shot(page, `de-1440-${name}`);
    }
    const card = page.locator("#unterlagen a[download]").first();
    await card.hover();
    await shot(page, "de-1440-unterlagen-hover");
    await card.focus();
    const outline = await card.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).toBe("solid");
    await shot(page, "de-1440-unterlagen-focus");
  });
});

for (const locale of ["de", "en"] as const) {
  test(`${locale}: every download is a real link under the page's base with the contract's file name and "PDF" in its name`, async ({ page }) => {
    await open(page, application(locale));
    const links = page.locator("a[download]");
    const count = await links.count();
    // The hero, the bar (phone round + two pills), the sheet (three rows), the letter, two cards, "both", the Kontakt band (two rows).
    expect(count).toBeGreaterThanOrEqual(13);
    for (let index = 0; index < count; index += 1) {
      const link = links.nth(index);
      const href = (await link.getAttribute("href")) ?? "";
      const kind = /\/(cv|letter|application)$/.exec(href)?.[1] ?? "";
      expect(href.startsWith(`${BASES[locale] ?? ""}/`), href).toBe(true);
      expect(kind, href).not.toBe("");
      expect(await link.getAttribute("download")).toBe(FILES[locale]?.[kind]);
      // Its name starts with its visible words (WCAG 2.5.3) and says it is a PDF: an aria-label, or the
      // card's own words. The app hands every one of them over.
      const name = (await link.getAttribute("aria-label")) ?? (await link.innerText());
      expect(name, href).toContain("PDF");
      expect(await link.getAttribute("data-app-download"), href).toBe("");
    }
    // A card is named by its own words, in reading order, each part apart (never "LebenslaufPDF").
    const card = page.locator('#unterlagen a[download][href$="/cv"]');
    await expect(card).toHaveAccessibleName(locale === "de" ? "Lebenslauf PDF · A4 · 1 Seite Herunterladen" : "CV PDF · A4 · 1 page Download");
  });

  test(`${locale}: every address the page links to answers a real PDF, private and never indexed`, async ({ page, request }) => {
    await open(page, application(locale));
    const hrefs = [...new Set(await page.locator("a[download]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? "")))].sort();
    const base = BASES[locale] ?? "";
    expect(hrefs).toEqual([`${base}/application`, `${base}/cv`, `${base}/letter`]);
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
      const headers = response.headers();
      const kind = /\/(cv|letter|application)$/.exec(href)?.[1] ?? "";
      expect(headers["content-type"], href).toBe("application/pdf");
      expect(headers["content-disposition"], href).toContain(`attachment; filename="${FILES[locale]?.[kind] ?? ""}"`);
      expect(headers["x-robots-tag"], href).toBe("noindex, nofollow");
      expect(headers["cache-control"], href).toBe("private, no-store");
      const text = (await response.body()).toString("latin1");
      expect(text.startsWith("%PDF-1.7\n"), href).toBe(true);
      expect(text.endsWith("%%EOF\n"), href).toBe(true);
      // The page's cards show the real page count: one page each, two for both in one file.
      expect(text.match(/\/Type \/Page /gu), href).toHaveLength(kind === "application" ? 2 : 1);
    }
  });
}

test("de: a press on the hero's Lebenslauf, a card and 'Beides' is the browser's own download of a valid PDF", async ({ page }) => {
  await open(page, application("de"));
  const buttons = [
    { link: page.locator("[data-hero-actions] a[download]").first(), file: "Lebenslauf_Jonas_Brandt.pdf", pages: 1 },
    { link: page.locator('#unterlagen a[download][href$="/letter"]').first(), file: "Anschreiben_Jonas_Brandt.pdf", pages: 1 },
    { link: page.locator('#unterlagen a[download][href$="/application"]').first(), file: "Bewerbung_Jonas_Brandt.pdf", pages: 2 },
  ];
  for (const { link, file, pages } of buttons) {
    await link.scrollIntoViewIfNeeded();
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe(file);
    expect(await download.failure()).toBeNull();
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    const text = Buffer.concat(chunks).toString("latin1");
    expect(text.startsWith("%PDF-1.7\n"), file).toBe(true);
    expect(text.endsWith("%%EOF\n"), file).toBe(true);
    expect(text.match(/\/Type \/Page /gu), file).toHaveLength(pages);
    expect(text, file).toContain("/Author (Jonas Brandt)");
  }
  // Downloading leaves the page where it was: no navigation, no error page.
  const url = new URL(page.url());
  expect(`${url.pathname}${url.search}`).toBe(application("de"));
});

for (const path of ROUTES) {
  test(`${path}: axe-clean, nothing too wide at 360, 390, 768 and 1440, no shadow and no underline`, async ({ page, isMobile }) => {
    test.setTimeout(120_000);
    await open(page, path);
    const widths = isMobile ? [360, 390, 768] : [1440];
    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${String(width)} px`).toBeLessThanOrEqual(0);
    }
    expect(await axe(page)).toEqual([]);
    const flat = await page.evaluate(() =>
      [...document.querySelectorAll("body *")].flatMap((element) => {
        const style = getComputedStyle(element);
        const problems: string[] = [];
        if (style.boxShadow !== "none") problems.push(`box-shadow on ${element.tagName}`);
        if (style.textShadow !== "none") problems.push(`text-shadow on ${element.tagName}`);
        if (style.filter.includes("drop-shadow")) problems.push(`drop-shadow on ${element.tagName}`);
        if (element.tagName === "A" && style.textDecorationLine !== "none") problems.push(`underline on ${element.textContent.slice(0, 20)}`);
        return problems;
      }),
    );
    expect(flat).toEqual([]);
  });
}

for (const locale of ["de", "ar"] as const) {
  test(`${locale}: every step's dot sits on the career's rail, centre on centre`, async ({ page, isMobile }) => {
    for (const width of isMobile ? [390, 360] : [1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await open(page, application(locale));
      await page.locator("#section-career").scrollIntoViewIfNeeded();
      const offsets = await page.locator("#section-career .lb-step").evaluateAll((steps) =>
        steps.map((step) => {
          const box = step.getBoundingClientRect();
          const style = getComputedStyle(step);
          const rtl = style.direction === "rtl";
          const rail = Number.parseFloat(rtl ? style.borderRightWidth : style.borderLeftWidth);
          const railCentre = rtl ? box.right - rail / 2 : box.left + rail / 2;
          const dot = step.querySelector(":scope > span[aria-hidden]")?.getBoundingClientRect();
          return dot ? Math.abs(dot.left + dot.width / 2 - railCentre) : Number.POSITIVE_INFINITY;
        }),
      );
      expect(offsets.length, `${String(width)} px`).toBe(4);
      for (const offset of offsets) expect(offset, `${String(width)} px: ${JSON.stringify(offsets)}`).toBeLessThanOrEqual(0.5);
    }
    await page.locator("#section-career").evaluate((section) => section.scrollIntoView({ block: "start", behavior: "instant" }));
    await shot(page, `${locale}-${isMobile ? "phone" : "1440"}-rail`);
  });
}

/** A node of CDP's DOM tree, as far as the font check reads it. */
interface DomNode {
  nodeId: number;
  nodeType: number;
  nodeName: string;
  nodeValue: string;
  children?: DomNode[];
}

test("ar: every text of the head, main and the Kontakt band is drawn in Geist or IBM Plex Sans Arabic, nothing in a system face", async ({ page }) => {
  await open(page, application("ar"));
  const client = await page.context().newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  const { root } = (await client.send("DOM.getDocument", { depth: -1 })) as { root: DomNode };
  // The fonts Chrome actually drew for each element that holds text of its own, region by region: the
  // head (status, name, role, target line, facts, figures), main (About's lead with "SAP" and "2017",
  // the facts with "(B1)", the skills, the career, the letter with its dates, the documents) and the
  // Kontakt band (its title, the e-mail address, the footer). Plex's unicode-range sends every Latin
  // letter, digit and sign on to Geist; any other family is a system face standing in.
  const regions: Record<string, string> = { head: "[data-lb-head]", main: "main", contact: "[data-lb-contact]" };
  const allowed = ["Geist", "IBM Plex Sans Arabic"];
  const strays: string[] = [];
  for (const [region, selector] of Object.entries(regions)) {
    const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    expect(nodeId, selector).toBeGreaterThan(0);
    const find = (node: DomNode): DomNode | undefined => (node.nodeId === nodeId ? node : node.children?.map(find).find(Boolean));
    const start = find(root);
    expect(start, selector).toBeDefined();
    const holders: DomNode[] = [];
    const walk = (node: DomNode) => {
      if (node.nodeType === 1 && node.children?.some((child) => child.nodeType === 3 && child.nodeValue.trim() !== "")) holders.push(node);
      node.children?.forEach(walk);
    };
    if (start) walk(start);
    const used: Record<string, number> = {};
    let drawn = 0;
    for (const holder of holders) {
      const { fonts } = (await client.send("CSS.getPlatformFontsForNode", { nodeId: holder.nodeId })) as { fonts: { familyName: string; glyphCount: number }[] };
      if (fonts.length > 0) drawn += 1;
      for (const font of fonts) {
        used[font.familyName] = (used[font.familyName] ?? 0) + font.glyphCount;
        if (!allowed.includes(font.familyName)) {
          const words = (holder.children ?? []).filter((child) => child.nodeType === 3).map((child) => child.nodeValue.trim()).join(" ");
          strays.push(`${region} <${holder.nodeName.toLowerCase()}> "${words.slice(0, 60)}": ${font.familyName} ${String(font.glyphCount)}`);
        }
      }
    }
    // The walk read the region: many elements with text, each face drawing some of it.
    expect(drawn, `${region}: ${JSON.stringify(used)}`).toBeGreaterThan(region === "main" ? 40 : 5);
    expect(used.Geist ?? 0, `${region}: ${JSON.stringify(used)}`).toBeGreaterThan(0);
    expect(used["IBM Plex Sans Arabic"] ?? 0, `${region}: ${JSON.stringify(used)}`).toBeGreaterThan(0);
  }
  expect(strays).toEqual([]);
  // The places the round 6 review found in a system face: the e-mail address in the band and the
  // years of the career, each with its Latin in Geist now.
  const fontsOf = async (selector: string): Promise<Record<string, number>> => {
    const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
    const used: Record<string, number> = {};
    for (const nodeId of nodeIds) {
      const { fonts } = (await client.send("CSS.getPlatformFontsForNode", { nodeId })) as { fonts: { familyName: string; glyphCount: number }[] };
      for (const font of fonts) used[font.familyName] = (used[font.familyName] ?? 0) + font.glyphCount;
    }
    return used;
  };
  const email = await fontsOf("[data-lb-contact] a[href^='mailto:'] bdi[dir=ltr]");
  expect(Object.keys(email), JSON.stringify(email)).toEqual(["Geist"]);
  const years = await fontsOf("#section-career bdi");
  expect(years.Geist ?? 0, JSON.stringify(years)).toBeGreaterThan(0);
  expect(years["IBM Plex Sans Arabic"] ?? 0, JSON.stringify(years)).toBeGreaterThan(0);
});

test("reduced motion: nothing animates, after load and after scrolling, and the career's rail is drawn in full", async ({ page }) => {
  await open(page, application("de"));
  // The pointer rests outside the page: a card under it would run its colour change, which reduced
  // motion keeps (a colour, no movement), and the count below is about motion.
  await page.mouse.move(0, 0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.locator("#section-career").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "instant" }));
  await page.mouse.move(0, 0);
  // Nothing moves: no animation, and no transition but a fade or a colour's (reduced motion keeps
  // those: the Linkyo dock fades in at the bottom once the head has scrolled away, a card's fill
  // changes colour under the pointer).
  const moving = await page.evaluate(() =>
    document.getAnimations().flatMap((animation) => {
      const property = animation instanceof CSSTransition ? animation.transitionProperty : null;
      return property === "opacity" || property?.includes("color") ? [] : [property ?? (animation as CSSAnimation).animationName];
    }),
  );
  expect(moving).toEqual([]);
  const rail = await page.locator("#section-career .lb-step").first().evaluate((element) => getComputedStyle(element, "::before").transform);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(rail);
});

test("on ink the focus ring is white; Geist is the only face (no Inter file is loaded)", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fonts.push(request.url());
  });
  await open(page, application("de"));
  await page.locator("[data-hero-actions] a").first().focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const ring = await page.locator("[data-hero-actions] a").first().evaluate((element) => getComputedStyle(element).outlineColor);
  expect(ring).toBe("rgb(255, 255, 255)");
  expect(await page.locator("h1").evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(/^"?Geist|__Geist|geist/i);
  expect(fonts.filter((url) => /inter/i.test(url))).toEqual([]);
});
