import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * The portfolio editor (demo build): adding projects by typing, from a repository link, from any
 * other link and from pictures; the Clients entry; the focal point; topics as chips; pictures that
 * wait for a description; the address of an Arabic title; the Design screen's work layout; a card
 * opened in the preview; a quote's consent; axe on the sheet and each panel. Desktop and phone.
 */

const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;
type Messages = (typeof MESSAGES)[Locale];

const PICTURES = ["ex-pf-jorinde-01.jpg", "ex-pf-jorinde-02.jpg", "ex-pf-jorinde-03.jpg"].map((file) => path.join(import.meta.dirname, "../src/assets/examples", file));
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Sign up in a language and skip the welcome flow: an empty page in that language. */
async function signedIn(page: Page, locale: Locale) {
  const m = MESSAGES[locale];
  const name = `mila-${unique()}`;
  // Sheets and steps slide in; checks (axe's colours among them) look at the settled screen.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: m.app.welcome.skip }).click();
  await page.waitForURL(`**/${locale}/app`);
  // The page's blocks, where new ones show up as rows.
  await page.getByRole("link", { name: m.app.nav.page, exact: true }).locator("visible=true").first().click();
  await page.waitForURL(`**/${locale}/app/editor`);
  return { m, name };
}

async function openAdd(page: Page, m: Messages) {
  await page.getByRole("button", { name: m.app.nav.add, exact: true }).locator("visible=true").first().click();
  const sheet = page.getByRole("dialog", { name: m.app.add.title });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** The form of a new block in the Add sheet (its second step). */
const form = (page: Page, m: Messages, type: string) => page.getByRole("dialog", { name: fill(m.app.edit.addTitle, { type }) });

/** "Add to page": the footer button on wide screens, the navigation row's on phones. */
const confirm = (dialog: Locator, m: Messages) => dialog.getByRole("button", { name: m.app.edit.add, exact: true }).locator("visible=true").first();

/** Add → Project → title → one sentence → Add. */
async function addProject(page: Page, m: Messages, title: string, sentence: string) {
  const sheet = await openAdd(page, m);
  await sheet.locator('[data-type="project"]').click();
  const sheetForm = form(page, m, m.dashboard.types.project);
  await sheetForm.locator("[data-project-title]").fill(title);
  await sheetForm.getByLabel(m.app.portfolio.sentence).fill(sentence);
  return sheetForm;
}

const row = (page: Page, title: string) => page.locator("[data-row]").filter({ hasText: title });

/** Uploads a picture through a button that opens the file picker. */
async function upload(page: Page, button: Locator, files: string[]) {
  const chooser = page.waitForEvent("filechooser");
  await button.click();
  await (await chooser).setFiles(files);
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(AXE_TAGS).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** The page as it shows: beside the dashboard on wide screens, "View my page" on phones. */
async function shownPage(page: Page, m: Messages, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.locator("[data-preview-aside]");
  await page.getByRole("link", { name: m.app.viewPage }).click();
  await page.waitForURL("**/app/preview");
  return page.locator("body");
}

for (const locale of ["de", "en", "ar"] as const) {
  test(`${locale}: a project is added with two typed fields and two taps, and shows on the page`, async ({ page, isMobile }) => {
    const { m } = await signedIn(page, locale);
    const title = { de: "Hafenlicht", en: "Harbour Light", ar: "ضوء الميناء" }[locale];
    const sheetForm = await addProject(page, m, title, { de: "Der Hafen bei Nacht.", en: "The harbour at night.", ar: "الميناء في الليل." }[locale]);
    await confirm(sheetForm, m).click();
    await expect(sheetForm).toBeHidden();
    await expect(row(page, title)).toBeVisible();
    await expect(await shownPage(page, m, isMobile)).toContainText(title);
  });

  test(`${locale}: axe finds nothing on the Add sheet, the project sheet and each panel`, async ({ page }) => {
    const { m } = await signedIn(page, locale);
    const sheet = await openAdd(page, m);
    await axe(page);
    await sheet.locator('[data-type="project"]').click();
    const sheetForm = form(page, m, m.dashboard.types.project);
    await sheetForm.locator("[data-project-title]").fill("Tidewatch");
    await axe(page);
    for (const group of ["result", "story", "pictures", "forRole", "links", "address"] as const) {
      await sheetForm.locator(`[data-group="${group}"]`).click();
      await expect(sheetForm.locator("[data-panel] h3")).toHaveText(m.app.portfolio.groups[group]);
      await axe(page);
      await sheetForm.getByRole("button", { name: m.app.edit.back }).locator("visible=true").last().click();
      await expect(sheetForm.locator("[data-panel]")).toBeHidden();
    }
  });
}

test("en: a pasted repository link gives a savable project without a typed character", async ({ page }) => {
  const { m } = await signedIn(page, "en");
  await page.route("**/api/link-metadata?**", (route) =>
    route.fulfill({
      json: { title: "tidewatch", description: "Tide tables for small harbours, offline first.", stars: 412, language: "Swift", license: "MIT", kind: "repo", topics: ["ios", "tides"], homepage: "https://tidewatch.example.com", year: 2023 },
    }),
  );
  const sheet = await openAdd(page, m);
  await sheet.getByLabel(m.app.add.pasteLabel).fill("https://github.com/tobin/tidewatch");
  await sheet.getByRole("button", { name: m.app.add.asProject }).click();
  const sheetForm = form(page, m, m.dashboard.types.project);
  await expect(sheetForm.locator("[data-project-title]")).toHaveValue("tidewatch");
  await expect(sheetForm.getByLabel(m.app.portfolio.sentence)).toHaveValue("Tide tables for small harbours, offline first.");
  await confirm(sheetForm, m).click();
  await expect(sheetForm).toBeHidden();
  await expect(row(page, "tidewatch")).toBeVisible();
});

test("de: a link to a plain website is kept, the title takes the focus and one line says so", async ({ page }) => {
  const { m } = await signedIn(page, "de");
  const sheet = await openAdd(page, m);
  await sheet.getByLabel(m.app.add.pasteLabel).fill("https://studio-ronja.example.com/hafen");
  await sheet.getByRole("button", { name: m.app.add.asProject }).click();
  const sheetForm = form(page, m, m.dashboard.types.project);
  await expect(sheetForm.getByText(m.app.portfolio.linkKept)).toBeVisible();
  await expect(sheetForm.locator("[data-project-title]")).toBeFocused();
  await expect(sheetForm.locator('[data-group="links"]')).toContainText("studio-ronja.example.com");
  await sheetForm.locator("[data-project-title]").fill("Hafen bei Nacht");
  await sheetForm.getByLabel(m.app.portfolio.sentence).fill("Eine Serie über den Hafen.");
  await confirm(sheetForm, m).click();
  await expect(row(page, "Hafen bei Nacht")).toBeVisible();
});

test("de: the Clients entry adds a list of names under the clients title", async ({ page }) => {
  const { m } = await signedIn(page, "de");
  const sheet = await openAdd(page, m);
  const entry = sheet.locator('[data-preset="clients"]');
  await expect(entry).toContainText(m.app.add.presets.clients);
  await entry.click();
  const sheetForm = form(page, m, m.dashboard.types.brands);
  await expect(sheetForm.getByLabel(m.app.fields.titleOptional)).toHaveValue(m.app.portfolio.titles.clients.default);
  await sheetForm.getByLabel(m.app.fields.name, { exact: true }).fill("Bäckerei Sonnenschein");
  await confirm(sheetForm, m).click();
  await expect(sheetForm).toBeHidden();
  await expect(row(page, m.app.portfolio.titles.clients.default)).toContainText("Bäckerei Sonnenschein");
});

for (const locale of ["ar", "en"] as const) {
  test(`${locale}: the focal point is set with the two sliders alone and by one tap; the previews and the marker follow`, async ({ page }) => {
    const { m } = await signedIn(page, locale);
    const sheetForm = await addProject(page, m, "Tidewatch", "Tide tables.");
    await upload(page, sheetForm.getByRole("button", { name: fill(m.app.form.uploadNamed, { label: m.app.fields.cover }) }), [PICTURES[0] ?? ""]);
    await sheetForm.getByRole("button", { name: m.app.portfolio.focus.open }).click();
    const picture = sheetForm.locator("[data-focal-picture]");
    const marker = sheetForm.locator("[data-focal-marker]");
    const previews = sheetForm.locator("[data-focal-preview] img");
    await expect(previews).toHaveCount(3);
    await picture.evaluate((element) => element.scrollIntoView({ block: "center" }));

    // Sliders alone.
    const x = sheetForm.getByLabel(m.app.portfolio.focus.x);
    await x.fill("80");
    await sheetForm.getByLabel(m.app.portfolio.focus.y).fill("20");
    for (const preview of await previews.all()) await expect(preview).toHaveCSS("object-position", "80% 20%");
    // The picture and the left-to-right slider never mirror: in Arabic too, 80 is on the right.
    await expect(x).toHaveAttribute("dir", "ltr");
    const box = await picture.boundingBox();
    const dot = await marker.boundingBox();
    if (!box || !dot) throw new Error("no picture");
    expect(dot.x + dot.width / 2 - box.x).toBeCloseTo(box.width * 0.8, -1);
    expect(dot.y + dot.height / 2 - box.y).toBeCloseTo(box.height * 0.2, -1);

    // One tap.
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.75);
    await expect(x).toHaveValue("25");
    await expect(sheetForm.getByLabel(m.app.portfolio.focus.y)).toHaveValue("75");
    for (const preview of await previews.all()) await expect(preview).toHaveCSS("object-position", "25% 75%");
    const moved = await marker.boundingBox();
    expect((moved?.x ?? 0) + (moved?.width ?? 0) / 2 - box.x).toBeCloseTo(box.width * 0.25, -1);
  });
}

test("ar: topics become chips with the Arabic comma, the Add button and by leaving the field", async ({ page }) => {
  const { m } = await signedIn(page, "ar");
  const sheetForm = await addProject(page, m, "مسار", "تطبيق توصيل.");
  await sheetForm.locator('[data-group="forRole"]').click();
  const field = sheetForm.getByRole("textbox", { name: m.app.portfolio.topics });
  await field.pressSequentially("تصوير،");
  await field.fill("ليلي");
  await sheetForm.getByRole("button", { name: m.app.portfolio.addChip, exact: true }).click();
  await field.fill("ميناء");
  await field.blur();
  const chips = sheetForm.getByRole("list", { name: m.app.portfolio.topics }).getByRole("listitem");
  await expect(chips).toHaveText(["تصوير", "ليلي", "ميناء"]);
  await expect(field).toHaveValue("");
});

test("en: a picture without a description leaves the project visible; Describe all brings it onto the page", async ({ page, isMobile }) => {
  const { m } = await signedIn(page, "en");
  const sheetForm = await addProject(page, m, "Harbour Light", "The harbour at night.");
  await upload(page, sheetForm.getByRole("button", { name: fill(m.app.form.uploadNamed, { label: m.app.fields.cover }) }), [PICTURES[0] ?? ""]);
  await sheetForm.getByLabel(m.app.portfolio.alt).fill("A crane in the fog");
  await sheetForm.locator('[data-group="pictures"]').click();
  await upload(page, sheetForm.getByRole("button", { name: m.app.portfolio.addPictures }), [PICTURES[1] ?? "", PICTURES[2] ?? ""]);
  await expect(sheetForm.locator("[data-alt-missing]")).toHaveText("2 pictures are not shown yet: they have no description.");
  await confirm(sheetForm, m).click();
  await expect(sheetForm).toBeHidden();
  // Still on the page, and visible.
  await expect(row(page, "Harbour Light")).toBeVisible();
  await expect(row(page, "Harbour Light").getByRole("switch")).toBeChecked();
  // The waiting pictures are not on the page: the project has nothing more to show than its card.
  const shown = isMobile ? null : page.locator("[data-preview-aside]");
  if (shown) await expect(shown.locator('button[aria-label="Harbour Light"]')).toHaveCount(0);

  await row(page, "Harbour Light").locator("[data-row-edit]").click();
  const edit = page.getByRole("dialog", { name: fill(m.app.edit.editTitle, { type: m.dashboard.types.project }) });
  await edit.locator('[data-group="pictures"]').click();
  await edit.getByRole("button", { name: m.app.portfolio.describeAll }).click();
  for (const words of ["Boats at the pier", "The lighthouse at dawn"]) {
    await edit.getByLabel(m.app.portfolio.alt).fill(words);
    await edit.getByRole("button", { name: m.app.portfolio.focus.done }).click();
  }
  await expect(edit.locator("[data-alt-missing]")).toBeHidden();
  await edit.getByRole("button", { name: m.app.edit.save, exact: true }).locator("visible=true").first().click();
  await expect(edit).toBeHidden();
  // Described, the pictures make a page of the project: its card now opens it.
  const after = await shownPage(page, m, isMobile);
  await expect(after.locator('button[aria-label="Harbour Light"]')).toHaveCount(1);
});

test("ar: a title without Latin letters opens the address with its hint", async ({ page }) => {
  const { m } = await signedIn(page, "ar");
  const sheetForm = await addProject(page, m, "مسار الضوء", "سلسلة عن الميناء.");
  await expect(sheetForm.getByLabel(m.app.portfolio.address)).toBeVisible();
  await expect(sheetForm.getByText(m.app.portfolio.slugLatinHint)).toBeVisible();
  await sheetForm.getByLabel(m.app.portfolio.address).fill("masar");
  await sheetForm.getByLabel(m.app.portfolio.address).blur();
  await confirm(sheetForm, m).click();
  await expect(sheetForm).toBeHidden();
  await expect(row(page, "مسار الضوء")).toBeVisible();
});

test("de: the Design row Work layout changes the page and says when the content cannot fill it", async ({ page, isMobile }) => {
  const { m } = await signedIn(page, "de");
  for (const title of ["Hafenlicht", "Kranlinien"]) {
    const sheetForm = await addProject(page, m, title, "Eine Serie.");
    await confirm(sheetForm, m).click();
    await expect(sheetForm).toBeHidden();
  }
  await page.getByRole("link", { name: m.app.nav.design, exact: true }).locator("visible=true").first().click();
  await page.waitForURL("**/app/design**");
  const frame = page.locator(isMobile ? "[data-sticky-preview]" : "[data-preview-aside]");
  const choices = page.locator("fieldset").filter({ hasText: m.app.design.projects.autoHint });
  await choices.getByText(m.app.design.projects.rail, { exact: true }).click();
  // A row to swipe (no numbering start), then the numbered list.
  await expect(frame.locator("ol:not([start]) > li")).toHaveCount(2);
  await expect(page.getByText(m.app.design.projects.forced)).toBeHidden();
  // A grid needs three projects with pictures: the list is shown, and one line says why.
  await choices.getByText(m.app.design.projects.bento, { exact: true }).click();
  await expect(page.getByText(m.app.design.projects.forced)).toBeVisible();
  await expect(frame.locator("ol:not([start]) > li")).toHaveCount(0);
  await expect(frame.locator("ol[start] > li")).toHaveCount(2);
});

test("en: a tap on a card in the preview opens the project in place and Back returns", async ({ page, isMobile }) => {
  const { m } = await signedIn(page, "en");
  const sheetForm = await addProject(page, m, "Harbour Light", "The harbour at night.");
  await sheetForm.locator('[data-group="story"]').click();
  await sheetForm.getByLabel(m.app.portfolio.storyAbout).fill("Six nights on the pier with a borrowed camera.");
  await confirm(sheetForm, m).click();
  await expect(sheetForm).toBeHidden();
  // "Back to <name>": the name is the page's display name.
  const back = new RegExp(`^${escape(m.creator.portfolio.backTo.split("{name}")[0] ?? "")}`);
  if (isMobile) {
    await shownPage(page, m, true);
    await page.getByRole("button", { name: "Harbour Light" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Harbour Light" })).toBeVisible();
    await page.getByRole("button", { name: back }).click();
    await expect(page.getByRole("button", { name: "Harbour Light" })).toBeVisible();
    return;
  }
  // The preview beside the dashboard is a picture of the page: the tap goes through to the card.
  const preview = page.locator("[data-preview-aside]");
  await preview.locator('button[aria-label="Harbour Light"]').evaluate((element) => element.scrollIntoView({ block: "center" }));
  const card = await preview.locator('button[aria-label="Harbour Light"]').boundingBox();
  if (!card) throw new Error("no card");
  await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
  await expect(preview.locator("h1")).toHaveText("Harbour Light");
  const backButton = await preview.locator("button", { hasText: back }).boundingBox();
  if (!backButton) throw new Error("no way back");
  await page.mouse.click(backButton.x + backButton.width / 2, backButton.y + backButton.height / 2);
  await expect(preview.locator('button[aria-label="Harbour Light"]')).toHaveCount(1);
});

test("de: a quote cannot be finished without the consent switch", async ({ page }) => {
  const { m } = await signedIn(page, "de");
  const sheet = await openAdd(page, m);
  await sheet.locator('[data-type="quotes"]').click();
  const sheetForm = form(page, m, m.dashboard.types.quotes);
  await sheetForm.getByRole("textbox", { name: m.app.portfolio.quotes.text, exact: true }).fill("Klar, pünktlich und ohne Umwege.");
  await sheetForm.getByRole("textbox", { name: m.app.portfolio.quotes.name, exact: true }).fill("M. K.");
  await sheetForm.getByRole("textbox", { name: m.app.portfolio.quotes.role }).fill("Geschäftsführerin, Bäckerei");
  await confirm(sheetForm, m).click();
  await expect(sheetForm).toBeVisible();
  await expect(sheetForm.getByRole("alert").filter({ hasText: m.app.portfolio.quotes.consentMissing })).toBeVisible();
  await sheetForm.getByRole("switch", { name: m.app.portfolio.quotes.consent }).click();
  await confirm(sheetForm, m).click();
  await expect(sheetForm).toBeHidden();
  await expect(row(page, m.app.portfolio.titles.quotes.default)).toBeVisible();
});
