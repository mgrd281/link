import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createTranslator } from "next-intl";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * The portfolio-aware welcome flow (plan §1.7, WP7; audit P-03, P-04, D-07, D-14, D-18, S-02, E-08).
 * A designer, photographer, developer, engineer or freelancer is asked for three pieces of work and
 * one way to be reached, and ends on a portfolio: the kind's work title over three projects, the
 * contact block last, on Werkbogen or Tiefdruck. Other kinds keep the five steps with links.
 * Demo build, desktop and phone, de (every kind), en and ar (one kind each), with and without pictures,
 * axe on every step.
 *
 * Two parts need more than the demo build:
 * - `WELCOME_SHOTS=<dir>` also saves the photographer's work, contact and done steps on a phone
 *   (390 × 844) and a laptop (1440 × 900), in de and ar (desktop project only).
 * - Real accounts (the Supabase stand-in, as in stub-app.spec.ts): its own build and `E2E_STUB=1`.
 *   The flow works against the hosted database as it is (it only writes the page, as before), and a
 *   real account is not offered a newsletter.
 */

const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;
type Messages = (typeof MESSAGES)[Locale];
type Kind = keyof typeof de.app.welcome.kinds;

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PICTURES = ["ex-pf-jorinde-01.jpg", "ex-pf-jorinde-02.jpg", "ex-pf-jorinde-03.jpg"].map((file) => path.join(import.meta.dirname, "../src/assets/examples", file));
const SHOTS = process.env.WELCOME_SHOTS ?? "";
const stubEnabled = process.env.E2E_STUB === "1";
const STUB = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const portfolioWords = (locale: Locale) => createTranslator({ locale, messages: MESSAGES[locale], namespace: "app.welcome.portfolio" });

/** No axe violation (WCAG 2.2 AA) on the step as it stands. */
async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Sign up in demo mode; ends on the welcome flow's first step. */
async function signUp(page: Page, locale: Locale): Promise<Messages> {
  const name = `pf-${unique()}`;
  // Steps and sheets slide in; checks (axe's colours among them) look at the settled screen.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  return MESSAGES[locale];
}

const continueButton = (page: Page, m: Messages) => page.locator("footer").getByRole("button", { name: m.app.welcome.continue, exact: true });
const finishButton = (page: Page, m: Messages) => page.locator("footer").getByRole("button", { name: m.app.welcome.finish, exact: true });
const stepTitle = (page: Page) => page.locator("#welcome-step");

/**
 * Kind → name → look (checks the look leads with the starter and is pre-selected), then on to the
 * next step. Returns the looks in the order the look step offered them.
 */
async function kindYouLook(page: Page, m: Messages, kind: Kind, displayName: string, starter: string, check = false): Promise<string[]> {
  const kinds = m.app.welcome.kinds;
  await expect(stepTitle(page)).toHaveText(m.app.welcome.steps.kind.title);
  await page.getByRole("radio", { name: new RegExp(`^${escape(kinds[kind].label)}`) }).check({ force: true });
  if (check) await expectAccessible(page);
  await continueButton(page, m).click();
  await expect(stepTitle(page)).toBeFocused();
  await page.getByLabel(kinds[kind].name, { exact: true }).fill(displayName);
  if (check) await expectAccessible(page);
  await continueButton(page, m).click();
  await expect(stepTitle(page)).toHaveText(m.app.welcome.steps.look.title);
  // The kind's starter leads the row and is chosen; the looks suggested for the kind follow it.
  const looks = page.locator('input[name="poster-template"]');
  await expect(looks.first()).toHaveValue(starter);
  await expect(looks.first()).toBeChecked();
  await expect(page.getByText(m.app.welcome.lookSuggested.replace("{kind}", kinds[kind].label))).toBeVisible();
  const order = await looks.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  if (check) await expectAccessible(page);
  await continueButton(page, m).click();
  return order;
}

/** The work step: three pieces of work, each a title and a sentence, and a cover where one is given. */
async function fillWork(page: Page, m: Messages, work: readonly { title: string; summary: string; picture?: string | undefined; alt?: string | undefined }[]): Promise<void> {
  const words = m.app.welcome.portfolio;
  await expect(stepTitle(page)).toHaveText(words.proofTitle);
  for (const [index, piece] of work.entries()) {
    const n = String(index + 1);
    await page.getByLabel(words.proofTitleN.replace("{n}", n), { exact: true }).fill(piece.title);
    await page.getByLabel(words.proofSentenceN.replace("{n}", n), { exact: true }).fill(piece.summary);
    if (piece.picture) {
      const card = page.locator(`[data-proof="${String(index)}"]`);
      const chooser = page.waitForEvent("filechooser");
      await card.getByRole("button", { name: m.app.form.uploadNamed.replace("{label}", words.proofCoverN.replace("{n}", n)) }).click();
      await (await chooser).setFiles(piece.picture);
      await card.getByLabel(m.app.form.alt, { exact: true }).fill(piece.alt ?? "");
    }
  }
}

/** The contact step: the way, its address; the button's words follow the way (a preset). */
async function fillContact(page: Page, m: Messages, way: "calendar" | "email" | "whatsapp" | "phone", address: string): Promise<void> {
  const words = m.app.welcome.portfolio;
  await expect(stepTitle(page)).toHaveText(words.actionTitle);
  await page.getByRole("radiogroup", { name: m.app.portfolio.contact.primary }).getByRole("radio", { name: words.ways[way], exact: true }).check({ force: true });
  await page.getByLabel(words.actionAddress, { exact: true }).fill(address);
}

/** The block types of the page in the editor's order (a row's id starts with its block's type). */
async function editorTypes(page: Page, locale: Locale): Promise<string[]> {
  await page.waitForURL(`**/${locale}/app/editor`);
  await expect(page.locator("[data-row]").first()).toBeVisible();
  return page.locator("[data-row]").evaluateAll((rows) => rows.map((row) => (row.getAttribute("data-row") ?? "").split("-")[0] ?? ""));
}

/** Done: the portfolio's words, then on to the editor. Returns the list of what was made. */
async function done(page: Page, m: Messages, locale: Locale, displayName: string, projects: number, button: string): Promise<void> {
  const words = m.app.welcome.portfolio;
  await expect(stepTitle(page)).toHaveText(words.doneTitle.replace("{name}", displayName));
  const made = page.getByRole("list", { name: words.made });
  await expect(made.getByRole("listitem").first()).toHaveText(portfolioWords(locale)("madeProjects", { count: projects }));
  await expect(made.getByRole("listitem").last()).toContainText(button);
  // The flow's last two buttons are pills in the footer; the ones in the card are not.
  const toEditor = page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor });
  await expect(toEditor).toHaveClass(/rounded-full/);
  await expect(page.locator("#main").getByRole("button", { name: m.app.welcome.toEditor })).toHaveCount(0);
}

const PORTFOLIO_SHAPE = ["header", "project", "project", "project"];

test.describe("portfolio kinds end on a filled portfolio", () => {
  test.skip(stubEnabled, "Runs on the demo build: it signs in with the demo code.");
  test("de · designer, no pictures: Werkbogen, three projects under „Arbeiten“, the contact block last; axe on every step", async ({ page }) => {
    const m = await signUp(page, "de");
    const looks = await kindYouLook(page, m, "designer", "Mila Berg", "werkbogen", true);
    // The look row: Werkbogen first, then the looks the tokens suggest for designers, then every other one.
    expect(looks.slice(0, 4)).toEqual(["werkbogen", "atelier", "folio", "tiefdruck"]);
    expect(new Set(looks).size).toBe(looks.length);
    expect(looks.length).toBeGreaterThanOrEqual(14);
    // Six steps: Arbeiten and Kontakt instead of Links.
    await expect(page.getByRole("list", { name: m.app.welcome.progress }).getByRole("listitem")).toHaveText([
      m.app.welcome.steps.kind.short,
      m.app.welcome.steps.you.short,
      m.app.welcome.steps.look.short,
      m.app.welcome.steps.proof.short,
      m.app.welcome.steps.action.short,
      m.app.welcome.steps.done.short,
    ]);
    await expect(page.getByText(m.app.welcome.portfolio.proofLeadVisual)).toBeVisible();
    await expectAccessible(page);
    await fillWork(page, m, [
      { title: "Hafenlicht", summary: "Eine Nachtserie für die Hafenbehörde." },
      { title: "Kioskatlas", summary: "Beschilderung für vierzig Kioske." },
      { title: "Dachgarten", summary: "Ein Auftritt für ein Café auf dem Dach." },
    ]);
    await continueButton(page, m).click();
    await fillContact(page, m, "email", "hallo@example.com");
    // The button's words follow the way: a designer is asked for projects.
    await expect(page.getByLabel(m.app.welcome.portfolio.actionLabel, { exact: true })).toHaveValue("Nachricht schreiben");
    // The profiles carry their platform's glyph in front of the field.
    await expect(page.locator("label").filter({ has: page.getByRole("textbox", { name: "Instagram" }) }).locator("svg")).toHaveCount(1);
    await expectAccessible(page);
    await finishButton(page, m).click();
    await done(page, m, "de", "Mila Berg", 3, "Nachricht schreiben");
    await expectAccessible(page);
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    const types = await editorTypes(page, "de");
    expect(types).toEqual([...PORTFOLIO_SHAPE, "contact"]);
    await expect(page.locator("[data-row]").filter({ hasText: de.app.portfolio.titles.work.designer }).first()).toBeVisible();
    await expect(page.locator("[data-row]").filter({ hasText: "Kioskatlas" })).toHaveCount(1);
  });

  test("de · photographer with pictures: the covers come along, the shoot button closes the page", async ({ page }) => {
    const m = await signUp(page, "de");
    await kindYouLook(page, m, "photographer", "Ronja Feld", "werkbogen");
    await fillWork(page, m, [
      { title: "Probenwoche", summary: "Eine Jugendkompanie probt sieben Tage lang.", picture: PICTURES[0], alt: "Tänzerinnen im Gegenlicht" },
      { title: "Halle 4", summary: "Ein Stück in einer alten Fabrikhalle.", picture: PICTURES[1], alt: "Eine leere Fabrikhalle" },
      { title: "Porträts", summary: "Ensemble des Stadttheaters.", picture: PICTURES[2], alt: "Ein Porträt im Halbschatten" },
    ]);
    await expectAccessible(page);
    await continueButton(page, m).click();
    await fillContact(page, m, "calendar", "https://cal.example.com/ronja");
    await expect(page.getByLabel(m.app.welcome.portfolio.actionLabel, { exact: true })).toHaveValue("Shooting anfragen");
    await finishButton(page, m).click();
    await done(page, m, "de", "Ronja Feld", 3, "Shooting anfragen");
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    expect(await editorTypes(page, "de")).toEqual([...PORTFOLIO_SHAPE, "contact"]);
    // Every project row shows its cover (a picture, not the title set large).
    for (const title of ["Probenwoche", "Halle 4", "Porträts"]) await expect(page.locator("[data-row]").filter({ hasText: title }).locator("img")).toHaveCount(1);
  });

  test("de · developer: Tiefdruck, the CV joins the contact block, a repository link stays a repository card", async ({ page }) => {
    await page.route("**/api/link-metadata**", (route) => route.fulfill({ json: { title: "agent-skills", description: "Skills for agents.", stars: 120, language: "TypeScript", license: "MIT", kind: "repo" } }));
    const m = await signUp(page, "de");
    await kindYouLook(page, m, "developer", "Leon Park", "tiefdruck");
    // Developers work in code, not pictures: no cover fields.
    await expect(page.getByText(m.app.welcome.portfolio.proofLead, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: m.app.form.upload })).toHaveCount(0);
    await fillWork(page, m, [
      { title: "Fahrplan-API", summary: "Echtzeitdaten für drei Verkehrsverbünde." },
      { title: "Lagerbuch", summary: "Inventur für ein Repair-Café." },
      { title: "Tastenfeld", summary: "Firmware für eine geteilte Tastatur." },
    ]);
    await continueButton(page, m).click();
    await fillContact(page, m, "calendar", "https://cal.example.com/leon");
    await page.getByLabel(de.app.welcome.fields.cv.label, { exact: true }).fill("example.com/leon-cv.pdf");
    await page.getByLabel(m.app.welcome.kinds.developer.links, { exact: true }).fill("https://github.com/example-org/agent-skills");
    await expectAccessible(page);
    await finishButton(page, m).click();
    await done(page, m, "de", "Leon Park", 3, "Erstgespräch buchen");
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    expect(await editorTypes(page, "de")).toEqual([...PORTFOLIO_SHAPE, "repo", "contact"]);
    await expect(page.locator("[data-row]").filter({ hasText: de.app.portfolio.titles.work.developer }).first()).toBeVisible();
  });

  test("de · freelancer: Werkbogen, a WhatsApp button, and a piece of work left half done is pointed out, not dropped", async ({ page }) => {
    const m = await signUp(page, "de");
    await kindYouLook(page, m, "freelancer", "Jona Weiss", "werkbogen");
    await fillWork(page, m, [{ title: "Klartext", summary: "" }]);
    await continueButton(page, m).click();
    // Still the work step: the sentence is asked for, and has the focus.
    await expect(stepTitle(page)).toHaveText(m.app.welcome.portfolio.proofTitle);
    const sentence = page.getByLabel(m.app.welcome.portfolio.proofSentenceN.replace("{n}", "1"), { exact: true });
    await expect(sentence).toBeFocused();
    await expect(page.getByText(m.app.errors.required)).toBeVisible();
    await expectAccessible(page);
    await sentence.fill("Texte für eine Stadtbibliothek.");
    await expect(page.getByText(m.app.errors.required)).toHaveCount(0);
    await fillWork(page, m, [
      { title: "Klartext", summary: "Texte für eine Stadtbibliothek." },
      { title: "Zwei Seiten", summary: "Ein Jahresbericht in einfacher Sprache." },
      { title: "Fahrradstadt", summary: "Eine Kampagne für sichere Radwege." },
    ]);
    await continueButton(page, m).click();
    await fillContact(page, m, "whatsapp", "+49 151 23456789");
    await finishButton(page, m).click();
    await done(page, m, "de", "Jona Weiss", 3, "Per WhatsApp schreiben");
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    expect(await editorTypes(page, "de")).toEqual([...PORTFOLIO_SHAPE, "contact"]);
  });

  test("en · engineer: Tiefdruck, two pieces of work, the done step counts exactly what was made", async ({ page }) => {
    const m = await signUp(page, "en");
    await kindYouLook(page, m, "engineer", "Sam Okafor", "tiefdruck");
    await fillWork(page, m, [
      { title: "Footbridge retrofit", summary: "Load tests and new bearings for a 1960s bridge." },
      { title: "Flood gate", summary: "A gate a single person can close in ten minutes." },
    ]);
    await continueButton(page, m).click();
    await fillContact(page, m, "email", "sam@example.com");
    await finishButton(page, m).click();
    await done(page, m, "en", "Sam Okafor", 2, "Send a message");
    await expectAccessible(page);
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    expect(await editorTypes(page, "en")).toEqual(["header", "project", "project", "contact"]);
  });

  test("ar · designer with a picture: mirrored, Arabic titles get addresses of their own, the contact block last", async ({ page }) => {
    const m = await signUp(page, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await kindYouLook(page, m, "designer", "ليلى حداد", "werkbogen");
    await fillWork(page, m, [
      { title: "ضوء الميناء", summary: "سلسلة ليلية لهيئة الميناء.", picture: PICTURES[0], alt: "راقصات في الضوء" },
      { title: "أطلس الأكشاك", summary: "لافتات لأربعين كشكًا." },
      { title: "حديقة السطح", summary: "هوية لمقهى على السطح." },
    ]);
    await expectAccessible(page);
    await continueButton(page, m).click();
    await fillContact(page, m, "email", "layla@example.com");
    await expectAccessible(page);
    await finishButton(page, m).click();
    await done(page, m, "ar", "ليلى حداد", 3, "أرسل رسالة");
    await expectAccessible(page);
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    expect(await editorTypes(page, "ar")).toEqual([...PORTFOLIO_SHAPE, "contact"]);
  });

  test("de · nothing typed in the work and contact steps: an honest, empty start (no title over no work)", async ({ page }) => {
    const m = await signUp(page, "de");
    await kindYouLook(page, m, "photographer", "Ronja Feld", "werkbogen");
    await continueButton(page, m).click();
    await finishButton(page, m).click();
    // No "your portfolio is ready" over a page without work, and no advice to share it yet.
    await expect(stepTitle(page)).toHaveText(m.app.welcome.portfolio.emptyDoneTitle.replace("{name}", "Ronja Feld"));
    await expect(page.getByText(m.app.welcome.portfolio.emptyDoneLead)).toBeVisible();
    await expect(page.getByText(m.app.welcome.portfolio.doneTitle.replace("{name}", "Ronja Feld"))).toHaveCount(0);
    await expect(page.getByRole("list", { name: m.app.welcome.portfolio.made })).toHaveCount(0);
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toDashboard }).click();
    await page.waitForURL("**/de/app");
  });
});

test.describe("the welcome runs once", () => {
  test.skip(stubEnabled, "Runs on the demo build: it signs in with the demo code.");
  test("de · the page is made, so leaving on the done step does not run the welcome again", async ({ page }) => {
    const m = await signUp(page, "de");
    await kindYouLook(page, m, "designer", "Mara Holt", "werkbogen");
    await fillWork(page, m, [{ title: "Leitsystem", summary: "Wegweiser für ein Museum." }]);
    await continueButton(page, m).click();
    await fillContact(page, m, "email", "mara@example.com");
    await finishButton(page, m).click();
    await expect(stepTitle(page)).toHaveText(m.app.welcome.portfolio.doneTitle.replace("{name}", "Mara Holt"));
    // No footer button pressed: the account already counts as welcomed.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const db = JSON.parse(window.localStorage.getItem("linkyo.demo.v1") ?? "{}") as { session?: { accountId: string }; sites?: Record<string, { onboarded?: boolean }> };
          return db.session ? db.sites?.[db.session.accountId]?.onboarded : undefined;
        }),
      )
      .toBe(true);
    // A later visit lands where it was going (the gate would send an unwelcomed account back).
    await page.goto("/de/app/editor");
    expect(await editorTypes(page, "de")).toEqual(["header", "project", "contact"]);
  });
});

test.describe("the contact step keeps what was typed", () => {
  test.skip(stubEnabled, "Runs on the demo build: it signs in with the demo code.");
  test("de · photographer: an address whose button words were cleared is pointed out, not dropped", async ({ page }) => {
    const m = await signUp(page, "de");
    await kindYouLook(page, m, "photographer", "Ilka Brandt", "werkbogen");
    await fillWork(page, m, [{ title: "Hafenlicht", summary: "Nachtbilder vom Containerhafen." }]);
    await continueButton(page, m).click();
    await fillContact(page, m, "email", "ilka@example.com");
    const label = page.getByLabel(m.app.welcome.portfolio.actionLabel, { exact: true });
    await label.fill("");
    await finishButton(page, m).click();
    // Still the contact step: the words are asked for, at their field.
    await expect(stepTitle(page)).toHaveText(m.app.welcome.portfolio.actionTitle);
    await expect(label).toBeFocused();
    await expect(page.getByText(m.app.errors.required)).toBeVisible();
    await expectAccessible(page);
    await label.fill("Schreib mir");
    await expect(page.getByText(m.app.errors.required)).toHaveCount(0);
    await finishButton(page, m).click();
    await done(page, m, "de", "Ilka Brandt", 1, "Schreib mir");
  });
});

test.describe("everyone else keeps the five steps", () => {
  test.skip(stubEnabled, "Runs on the demo build: it signs in with the demo code.");
  test("de · coach: links step with booking, newsletter (demo) and e-mail; the done step speaks of the bio", async ({ page }) => {
    const m = await signUp(page, "de");
    await kindYouLook(page, m, "coach", "Ada Stern", "daylight");
    await expect(page.getByRole("list", { name: m.app.welcome.progress }).getByRole("listitem")).toHaveCount(5);
    await expect(stepTitle(page)).toHaveText(m.app.welcome.steps.links.title);
    await expect(page.getByLabel(de.app.welcome.fields.booking.label, { exact: true })).toBeVisible();
    // The demo keeps its newsletter; real accounts are not offered one (the stub run below).
    await expect(page.getByRole("switch", { name: de.app.welcome.fields.newsletter.label })).toBeVisible();
    await expect(page.locator("label").filter({ has: page.getByRole("textbox", { name: "Instagram" }) }).locator("svg")).toHaveCount(1);
    await expectAccessible(page);
    await page.getByLabel(de.app.welcome.fields.booking.label, { exact: true }).fill("cal.example.com/ada");
    await finishButton(page, m).click();
    await expect(stepTitle(page)).toHaveText(m.app.welcome.steps.done.title.replace("{name}", "Ada Stern"));
    await expect(page.getByText(m.app.welcome.steps.done.lead)).toBeVisible();
    await expect(page.getByRole("list", { name: m.app.welcome.portfolio.made })).toHaveCount(0);
    await expectAccessible(page);
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    expect(await editorTypes(page, "de")).toEqual(["link"]);
  });

  test("de · the kind grid: brand logos only for platform kinds, a step smaller in the same tile; Streamer has a gamepad", async ({ page }) => {
    const m = await signUp(page, "de");
    const tile = (kind: Kind) => page.locator("label").filter({ has: page.getByRole("radio", { name: new RegExp(`^${escape(m.app.welcome.kinds[kind].label)}`) }) });
    const glyph = (kind: Kind) => tile(kind).locator("svg").first();
    const width = async (kind: Kind) => (await glyph(kind).boundingBox())?.width ?? 0;
    // Platform logos at icon-md (20 px), outline icons at icon-lg (24 px), in a 40 px tile.
    expect(await width("tiktok")).toBe(20);
    expect(await width("photographer")).toBe(24);
    expect((await glyph("tiktok").locator("..").boundingBox())?.width).toBe(40);
    await expect(tile("streamer").locator("svg.lucide-gamepad-2")).toHaveCount(1);
  });

  test("de · business: the website field has no empty hint under it", async ({ page }) => {
    const m = await signUp(page, "de");
    await kindYouLook(page, m, "business", "Atelier Nord", "daylight");
    const website = page.getByLabel(de.app.welcome.fields.website.label, { exact: true });
    await expect(website).toBeVisible();
    const describedBy = (await website.getAttribute("aria-describedby")) ?? "";
    // The message region stays (an error would be read out), but there is no hint in it.
    if (describedBy) await expect(page.locator(`[id="${describedBy}"]`)).toBeEmpty();
  });
});

/** Saves the three portfolio steps as a photographer sees them: phone and laptop, de and ar. */
test.describe("screenshots", () => {
  test.skip(stubEnabled, "Runs on the demo build: it signs in with the demo code.");
  test.skip(!SHOTS, "Set WELCOME_SHOTS=<dir> to save the screenshots.");

  /** The screen as it is seen (the sticky bar where it sits): from the top, and scrolled to the end. */
  const shot = async (page: Page, name: string, end = false) => {
    mkdirSync(SHOTS, { recursive: true });
    // No hover from the last click: the buttons as they rest.
    await page.mouse.move(1, 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    if (!end) return;
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: path.join(SHOTS, `${name}-end.png`) });
  };

  async function walk(browser: Browser, locale: Locale, size: "phone" | "laptop"): Promise<void> {
    const context = await browser.newContext({ viewport: size === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: size === "phone", hasTouch: size === "phone" });
    const page = await context.newPage();
    const m = await signUp(page, locale);
    const ar = locale === "ar";
    await expect(page.locator("#welcome-step")).toHaveText(m.app.welcome.steps.kind.title);
    await shot(page, `${size}-${locale}-0-kinds`);
    await kindYouLook(page, m, "photographer", ar ? "رنا الخطيب" : "Ronja Feld", "werkbogen");
    await fillWork(
      page,
      m,
      ar
        ? [
            { title: "أسبوع البروفات", summary: "فرقة شبابية تتدرّب سبعة أيام.", picture: PICTURES[0], alt: "راقصات في الضوء" },
            { title: "القاعة 4", summary: "عرض في مصنع قديم.", picture: PICTURES[1], alt: "قاعة مصنع فارغة" },
            { title: "بورتريهات", summary: "فرقة المسرح البلدي." },
          ]
        : [
            { title: "Probenwoche", summary: "Eine Jugendkompanie probt sieben Tage lang.", picture: PICTURES[0], alt: "Tänzerinnen im Gegenlicht" },
            { title: "Halle 4", summary: "Ein Stück in einer alten Fabrikhalle.", picture: PICTURES[1], alt: "Eine leere Fabrikhalle" },
            { title: "Porträts", summary: "Ensemble des Stadttheaters." },
          ],
    );
    await page.locator("#welcome-step").focus();
    await shot(page, `${size}-${locale}-1-work`, true);
    await continueButton(page, m).click();
    await fillContact(page, m, "calendar", "https://cal.example.com/ronja");
    await page.getByRole("textbox", { name: "Instagram" }).fill("ronja.feld");
    await page.locator("#welcome-step").focus();
    await shot(page, `${size}-${locale}-2-contact`, true);
    await finishButton(page, m).click();
    await expect(page.getByRole("list", { name: m.app.welcome.portfolio.made })).toBeVisible();
    await shot(page, `${size}-${locale}-3-done`);
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    await page.waitForURL(`**/${locale}/app/editor`);
    await expect(page.locator("[data-row]").first()).toBeVisible();
    await shot(page, `${size}-${locale}-4-editor`);
    await context.close();
  }

  test("photographer: work, contact and done steps on a phone and a laptop, de and ar", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "Once is enough: the contexts set their own sizes.");
    test.setTimeout(240_000);
    for (const locale of ["de", "ar"] as const) for (const size of ["phone", "laptop"] as const) await walk(browser, locale, size);
  });
});

// ─── Real accounts (the Supabase stand-in) ────────────────────────────────────────────────────────

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
/** A bearer token the stand-in reads the account from (unsigned: nothing here checks a signature). */
const tokenFor = (id: string) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", exp: 4_070_908_800 })}.stub`;

interface Account {
  id: string;
  email: string;
  username: string;
  token: string;
}

/** A new real account that has not been through the welcome flow, known to the stand-in. */
async function newcomer(prefix: string, locale: Locale): Promise<Account> {
  const id = randomUUID();
  const username = `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const email = `${username}@example.com`;
  const seed = {
    users: { [id]: { id, email } },
    profiles: { [id]: { id, username, locale, status: "active", created_at: "2026-11-01T00:00:00Z" } },
    sites: {
      [id]: {
        profile_id: id,
        kind: null,
        onboarded: false,
        prepared: null,
        page: { profile: { username, displayName: username, bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale }, blocks: [] },
        theme: { template: "nocturne" },
        legal: { name: "", address: "", email, phone: "" },
        updated_at: "2026-11-20T10:00:00Z",
      },
    },
  };
  const response = await fetch(`${STUB}/__stub/seed`, { method: "POST", body: JSON.stringify(seed) });
  if (!response.ok) throw new Error(`stub seed failed: ${String(response.status)}`);
  return { id, email, username, token: tokenFor(id) };
}

/** Signs the browser in: the session cookie the app's Supabase client reads (no e-mail, no code). */
async function signIn(context: BrowserContext, baseURL: string | undefined, who: Account): Promise<void> {
  const session = {
    access_token: who.token,
    refresh_token: "stub-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4_070_908_800,
    user: { id: who.id, aud: "authenticated", role: "authenticated", email: who.email, app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" },
  };
  const host = new URL(STUB).hostname.split(".")[0] ?? "127";
  await context.addCookies([{ name: `sb-${host}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: baseURL ?? "http://localhost:3100" }]);
}

/** The page as the stand-in stores it (what the account saved). */
async function storedPage(who: Account): Promise<{ blocks: { type: string; title?: string; primary?: { label: string } }[] } | null> {
  const response = await fetch(`${STUB}/rest/v1/sites?profile_id=eq.${who.id}`);
  const rows = (await response.json()) as { page?: { blocks: { type: string; title?: string; primary?: { label: string } }[] } }[];
  return rows[0]?.page ?? null;
}

test.describe("real accounts (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  test("a photographer's welcome saves three projects and the contact block to the page, as the hosted database stores it", async ({ page, context, baseURL }) => {
    const who = await newcomer("foto", "de");
    await signIn(context, baseURL, who);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/de/app/welcome");
    const m = MESSAGES.de;
    await kindYouLook(page, m, "photographer", "Ronja Feld", "werkbogen");
    await fillWork(page, m, [
      { title: "Probenwoche", summary: "Eine Jugendkompanie probt sieben Tage lang." },
      { title: "Halle 4", summary: "Ein Stück in einer alten Fabrikhalle." },
      { title: "Porträts", summary: "Ensemble des Stadttheaters." },
    ]);
    await continueButton(page, m).click();
    await fillContact(page, m, "calendar", "https://cal.example.com/ronja");
    await expectAccessible(page);
    await finishButton(page, m).click();
    await done(page, m, "de", "Ronja Feld", 3, "Shooting anfragen");
    await page.locator("footer").getByRole("button", { name: m.app.welcome.toEditor }).click();
    await page.waitForURL("**/de/app/editor");
    // Saved through the same table write as every page change (no new function).
    await expect
      .poll(async () => (await storedPage(who))?.blocks.map((block) => block.type))
      .toEqual(["header", "project", "project", "project", "contact"]);
    const saved = await storedPage(who);
    expect(saved?.blocks.at(-1)?.primary?.label).toBe("Shooting anfragen");
    // The public page shows the work and the button.
    expect((await page.goto(`/${who.username}`))?.status()).toBe(200);
    for (const title of ["Probenwoche", "Halle 4", "Porträts"]) await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Shooting anfragen/ }).first()).toBeVisible();
  });

  test("a real coach is not offered a newsletter (nothing could send it yet)", async ({ page, context, baseURL }) => {
    const who = await newcomer("coach", "de");
    await signIn(context, baseURL, who);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/de/app/welcome");
    const m = MESSAGES.de;
    await kindYouLook(page, m, "coach", "Ada Stern", "daylight");
    await expect(stepTitle(page)).toHaveText(m.app.welcome.steps.links.title);
    await expect(page.getByLabel(de.app.welcome.fields.booking.label, { exact: true })).toBeVisible();
    await expect(page.getByLabel(de.app.welcome.fields.email.label, { exact: true })).toBeVisible();
    await expect(page.getByRole("switch", { name: de.app.welcome.fields.newsletter.label })).toHaveCount(0);
    await expectAccessible(page);
  });
});
