import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The three Stage 3 example people (WP3.3), one per new portfolio template: Merle Kastorf (Leuchttisch, de),
 * Rana Al-Khatib (Grundriss, ar) and Ines Vasconcelos (Logbuch, en). Every page and every project page
 * answers 200 in its own language and direction, is axe-clean (WCAG 2.2 AA), fits the screen, loads nothing
 * from another origin, sets no cookie and has its own link preview. The gallery's Portfolio filter and the
 * /portfolio page list all three. Runs on the laptop and the phone project.
 *
 * Checked with reduced motion, as e2e/portfolio-a11y.spec.ts does: scroll-driven reveals leave rows below
 * the fold part-way faded until they are scrolled to, and axe would measure that contrast.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const PEOPLE = [
  { slug: "merle-kastorf", locale: "de", name: "Merle Kastorf", template: "Leuchttisch", kind: "photographer", projects: ["nachbild", "gegenlicht", "nathan-portraets", "spielzeitkampagne"] },
  { slug: "rana-al-khatib", locale: "ar", name: "رنا الخطيب", template: "Grundriss", kind: "designer", projects: ["school-extension", "stairwell-retrofit", "housing-study", "library-competition"] },
  { slug: "ines-vasconcelos", locale: "en", name: "Ines Vasconcelos", template: "Logbuch", kind: "engineer", projects: ["nevoa", "remendo-log", "sardinha-split", "bike-light-mount"] },
] as const;

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

/** Opens a page and records every request that leaves our own origin. */
async function open(page: Page, path: string): Promise<{ status: number | undefined; external: string[] }> {
  const external: string[] = [];
  page.on("request", (sent) => {
    const host = new URL(sent.url()).hostname;
    if (!["localhost", "127.0.0.1"].includes(host)) external.push(sent.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  return { status: response?.status(), external };
}

async function previewCard(page: Page, route: string): Promise<void> {
  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(og, route).toContain(`${route}/opengraph-image`);
  const image = await page.request.get(new URL(og ?? "", page.url()).pathname);
  expect(image.status(), route).toBe(200);
  expect(image.headers()["content-type"], route).toBe("image/png");
  // A real card, not an error picture: PNG signature and the Open Graph size (1200 × 630).
  const body = await image.body();
  expect(body.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([1200, 630]);
}

for (const person of PEOPLE) {
  const base = `/${person.locale}/p/${person.slug}`;

  test(`${person.slug}: 200, ${person.locale} and its direction, accessible, nothing wider than the screen, nothing from elsewhere, its own preview`, async ({ page, context }) => {
    const { status, external } = await open(page, base);
    expect(status).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", person.locale);
    await expect(page.locator("html")).toHaveAttribute("dir", person.locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(person.name);
    // Labelled as an example, with its category.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Every project is on the page and leads to its own page.
    for (const project of person.projects) await expect(page.locator(`a[href="${base}/${project}"]`).first()).toBeAttached();
    expect(await axe(page)).toEqual([]);
    expect(external).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    await previewCard(page, base);
  });

  test(`${person.slug}: every project page answers, accessible and on our own origin, with its own preview`, async ({ page, context }) => {
    test.setTimeout(120_000);
    for (const project of person.projects) {
      const route = `${base}/${project}`;
      const { status, external } = await open(page, route);
      expect(status, route).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("dir", person.locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, route).toBeLessThanOrEqual(0);
      // Pictures open in the viewer: numbered links to our own files.
      const pictures = page.locator("a[data-viewer]");
      const total = await pictures.count();
      if (total > 0) await expect(pictures.first()).toHaveAttribute("data-total", String(total));
      expect(await axe(page), route).toEqual([]);
      expect(external, route).toEqual([]);
      await previewCard(page, route);
      page.removeAllListeners("request");
    }
    expect(await context.cookies()).toEqual([]);
  });
}

test("on a phone the example label never covers the name: it stands above the strip, the title block and the README", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const person of PEOPLE) {
    await open(page, `/${person.locale}/p/${person.slug}`);
    const [label, name] = await Promise.all([page.locator("[data-preview-badge]").first().boundingBox(), page.getByRole("heading", { level: 1 }).boundingBox()]);
    expect(label, person.slug).not.toBeNull();
    expect(name, person.slug).not.toBeNull();
    if (!label || !name) continue;
    const overlaps = label.x < name.x + name.width && name.x < label.x + label.width && label.y < name.y + name.height && name.y < label.y + label.height;
    expect(overlaps, `${person.slug}: label ${JSON.stringify(label)}, name ${JSON.stringify(name)}`).toBe(false);
  }
});

test("Merle's lead series: after its cover, thirteen pictures, each a numbered link on our own origin for the viewer", async ({ page }) => {
  await open(page, "/de/p/merle-kastorf/nachbild");
  const pictures = page.locator("a[data-viewer]");
  await expect(pictures).toHaveCount(13);
  await expect(pictures.first()).toHaveAttribute("data-total", "13");
  for (const href of await pictures.evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))) {
    expect(new URL(href).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
  }
});

test("Rana's page keeps Latin figures in Arabic text and never uses Arabic-Indic digits", async ({ page }) => {
  await open(page, "/ar/p/rana-al-khatib/school-extension");
  const text = await page.locator("main").innerText();
  expect(text).toContain("1,240");
  expect(text).not.toMatch(/[٠-٩۰-۹]/);
});

test("the gallery's Portfolio filter lists all three", async ({ page }) => {
  await page.goto("/de/templates?category=portfolio#gallery");
  await expect(page.getByRole("button", { name: /^Portfolio/ })).toHaveAttribute("aria-pressed", "true");
  for (const person of PEOPLE) {
    await expect(page.getByRole("button", { name: new RegExp(`^${person.name} ansehen – Portfolio`) }).first()).toBeVisible();
  }
});

test("/portfolio lists all three in their field, with their template and a start that keeps the look", async ({ page }) => {
  await page.goto("/de/portfolio");
  const row = page.getByRole("region", { name: "Vorlagen für Portfolios" });
  for (const person of PEOPLE) {
    await expect(row.getByRole("heading", { level: 3, name: person.template })).toBeVisible();
    await expect(row.getByRole("link", { name: `Mit ${person.template} starten` })).toHaveAttribute("href", `/de/signup?kind=${person.kind}&look=${person.slug}`);
  }
  const tabs = page.getByRole("tablist", { name: "Fach wählen" }).getByRole("tab");
  const fields = [
    { tab: 0, person: PEOPLE[0] },
    { tab: 1, person: PEOPLE[1] },
    { tab: 2, person: PEOPLE[2] },
  ];
  for (const { tab, person } of fields) {
    await tabs.nth(tab).click();
    await expect(page.getByRole("tabpanel").getByRole("link", { name: `Seite von ${person.name} ansehen` })).toHaveAttribute("href", `/${person.locale}/p/${person.slug}`);
  }
});
