import { expect, test, type Page } from "@playwright/test";

import { mockCalls, realEnabled, test as realTest } from "./real";

/** The playground on a phone: the stage, the controls and "Keep this page" on one screen, as in an app. */

test("on a phone the playground fits one screen under the header, with its button in view", async ({ page }) => {
  await page.goto("/en");
  const playground = page.locator("#try");
  const card = playground.getByRole("tablist").locator("xpath=../..");
  // The card's top just under the sticky header (64 px).
  await card.evaluate((element) => {
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 64, behavior: "instant" });
  });
  const box = await card.boundingBox();
  const screen = await page.evaluate(() => window.innerHeight);
  expect(box).not.toBeNull();
  expect((box?.height ?? Infinity) <= screen - 64).toBe(true);
  await expect(playground.getByRole("link", { name: "Keep this page" })).toBeInViewport();
  await expect(playground.getByRole("tab", { name: "Profile" })).toBeInViewport();
  // Nothing is wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("the demo's own button stops it where it is, and it does not start again by itself", async ({ page }) => {
  await page.goto("/en");
  const playground = page.locator("#try");
  await playground.getByRole("button", { name: "Watch", exact: true }).click();
  await expect(playground.getByLabel("Your name")).toHaveValue(/^Lou/, { timeout: 8_000 });
  await playground.getByRole("button", { name: "Stop demo" }).click();
  await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible();
  const value = await playground.getByLabel("Your name").inputValue();
  await page.waitForTimeout(1500);
  await expect(playground.getByLabel("Your name")).toHaveValue(value);
  await expect(playground.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
});

// v7 (plan §1.5.1): the playground's fixes, and no AI tab before a real recording exists.

/** Counts, from page load, the changes inside regions screen readers speak (in `scope`, not the inert page in the phone). */
function countLiveMutations(scope: string) {
  const live = window as unknown as { __liveMutations: number };
  live.__liveMutations = 0;
  const heard = (node: Node | null): boolean => {
    const element = node instanceof Element ? node : (node?.parentElement ?? null);
    const region = element?.closest('[aria-live]:not([aria-live="off"]), [role="status"], [role="log"], [role="alert"]');
    return Boolean(region?.closest(scope) && !region.closest('[aria-hidden="true"], [inert]'));
  };
  new MutationObserver((records) => {
    for (const record of records) if (heard(record.target)) live.__liveMutations += 1;
  }).observe(document, { subtree: true, childList: true, characterData: true });
}

const REPLAY_LABEL = { de: "Nochmal ansehen", en: "Watch again", ar: "شاهد مرة أخرى" } as const;
const PLAY_LABEL = { de: "Ansehen", en: "Watch", ar: "شاهد" } as const;

/**
 * Brings the playground into view so its demo plays by itself. Pictures above it can still push it
 * down while they load; if the demo has not started after a moment, it is brought into view again,
 * and as a last resort started with its own button (still no visitor input inside the card).
 */
async function playDemo(page: Page, locale: keyof typeof PLAY_LABEL = "en") {
  const playground = page.locator("#try");
  const button = playground.locator("[data-demo-button]");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await playground.evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    try {
      await expect(button).not.toHaveAccessibleName(PLAY_LABEL[locale], { timeout: 4_000 });
      return;
    } catch {
      // Not started yet: try again.
    }
  }
  await button.click();
}

realTest("@real the homepage never calls the AI: no /api/ai request in any language, through the demo and Keep this page", async ({ page, tag }) => {
  realTest.slow();
  const asked: string[] = [];
  page.on("request", (request) => asked.push(request.url()));
  for (const locale of ["de", "en", "ar"] as const) {
    await page.goto(`/${locale}`);
    const playground = page.locator("#try");
    // The demo plays to its end.
    await playDemo(page, locale);
    await expect(playground.locator("[data-demo-button]")).toHaveAccessibleName(REPLAY_LABEL[locale], { timeout: 40_000 });
    if (locale === "en") {
      await playground.getByRole("link", { name: "Keep this page" }).click();
      await page.waitForURL("**/en/signup?**");
    }
  }
  expect(asked.filter((url) => url.includes("/api/ai"))).toEqual([]);
  if (realEnabled) expect(await mockCalls(tag)).toBe(0);
});

test("W2: nothing is announced while the demo plays", async ({ page }) => {
  await page.addInitScript(countLiveMutations, "#try");
  await page.goto("/en");
  const playground = page.locator("#try");
  await playDemo(page);
  await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible({ timeout: 40_000 });
  expect(await page.evaluate(() => (window as unknown as { __liveMutations: number }).__liveMutations)).toBe(0);
});

test("W3: on wide screens Tab goes through the controls before the demo's button", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The controls and the stage sit side by side on wide screens.");
  await page.goto("/en");
  await page.locator("#try-title").evaluate((heading) => {
    heading.setAttribute("tabindex", "-1");
    heading.scrollIntoView({ block: "start", behavior: "instant" });
    (heading as HTMLElement).focus();
  });
  const order: string[] = [];
  for (let press = 0; press < 40; press += 1) {
    await page.keyboard.press("Tab");
    const at = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active?.closest("#try")) return "outside";
      if (active.matches("[data-demo-button]")) return "demo";
      if (active.getAttribute("role") === "tab") return "tab";
      return active.textContent.includes("Keep this page") ? "keep" : "control";
    });
    order.push(at);
    if (at === "demo") break;
  }
  // Right after the heading: the tabs; then the fields and "Keep this page"; the demo's button last.
  expect(order[0]).toBe("tab");
  expect(order.at(-1)).toBe("demo");
  expect(order.indexOf("keep")).toBeGreaterThan(0);
  expect(order.indexOf("keep")).toBeLessThan(order.indexOf("demo"));
});

test("W5: the demo ends with the first piece from the shop in the phone", async ({ page }) => {
  await page.goto("/en");
  const playground = page.locator("#try");
  await playDemo(page);
  await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible({ timeout: 40_000 });
  const screen = playground.locator("[data-try-preview]");
  const piece = screen.getByText("“Soleil” necklace").first();
  await expect
    .poll(async () => {
      const [frame, card] = await Promise.all([screen.boundingBox(), piece.boundingBox()]);
      if (!frame || !card) return false;
      return card.y < frame.y + frame.height && card.y + card.height > frame.y && card.x < frame.x + frame.width && card.x + card.width > frame.x;
    })
    .toBe(true);
});

test("W6: before anything changes, the phone shows the example page and the controls stay empty", async ({ page }, testInfo) => {
  await page.goto("/en");
  const playground = page.locator("#try");
  const card = playground.getByRole("tablist").locator("xpath=../..");
  // About half of the card in view: below the demo's trigger (three quarters).
  await card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + box.top - window.innerHeight + box.height * 0.45, behavior: "instant" });
  });
  // The example is marked as such for tests too (data-try-sample); the visitor's own page is data-try-preview.
  const sample = playground.locator("[data-try-sample]");
  await expect(sample.getByRole("heading", { level: 1, includeHidden: true })).toHaveText("Lou Ferreira", { timeout: 15_000 });
  await expect(sample).toContainText("“Soleil” necklace");
  await expect(playground.getByText("Example page", { exact: true })).toBeVisible();
  await expect(playground.getByLabel("Your name")).toHaveValue("");
  await expect(playground.getByRole("radio", { name: "Mono", includeHidden: true })).toHaveAttribute("aria-checked", "true");
  if (testInfo.project.name === "desktop") {
    // The fields start right under the tabs (not centred far below them).
    const [tablist, field] = await Promise.all([playground.getByRole("tablist").boundingBox(), playground.getByLabel("Your name").boundingBox()]);
    if (!tablist || !field) throw new Error("No box for the tabs or the name field");
    expect(field.y - (tablist.y + tablist.height)).toBeLessThanOrEqual(48);
  }
  // The visitor's first touch: from now on the phone shows their own page.
  await playground.getByLabel("Your name").fill("Mila");
  await expect(playground.locator("[data-try-preview]").getByRole("heading", { level: 1, includeHidden: true })).toHaveText("Mila");
  await expect(sample).toHaveCount(0);
  await expect(playground.getByText("Example page", { exact: true })).toHaveCount(0);
});

test("W8: on phones the links on the page keep their whole titles in a row that scrolls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "A row of chips on phones; a list on wide screens.");
  await page.route("**/api/link-metadata?**", (route) => route.fulfill({ json: {} }));
  await page.goto("/en");
  const playground = page.locator("#try");
  await playground.getByRole("tab", { name: /Links/ }).click();
  for (const example of ["Shop", "YouTube", "TikTok"]) await playground.getByRole("button", { name: example, exact: true }).click();
  const list = playground.getByRole("list", { name: "On your page" });
  const chips = list.getByRole("listitem");
  await expect(chips).toHaveCount(3);
  const titles = list.locator("li > span > span:first-child");
  await expect(titles).toHaveCount(3);
  expect(await titles.evaluateAll((spans) => spans.map((span) => span.scrollWidth - span.clientWidth))).toEqual([0, 0, 0]);
  const card = await playground.getByRole("tablist").locator("xpath=../..").boundingBox();
  if (!card) throw new Error("The card has no box");
  // The newest chip is whole in view, inside the card's padding at the row's end...
  await expect
    .poll(async () => {
      const last = await chips.last().boundingBox();
      return last ? last.x + last.width : Infinity;
    })
    .toBeLessThanOrEqual(card.x + card.width - 16 + 0.5);
  // ...and back at the row's start (a swipe), the first one starts inside the card's padding, whole.
  await list.evaluate((element) => {
    element.scrollTo({ left: 0, behavior: "instant" });
  });
  const first = await chips.first().boundingBox();
  if (!first) throw new Error("The first chip has no box");
  expect(first.x).toBeGreaterThanOrEqual(card.x + 16 - 0.5);
  expect(first.x + first.width).toBeLessThanOrEqual(card.x + card.width);
});

test("W9: sign-up shows the page made in Try it, with the visitor's name", async ({ page }) => {
  await page.goto("/en");
  const playground = page.locator("#try");
  await playground.getByRole("tab", { name: "Profile" }).click();
  await playground.getByLabel("Your name").fill("Mila Aurel");
  await playground.getByRole("link", { name: "Keep this page" }).click();
  await page.waitForURL("**/en/signup?**");
  const draft = page.locator("figure").filter({ hasText: "Your page is coming along" });
  await expect(draft).toBeVisible({ timeout: 15_000 });
  await expect(draft).toContainText('What you built in "Try it" comes along.');
  await expect(draft.getByText("Mila Aurel").filter({ visible: true }).first()).toBeVisible();
  // A picture of the page, not a second page: nothing in it can be reached.
  expect(await draft.locator("a, button, input").evaluateAll((elements) => elements.every((element) => element.closest("[inert]") !== null))).toBe(true);
});

test("W9: without a page from Try it, sign-up shows no draft", async ({ page }) => {
  await page.goto("/en/signup");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Your page is coming along")).toHaveCount(0);
});

test("W11: in Arabic the demo's play, stop and replay icons are not mirrored", async ({ page }) => {
  await page.goto("/ar");
  const playground = page.locator("#try");
  const button = playground.locator("[data-demo-button]");
  // Taking over first, so the demo waits for its button (it would start by itself once in view).
  await playground.getByRole("tab").first().click();
  const mirrored =() => button.locator("svg").evaluate((icon) => ({ transform: getComputedStyle(icon).transform, scale: getComputedStyle(icon).scale }));
  const states = new Set<string>();
  for (let press = 0; press < 3; press += 1) {
    states.add(await button.innerText());
    expect(await mirrored()).toEqual({ transform: "none", scale: "none" });
    await button.click();
  }
  states.add(await button.innerText());
  expect(await mirrored()).toEqual({ transform: "none", scale: "none" });
  // Play, stop and replay were all seen.
  expect(states.size).toBe(3);
});

test("the AI tab is not shown in any language (no real recording yet)", async ({ page }) => {
  for (const [locale, name] of [
    ["de", "KI"],
    ["en", "AI"],
    ["ar", "ذكاء اصطناعي"],
  ] as const) {
    await page.goto(`/${locale}`);
    const playground = page.locator("#try");
    await expect(playground.getByRole("tab")).toHaveCount(3);
    await expect(playground.getByRole("tab", { name })).toHaveCount(0);
  }
});

realTest("@real real accounts: the analytics section's title says it is in the works", async ({ page }) => {
  realTest.skip(!realEnabled, "Needs a build with Supabase settings (E2E_SUPABASE=1).");
  await page.goto("/de");
  const title = page.locator("#analytics h3");
  await expect(title).toBeAttached();
  await expect(title.locator("xpath=following-sibling::*[1]")).toHaveText("In Arbeit");
});

test("demo build: the analytics section keeps its sample numbers, without the in-the-works badge", async ({ page }) => {
  test.skip(realEnabled, "Demo build only (no Supabase settings).");
  await page.goto("/de");
  await expect(page.locator("#analytics h3")).toBeAttached();
  await expect(page.locator("#analytics").getByText("In Arbeit", { exact: true })).toHaveCount(0);
});
