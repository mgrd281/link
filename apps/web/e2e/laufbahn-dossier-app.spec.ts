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
/** The same applicant with a 40-character e-mail address (no hyphen, example.com) and a languages fact that fills a line. */
const longValues = (locale: string) => `/${locale}/directions/poster?chrome=0&template=laufbahn&page=application-long`;
/** The same applicant with a drawn still beside About's facts (the layout a page with an About picture has). */
const withPortrait = (locale: string) => `/${locale}/directions/poster?chrome=0&template=laufbahn&page=application-portrait`;
const LONG_EMAIL: Record<string, string> = {
  de: "jonas.brandt.lagerlogistik42@example.com",
  en: "jonas.brandt.lagerlogistik42@example.com",
  ar: "karim.nasser.lagerlogistik42@example.com",
};
/** The page every document of the example lives under (the sample route offers the example page's own). */
const BASES: Record<string, string> = { de: "/de/p/jonas-brandt", en: "/en/p/jonas-brandt" };
const FILES: Record<string, Record<string, string>> = {
  de: { cv: "Lebenslauf_Jonas_Brandt.pdf", letter: "Anschreiben_Jonas_Brandt.pdf", application: "Bewerbung_Jonas_Brandt.pdf" },
  en: { cv: "CV_Jonas_Brandt.pdf", letter: "Cover_letter_Jonas_Brandt.pdf", application: "Application_Jonas_Brandt.pdf" },
};
const ROUTES = [application("de"), application("en"), application("ar"), portfolio("de"), "/de/p/jonas-brandt", "/en/p/jonas-brandt", "/ar/p/karim-nasser", withPortrait("de"), withPortrait("ar")];

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

/** The contents opener's name in the bar, per language. */
const OPEN_CONTENTS = { de: /Inhalt öffnen/, en: /Open contents/, ar: /فتح المحتويات/ } as const;

/**
 * Every element inside each box a selector names that leaves that box by more than half a pixel on any
 * side, and every line of text that leaves it at either side, as "label: <tag> "words" left–right
 * outside left–right". (A line's glyph box may stand a pixel above or below its line: a face's ascent,
 * IBM Plex Sans Arabic's taller than its line height, is no overflow; reflow is about the sides.)
 */
async function escapes(page: Page, boxes: Record<string, string>): Promise<{ counts: Record<string, number>; out: string[] }> {
  return page.evaluate((selectors) => {
    const out: string[] = [];
    const counts: Record<string, number> = {};
    const leaves = (inner: DOMRect, outer: DOMRect, sides: boolean) =>
      inner.width + inner.height > 0 &&
      (inner.left < outer.left - 0.5 || inner.right > outer.right + 0.5 || (!sides && (inner.top < outer.top - 0.5 || inner.bottom > outer.bottom + 0.5)));
    for (const [label, selector] of Object.entries(selectors)) {
      const found = [...document.querySelectorAll(selector)];
      counts[label] = found.length;
      found.forEach((box, index) => {
        const outer = box.getBoundingClientRect();
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          let rects: DOMRect[];
          if (node.nodeType === Node.TEXT_NODE) {
            const range = document.createRange();
            range.selectNodeContents(node);
            rects = [...range.getClientRects()];
          } else rects = [(node as Element).getBoundingClientRect()];
          for (const rect of rects) {
            if (!leaves(rect, outer, node.nodeType === Node.TEXT_NODE)) continue;
            const words = (node.textContent ?? "").trim().slice(0, 30);
            out.push(`${label} ${String(index + 1)}: <${node.nodeName.toLowerCase()}> "${words}" ${rect.left.toFixed(1)}–${rect.right.toFixed(1)} × ${rect.top.toFixed(1)}–${rect.bottom.toFixed(1)} outside ${outer.left.toFixed(1)}–${outer.right.toFixed(1)} × ${outer.top.toFixed(1)}–${outer.bottom.toFixed(1)}`);
          }
        }
      });
    }
    return { counts, out };
  }, boxes);
}

test.describe("on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone sizes on the mobile project");

  for (const locale of ["de", "en", "ar"] as const) {
    test(`${locale}: at 320 × 700 (the reflow width of WCAG 1.4.10) every part of each Unterlagen card, each figure, each Kontakt row and the facts stays inside its own box, and nothing scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await open(page, application(locale));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const { counts, out } = await escapes(page, {
        // Each card (the whole card is one link), "both in one file" and the date inside the section's content.
        card: "#unterlagen [data-lb-documents] li > a",
        documents: "#unterlagen [data-lb-documents]",
        // Each figure of the head: its qualifier, number and label inside its own column.
        figure: "[data-lb-head] dl > div",
        // Each row of the Kontakt band: the e-mail address ("jonas.brandt@" / "example.com" at 320) and
        // the number inside their column, never under the arrow.
        contact: "[data-lb-contact] ul a",
        // About's facts sheet: no row wider than the sheet (its gaps fit 320 px).
        facts: "main dl.rounded-creator-card",
      });
      expect(counts, JSON.stringify(counts)).toEqual({ card: locale === "ar" ? 0 : 2, documents: locale === "ar" ? 0 : 1, figure: 3, contact: locale === "ar" ? 1 : 4, facts: 1 });
      expect(out).toEqual([]);
      if (locale !== "ar") {
        // "Beides in einer Datei · 2 Seiten": the count stays with its word, and the dot ends a line.
        const both = (await page.locator('#unterlagen a[href$="/application"]').textContent()) ?? "";
        expect(both).toMatch(/\p{Nd}\u00a0\p{L}/u);
        expect(both).toMatch(/\u00a0· /u);
        await page.locator("#unterlagen").evaluate((section) => section.scrollIntoView({ block: "start", behavior: "instant" }));
        await shot(page, `${locale}-320-unterlagen`);
      }
      await shot(page, `${locale}-320-fold`);
    });
  }

  for (const locale of ["de", "en", "ar"] as const) {
    test(`${locale}: a 40-character e-mail address and a long fact stay inside their boxes at 320 and 390 px, the address broken after "@"`, async ({ page }) => {
      for (const [width, height] of [
        [320, 700],
        [390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await open(page, longValues(locale));
        const where = `${String(width)} px`;
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), where).toBeLessThanOrEqual(0);
        const { counts, out } = await escapes(page, { contact: "[data-lb-contact] ul a", value: "[data-lb-contact] a[href^='mailto:'] bdi", facts: "main dl.rounded-creator-card" });
        expect(counts.value, where).toBe(1);
        expect(out, where).toEqual([]);
        const address = page.locator("[data-lb-contact] a[href^='mailto:'] bdi");
        // The break chances are no characters: the address reads and copies as written.
        await expect(address).toHaveText(LONG_EMAIL[locale] ?? "");
        // The domain keeps together on a line of its own: the address breaks after "@" (and, at 320,
        // before a "." of the name), never inside "example.com".
        const lines = await address.evaluate((bdi) => {
          const nodes = [...bdi.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
          const measure = (node: Node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return [...range.getClientRects()].map((rect) => ({ top: rect.top, left: rect.left, right: rect.right }));
          };
          const rects = (text: string) => {
            const node = nodes.find((candidate) => candidate.textContent === text);
            return node ? measure(node) : [];
          };
          // Every other piece's line tops (the name's parts, its dots, the "@").
          const others = nodes.filter((node) => node.textContent !== "example.com").flatMap((node) => measure(node).map((rect) => rect.top));
          return { at: rects("@"), domain: rects("example.com"), others };
        });
        const detail = `${where}: ${JSON.stringify(lines)}`;
        expect(lines.domain.length, detail).toBe(1);
        expect(lines.at.length, detail).toBe(1);
        const [at, domain] = [lines.at[0], lines.domain[0]];
        if (!at || !domain) throw new Error(detail);
        expect(domain.top, detail).toBeGreaterThan(at.top + 1);
        // Nothing else on the domain's line: it stands alone, whichever side the page aligns it to.
        expect(lines.others.every((top) => top < domain.top - 1), detail).toBe(true);
        await page.locator("[data-lb-contact] ul").evaluate((list) => list.scrollIntoView({ block: "center", behavior: "instant" }));
        await shot(page, `${locale}-${String(width)}-long-email`);
        await page.locator("main dl.rounded-creator-card").evaluate((sheet) => sheet.scrollIntoView({ block: "center", behavior: "instant" }));
        await shot(page, `${locale}-${String(width)}-long-facts`);
      }
    });
  }

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: About with a picture on phones: the facts beside it, the text under both, nothing outside its box (320, 390)`, async ({ page }) => {
      for (const [width, height] of [
        [320, 700],
        [390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await open(page, withPortrait(locale));
        const where = `${String(width)} px`;
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), where).toBeLessThanOrEqual(0);
        const { out } = await escapes(page, { about: "[data-about-portrait]" });
        expect(out, where).toEqual([]);
        const [frame, text] = [await page.locator("[data-about-portrait] > div").first().boundingBox(), await page.locator("[data-about-portrait] > div:has(> p)").boundingBox()];
        expect(frame && text && text.y >= frame.y + frame.height, `${where}: ${JSON.stringify([frame, text])}`).toBe(true);
        await page.locator("[data-about-portrait]").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
        await shot(page, `${locale}-${String(width)}-about-portrait`);
      }
    });
  }

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: on phones the career's years stand above the role beside the rail, the words in the column's full width (320, 390)`, async ({ page }) => {
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await open(page, application(locale));
        const steps = await page.locator("#section-career li").evaluateAll((items) =>
          items.map((item) => {
            const [years, rail, entry] = [...item.children].map((child) => child.getBoundingClientRect());
            const role = item.querySelector("[data-lb-entry] > p")?.getBoundingClientRect();
            return { years, rail, entry, role, rtl: getComputedStyle(item).direction === "rtl" };
          }),
        );
        expect(steps.length).toBe(4);
        for (const { years, rail, entry, role, rtl } of steps) {
          const where = `${String(width)} px: ${JSON.stringify({ years, rail, entry, role })}`;
          if (!years || !rail || !entry || !role) throw new Error(where);
          // The years above the role, both on the same side of the rail, starting where the role starts.
          expect(years.bottom <= role.top + 0.5, where).toBe(true);
          expect(Math.abs((rtl ? years.right : years.left) - (rtl ? entry.right : entry.left)) <= 0.5, where).toBe(true);
          expect(rtl ? years.right <= rail.left + 0.5 : years.left >= rail.right - 0.5, where).toBe(true);
          // The rail runs beside the years and the words.
          expect(rail.top <= years.top + 0.5 && rail.bottom >= entry.bottom - 0.5, where).toBe(true);
          // The words take the column: the page's width less the gutters, the rail and its 20 px.
          expect(entry.width, where).toBeGreaterThanOrEqual(width - 2 * 20 - 2 - 1);
        }
      }
      await page.locator("#section-career").evaluate((section) => section.scrollIntoView({ block: "start", behavior: "instant" }));
      await shot(page, `${locale}-390-career`);
      await page.setViewportSize({ width: 320, height: 700 });
      await page.locator("#section-career").evaluate((section) => section.scrollIntoView({ block: "start", behavior: "instant" }));
      await shot(page, `${locale}-320-career`);
    });
  }

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

  for (const locale of ["de", "en", "ar"] as const) {
    test(`${locale}: every jump from the contents lands its section with the hanging title level with the content (1440 × 900)`, async ({ page }) => {
      await open(page, application(locale));
      await pastName(page);
      const bar = page.locator(".poster-bar");
      const opener = bar.getByRole("button", { name: OPEN_CONTENTS[locale] });
      await opener.click();
      const sheet = page.getByRole("dialog");
      const anchors = await sheet.locator('a[href^="#"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
      await page.keyboard.press("Escape");
      expect(anchors.length).toBeGreaterThanOrEqual(5);
      for (const anchor of anchors) {
        await opener.click();
        await expect(sheet).toBeVisible();
        await sheet.locator(`a[href="${anchor}"]`).click();
        await expect(sheet).toBeHidden();
        await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(anchor);
        const [title, content, scrolled] = await page.evaluate((id) => {
          const section = document.getElementById(id.slice(1));
          const h2 = section?.querySelector(":scope > h2");
          return [h2?.getBoundingClientRect().top ?? -1, h2?.nextElementSibling?.getBoundingClientRect().top ?? -1, window.scrollY];
        }, anchor);
        const where = `${anchor}: title ${String(title)}, content ${String(content)}, scrollY ${String(scrolled)}`;
        expect(title, where).toBeGreaterThan(0);
        expect(Math.abs(title - content), where).toBeLessThanOrEqual(1);
        if (anchor === anchors[0] || anchor === "#unterlagen") await shot(page, `${locale}-1440-jump-${anchor.slice(1)}`);
      }
    });
  }

  for (const locale of ["de", "en", "ar"] as const) {
    test(`${locale}: after every jump from the contents, the bar and the sheet name the section jumped to, a short one too (768 × 1024, 1440 × 900)`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const [width, height] of [
        [768, 1024],
        [1440, 900],
      ] as const) {
        await page.setViewportSize({ width, height });
        await open(page, application(locale));
        await pastName(page);
        const opener = page.locator(".poster-bar").getByRole("button", { name: OPEN_CONTENTS[locale] });
        const sheet = page.getByRole("dialog");
        await opener.click();
        const entries = await sheet.locator('ol a[href^="#"]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href") ?? "", title: link.textContent.trim() })));
        await page.keyboard.press("Escape");
        expect(entries.length).toBeGreaterThanOrEqual(5);
        for (const { href, title } of entries) {
          const where = `${String(width)} px, ${href}`;
          await opener.click();
          await sheet.locator(`a[href="${href}"]`).click();
          await expect(sheet).toBeHidden();
          await expect.poll(() => page.evaluate(() => window.location.hash), where).toBe(href);
          // The observers have reported the landing (two frames later): the bar names the chosen section.
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await expect(opener.locator("span.text-caption"), where).toHaveText(title);
          await opener.click();
          await expect(sheet.locator('a[aria-current="true"]'), where).toHaveText(title);
          await page.keyboard.press("Escape");
          await expect(sheet).toBeHidden();
        }
      }
    });
  }

  for (const path of [application("de"), application("en"), application("ar"), portfolio("de")]) {
    test(`${path}: the plate stands from the top of the words to their last row (1440 × 900)`, async ({ page }) => {
      await open(page, path);
      const lines = await page.evaluate(() => {
        const plate = document.querySelector("[data-hero-plate]")?.getBoundingClientRect();
        const words = document.querySelector("[data-lb-words]");
        const last = words?.lastElementChild?.getBoundingClientRect();
        return { plate, words: words?.getBoundingClientRect(), last, actions: document.querySelector("[data-hero-actions]")?.getBoundingClientRect() };
      });
      const where = JSON.stringify(lines);
      const { plate, words, last, actions } = lines;
      if (!plate || !words || !last || !actions) throw new Error(where);
      expect(Math.abs(plate.top - words.top), where).toBeLessThanOrEqual(1);
      // Its bottom is the words' last row: the actions, or the social links under them.
      expect(Math.abs(plate.bottom - last.bottom), where).toBeLessThanOrEqual(1);
      expect(last.bottom >= actions.bottom - 0.5, where).toBe(true);
      expect(plate.height, where).toBeGreaterThan(300);
      await shot(page, `${path.split("/")[1] ?? ""}-${path.includes("portfolio") ? "portfolio" : "application"}-1440-plate`);
    });
  }

  for (const [locale, mode] of [
    ["de", "light"],
    ["ar", "light"],
    ["de", "dark"],
  ] as const) {
    test(`${locale} (${mode}): About with a picture: on the wide canvas the text follows the facts beside the framed picture (1440 × 900)`, async ({ page }) => {
      await open(page, `${withPortrait(locale)}${mode === "dark" ? "&mode=dark" : ""}`);
      const about = page.locator("[data-about-portrait]");
      await about.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      const parts = await about.evaluate((grid) => {
        const box = (element: Element | null | undefined) => {
          const rect = element?.getBoundingClientRect();
          return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null;
        };
        const frame = grid.querySelector(":scope > div");
        return {
          frame: box(frame),
          border: frame ? getComputedStyle(frame).borderTopWidth : "",
          facts: box(grid.querySelector(":scope > dl")),
          text: box(grid.querySelector(":scope > div:has(> p)")),
          rtl: getComputedStyle(grid).direction === "rtl",
        };
      });
      const where = JSON.stringify(parts);
      const { frame, facts, text, rtl } = parts;
      if (!frame || !facts || !text) throw new Error(where);
      // The picture at the start, the facts beside it, the text under the facts in their columns.
      expect(rtl ? frame.left >= facts.right : frame.right <= facts.left, where).toBe(true);
      expect(text.top, where).toBeGreaterThanOrEqual(facts.bottom);
      expect(Math.abs(rtl ? text.right - facts.right : text.left - facts.left), where).toBeLessThanOrEqual(1);
      // The column beside the picture is filled: under a third of the picture's height stays empty
      // (the review measured 189 px of 399, 47 %, with the text under both; how much is left now
      // depends on the length of the text).
      expect(frame.bottom - text.bottom, where).toBeLessThan((frame.bottom - frame.top) / 3);
      // A hairline frames the picture, so a dark drawing keeps its edge on a dark page.
      expect(parts.border, where).toBe("1px");
      await shot(page, `${locale}-1440-about-portrait-${mode}`);
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
      // The rail is its own item (its width is the line); the dot is its child, centred on it.
      const offsets = await page.locator("#section-career .lb-step").evaluateAll((steps) =>
        steps.map((step) => {
          const box = step.getBoundingClientRect();
          const railCentre = box.left + box.width / 2;
          const dot = step.querySelector(":scope > span[aria-hidden]")?.getBoundingClientRect();
          return box.width > 0 && dot ? Math.abs(dot.left + dot.width / 2 - railCentre) : Number.POSITIVE_INFINITY;
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

test("on ink the focus ring is white, the clip's play button too; Geist is the only face (no Inter file is loaded)", async ({ page }) => {
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
  // The clip's play button on the plate is in the ink head too: the white ring, and the hero's 48 px target.
  const play = page.locator("[data-hero-plate] button");
  await play.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(play).toBeFocused();
  expect(await play.evaluate((element) => [getComputedStyle(element).outlineStyle, getComputedStyle(element).outlineColor])).toEqual(["solid", "rgb(255, 255, 255)"]);
  const target = await play.boundingBox();
  expect(target && target.width >= 48 && target.height >= 48, JSON.stringify(target)).toBe(true);
  expect(await page.locator("h1").evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(/^"?Geist|__Geist|geist/i);
  expect(fonts.filter((url) => /inter/i.test(url))).toEqual([]);
});
