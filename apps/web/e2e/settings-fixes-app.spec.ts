import { expect, test, type Locator, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * Settings: import and its Undo, ⌘Z after a picked page language, addresses and moving headers saved
 * before the restructure, and where focus goes when Save, Discard or Cancel go away.
 * Demo mode (everything lives in this browser's storage); runs on desktop and on a phone.
 */

const STORAGE_KEY = "linkyo.demo.v1";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signUp(page: Page, locale = "en") {
  const name = `mila-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  return { name, email: `${name}@example.com` };
}

/** Sign up and skip the welcome flow (for tests about the dashboard itself). */
async function signedIn(page: Page, locale = "en") {
  const account = await signUp(page, locale);
  await page.getByRole("button", { name: locale === "ar" ? "لاحقًا" : "Skip for now" }).click();
  await page.waitForURL(`**/${locale}/app`);
  return account;
}

interface StoredSite {
  page: { profile: Record<string, unknown> & { displayName: string; locale: string }; blocks: unknown[] };
  theme: Record<string, unknown>;
  legal: { name: string; address: string; email: string; phone: string };
}

/** The signed-in account's site as stored right now. */
const storedSite = (page: Page) =>
  page.evaluate<StoredSite, string>((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
      session: { accountId: string };
      sites: Record<string, StoredSite>;
    };
    const site = db.sites[db.session.accountId];
    if (!site) throw new Error("no site");
    return site;
  }, STORAGE_KEY);

/** Changes the signed-in account's stored data, as an older version of the app could have saved it. */
async function patchStore(page: Page, patch: { username?: string; motion?: string }) {
  await page.evaluate(
    ([key, next]) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
        session: { accountId: string };
        accounts: { id: string; username: string }[];
        sites: Record<string, { page: { profile: { username: string; motion?: { src: string } } } }>;
      };
      const id = db.session.accountId;
      const site = db.sites[id];
      if (!site) throw new Error("no site");
      if (next.username) {
        for (const account of db.accounts) if (account.id === id) account.username = next.username;
        site.page.profile.username = next.username;
      }
      if (next.motion) site.page.profile.motion = { src: next.motion };
      window.localStorage.setItem(key, JSON.stringify(db));
    },
    [STORAGE_KEY, patch] as const,
  );
}

/** The pane's visible back link (in the toolbar on wide screens, in the top bar on phones). */
const back = (page: Page, name: string) =>
  page
    .getByRole("link", { name: `Back: ${name}`, exact: true })
    .locator("visible=true")
    .first();

/** Moves focus with Tab (as a keyboard user does) until `target` has it. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 12; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

/** Imports `site` (an export of the page with a few changes) through Settings → Import. */
async function importSite(page: Page, site: StoredSite) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import a page" }).click();
  await (
    await chooser
  ).setFiles({
    name: "linkyo-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ site })),
  });
  await page.getByRole("alertdialog").getByRole("button", { name: "Replace my page" }).click();
  await expect(page.getByText("Page imported").first()).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

const IMPORTED_LEGAL = {
  name: "Atelier Aurel GmbH",
  address: "Importweg 2, 20095 Hamburg",
  email: "",
  phone: "",
};

/** Leaves an unsaved edit in the legal notice, then goes back to Settings without reloading (drafts live in memory). */
async function legalDraft(page: Page, name: string) {
  await page.goto("/en/app/settings/legal");
  await page.getByLabel("Full name or company").fill(name);
  await expect(page.getByRole("button", { name: "Discard" })).toBeVisible();
  await back(page, "Settings").click();
  await page.waitForURL("**/en/app/settings");
  await expect(legalUnsaved(page)).toHaveCount(1);
}

/** The Settings row that opens the profile; it shows the page's name. */
const profileRow = (page: Page) =>
  page.locator("#main")
    .getByRole("listitem")
    .filter({ has: page.getByText("Profile", { exact: true }) })
    .getByRole("button");
/** The Settings row that opens the legal notice (the shell's "not saved" status links there too). */
const legalRow = (page: Page) =>
  page.locator("#main")
    .getByRole("listitem")
    .filter({ has: page.getByText("Legal notice", { exact: true }) })
    .getByRole("link");
/** The shell's save status while the legal notice has unsaved edits. */
const legalUnsaved = (page: Page) =>
  page.getByRole("link", { name: "Legal notice not saved" }).locator("visible=true");
const pageLanguage = (page: Page) => page.getByRole("combobox", { name: "Page language" });

test.describe("settings: import and undo", () => {
  test("an import replaces an unsaved legal notice too, so the pane shows the imported one", async ({
    page,
  }) => {
    await signedIn(page);
    await legalDraft(page, "Draft Name");
    const site = await storedSite(page);
    await importSite(page, {
      ...site,
      page: { ...site.page, profile: { ...site.page.profile, displayName: "Imported Name" } },
      legal: IMPORTED_LEGAL,
    });
    await expect(profileRow(page)).toContainText("Imported Name");
    await expect(legalUnsaved(page)).toHaveCount(0);
    await legalRow(page).click();
    await page.waitForURL("**/en/app/settings/legal");
    await expect(page.getByLabel("Full name or company")).toHaveValue(IMPORTED_LEGAL.name);
    // Nothing waits to be saved over it.
    await expect(page.getByRole("button", { name: "Discard" })).toHaveCount(0);
  });

  test("Undo right after an import brings back the page, the legal notice and its unsaved edits", async ({
    page,
  }) => {
    await signedIn(page);
    await legalDraft(page, "Draft Name");
    const site = await storedSite(page);
    await importSite(page, {
      ...site,
      page: { ...site.page, profile: { ...site.page.profile, displayName: "Imported Name" } },
      legal: IMPORTED_LEGAL,
    });
    await page.getByRole("button", { name: "Undo" }).last().click();
    await expect(profileRow(page)).not.toContainText("Imported Name");
    await expect(profileRow(page)).toContainText(site.page.profile.displayName);
    await expect.poll(async () => (await storedSite(page)).legal.name).toBe(site.legal.name);
    await expect(legalUnsaved(page)).toHaveCount(1);
    await legalRow(page).click();
    await page.waitForURL("**/en/app/settings/legal");
    await expect(page.getByLabel("Full name or company")).toHaveValue("Draft Name");
    await expect(page.getByRole("button", { name: "Discard" })).toBeVisible();
  });

  test("Undo after a later change takes back neither that change nor the legal notice", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/app/settings");
    const site = await storedSite(page);
    await importSite(page, {
      ...site,
      page: { ...site.page, profile: { ...site.page.profile, displayName: "Imported Name" } },
      legal: IMPORTED_LEGAL,
    });
    // A new step in the history while the toast still offers Undo.
    await pageLanguage(page).selectOption("de");
    await page.getByRole("button", { name: "Undo" }).last().click();
    await expect(pageLanguage(page)).toHaveValue("de");
    await expect(profileRow(page)).toContainText("Imported Name");
    await page.waitForTimeout(600); // longer than autosave
    const stored = await storedSite(page);
    expect(stored.page.profile.displayName).toBe("Imported Name");
    expect(stored.page.profile.locale).toBe("de");
    expect(stored.legal.name).toBe(IMPORTED_LEGAL.name);
  });

  test("after ⌘Z took the import back, Undo restores only the legal notice and takes back nothing else", async ({
    page,
  }) => {
    await signedIn(page);
    await page.goto("/en/app/settings");
    // An earlier step that one undo too many would take back.
    await pageLanguage(page).selectOption("de");
    await expect.poll(async () => (await storedSite(page)).page.profile.locale).toBe("de");
    const site = await storedSite(page);
    await importSite(page, {
      ...site,
      page: { ...site.page, profile: { ...site.page.profile, displayName: "Imported Name" } },
      legal: IMPORTED_LEGAL,
    });
    await expect(profileRow(page)).toContainText("Imported Name");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(profileRow(page)).toContainText(site.page.profile.displayName);
    await expect(profileRow(page)).not.toContainText("Imported Name");
    await page.getByRole("button", { name: "Undo" }).last().click();
    await expect(pageLanguage(page)).toHaveValue("de");
    await expect.poll(async () => (await storedSite(page)).legal.name).toBe(site.legal.name);
  });
});

test.describe("settings: values saved before", () => {
  test("⌘Z right after picking the page language takes it back, with focus still on the picker", async ({
    page,
  }) => {
    await signedIn(page);
    await page.goto("/en/app/settings");
    const language = pageLanguage(page);
    await expect(language).toHaveValue("en");
    await language.focus();
    await language.selectOption("de");
    await expect(language).toHaveValue("de");
    await expect(language).toBeFocused();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(language).toHaveValue("en");
  });

  test("an address with two dashes in a row stays as it is until it is edited", async ({ page }) => {
    const { name } = await signedIn(page);
    const dashed = name.replace("mila-", "mila--");
    await patchStore(page, { username: dashed });
    await page.goto("/en/app/settings/address");
    const field = page.getByLabel("Address", { exact: true });
    await expect(field).toHaveValue(dashed);
    // Not an edit: no check, no "available", no button that would change it.
    await expect(page.getByRole("button", { name: "Change address" })).toHaveCount(0);
    await expect(page.getByText(/is available/)).toHaveCount(0);
    await field.focus();
    await field.blur();
    await expect(field).toHaveValue(dashed);
    await expect(page.getByRole("button", { name: "Change address" })).toHaveCount(0);
  });

  test("a moving-header link saved earlier does not block saving the bio; a new one is still checked", async ({
    page,
  }) => {
    await signedIn(page);
    await page.route("https://cdn.example.com/**", (route) => route.abort());
    await patchStore(page, { motion: "https://cdn.example.com/hero.m4v" });
    await page.goto("/en/app/settings");
    await profileRow(page).click();
    const sheet = page.getByRole("dialog", { name: "Profile" });
    const save = sheet.getByRole("button", { name: "Save profile" }).locator("visible=true").first();
    await sheet.getByLabel("Short bio").fill("Producer from Berlin.");
    await save.click();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await storedSite(page)).page.profile.bio).toBe("Producer from Berlin.");
    expect((await storedSite(page)).page.profile.motion).toEqual({ src: "https://cdn.example.com/hero.m4v" });

    await profileRow(page).click();
    await sheet.getByLabel("Moving header").fill("https://cdn.example.com/other.m4v");
    await save.click();
    await expect(sheet.getByText("Paste a direct link to an MP4 file.")).toBeVisible();
    await expect(sheet).toBeVisible();
  });
});

test.describe("settings: focus when the buttons go away", () => {
  test("legal notice: Save and Discard by keyboard leave focus on the last field; a click moves nothing", async ({
    page,
  }) => {
    await signedIn(page);
    await page.goto("/en/app/settings/legal");
    const name = page.getByLabel("Full name or company");
    const phone = page.getByLabel("Phone");
    await name.fill("Mila Aurel");
    await tabTo(page, page.getByRole("button", { name: "Save legal notice" }));
    await page.keyboard.press("Enter");
    await expect(page.getByText("Legal notice saved").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save legal notice" })).toHaveCount(0);
    await expect(phone).toBeFocused();

    await name.fill("Someone else");
    await tabTo(page, page.getByRole("button", { name: "Discard" }));
    await page.keyboard.press("Enter");
    await expect(name).toHaveValue("Mila Aurel");
    await expect(phone).toBeFocused();

    // A tap or click is not followed: on a phone, a focused field would open the keyboard.
    await name.fill("Someone else");
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(name).toHaveValue("Mila Aurel");
    await expect(phone).not.toBeFocused();
    await expect(name).not.toBeFocused();
  });

  test("email: Cancel and Save by keyboard leave focus on the field", async ({ page }) => {
    const { email } = await signedIn(page);
    await page.goto("/en/app/settings/account");
    const field = page.getByLabel("Email", { exact: true });
    await expect(field).toHaveValue(email);
    await field.fill(`other-${email}`);
    await tabTo(page, page.getByRole("button", { name: "Cancel" }));
    await page.keyboard.press("Enter");
    await expect(field).toHaveValue(email);
    await expect(field).toBeFocused();

    await field.fill(`other-${email}`);
    await tabTo(page, page.getByRole("button", { name: "Change email" }));
    await page.keyboard.press("Enter");
    await expect(page.getByText("Email changed").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Change email" })).toHaveCount(0);
    await expect(field).toBeFocused();
  });

  test("address: a change confirmed by keyboard leaves focus on the field", async ({ page }) => {
    const { name } = await signedIn(page);
    await page.goto("/en/app/settings/address");
    const field = page.getByLabel("Address", { exact: true });
    await field.fill(`${name}-studio`);
    await expect(page.getByText(`linkyo.app/${name}-studio is available`)).toBeVisible();
    await tabTo(page, page.getByRole("button", { name: "Change address" }));
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog");
    await tabTo(page, dialog.getByRole("button", { name: "Change address" }));
    await page.keyboard.press("Enter");
    await expect(page.getByText(`Your page is now at linkyo.app/${name}-studio`).first()).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change address" })).toHaveCount(0);
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(`${name}-studio`);
  });
});
