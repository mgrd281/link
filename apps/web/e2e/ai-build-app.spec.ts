import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";
import { createRealAccount, expect, grantPro, mockCalls, realEnabled, seedPage, service, signIn, test, uniqueName, type RealAccount } from "./real";

/**
 * Build with AI (/app/build), plan §1.4 and §3.2 WP4. The `@real` cases need a build with Supabase
 * settings, the local stack, the local mock Messages API (E2E_MOCKS=1) and AI_ENABLED=1; each test
 * has its own address (x-forwarded-for) and mock tag. The demo case runs in the regular suite.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;

/** In this order, so the mock's L1…L5 are these links (the de-music and ar-coach fixtures refer to them). */
const LINKS = ["https://instagram.com/lio.vance", "https://soundcloud.com/lio-vance", "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "https://www.eventim.de/artist/lio-vance/", "https://lio-vance.de/booking"];

/** "page-" and six letters or digits: the neutral address a page gets before its owner picks one. */
const provisionalName = () => `page-${Math.random().toString(36).slice(2, 8).padEnd(6, "0")}`;

async function account(prefix: string, { locale = "de", onboarded = true, provisional = false }: { locale?: Locale; onboarded?: boolean; provisional?: boolean } = {}): Promise<RealAccount> {
  const unique = uniqueName(prefix);
  const username = provisional ? provisionalName() : unique.username;
  return createRealAccount({ email: unique.email, username, locale, onboarded, page: seedPage(username, locale) });
}

/** Opens the build screen signed in as this account and waits for its form. */
async function openBuild(page: Page, who: RealAccount, locale: Locale = "de", query = "") {
  await signIn(page, who.email, `/${locale}/app/build${query}`);
  await page.waitForURL(`**/${locale}/app/build**`);
  await expect(page.getByRole("button", { name: MESSAGES[locale].app.ai.start })).toBeVisible({ timeout: 20_000 });
}

/** Pastes the five links and writes the sentence with the mock's fixture marker. */
async function fill(page: Page, { fixture, tag, locale = "de", sentence = "Ich bin Lio Vance, DJ und Producer aus Berlin." }: { fixture: string; tag: string; locale?: Locale; sentence?: string }) {
  const m = MESSAGES[locale].app.ai.input;
  const paste = page.getByRole("textbox", { name: m.paste.label });
  if (!(await paste.isVisible())) await page.getByRole("button", { name: m.paste.label }).click();
  await paste.fill(LINKS.join("\n"));
  await page.getByRole("textbox", { name: m.about.label }).fill(`${sentence} [[fixture:${fixture}#${tag}]]`);
}

const buildButton = (page: Page, locale: Locale = "de") => page.getByRole("button", { name: MESSAGES[locale].app.ai.start });
const reviewHeading = (page: Page, locale: Locale = "de") => page.getByRole("heading", { name: MESSAGES[locale].app.ai.review.title });

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
}

/** The first day of this month in Berlin, as `ai_usage.month` stores it. */
function berlinMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-01`;
}

async function runs(profileId: string) {
  const { data } = await service().from("ai_runs").select("status, counted").eq("profile_id", profileId);
  return data ?? [];
}

test.describe("build with AI @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack, the mocks and AI_ENABLED=1 (E2E_SUPABASE=1).");
  test.describe.configure({ timeout: 120_000 });

  test("welcome path: step 0, a draft, the 'you' step, then the page goes public under the new address @real", async ({ page, tag }) => {
    const who = await account("ai-welcome", { onboarded: false, provisional: true });
    await signIn(page, who.email, "/de/app/welcome");
    await page.waitForURL("**/de/app/welcome");
    await expect(page.getByRole("heading", { name: de.app.welcome.start.title })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(de.app.welcome.start.ai.free)).toBeVisible();
    // AI first and chosen: Continue opens the build screen.
    await page.getByRole("button", { name: de.app.welcome.start.continue }).click();
    await page.waitForURL("**/de/app/build?from=welcome");
    await expect(page.getByText(de.app.ai.quota.free)).toBeVisible();

    await fill(page, { fixture: "de-music", tag });
    await buildButton(page).click();
    // While it runs, the timeline names the look; then the review.
    await expect(page.getByText("Nocturne ·").first()).toBeVisible({ timeout: 30_000 });
    await expect(reviewHeading(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: de.app.ai.review.notes })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(4);
    // The phone wears the AI's look (Nocturne), the AI's choice among the other looks.
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);
    await expect(page.locator("label", { has: page.getByRole("radio", { checked: true }) })).toContainText("Nocturne");
    await expect(page.locator("[data-draft-phone]")).toContainText("Lio Vance");
    expect(await mockCalls(tag)).toBe(1);

    await page.getByRole("button", { name: de.app.ai.actions.apply }).click();
    await page.waitForURL("**/de/app/welcome?from=ai");
    await expect(page.getByText(de.app.welcome.fromAi.lead)).toBeVisible();
    await expect(page.getByRole("textbox", { name: de.app.welcome.kinds.music.name })).toHaveValue("Lio Vance");
    const address = page.locator("#welcome-address");
    await expect(address).toHaveValue("lio-vance");
    // Not public yet: still the neutral address, not onboarded.
    expect((await service().rpc("public_page", { handle: who.username })).data).toBeNull();
    const before = await service().from("sites").select("onboarded").eq("profile_id", who.id).single();
    expect(before.data?.onboarded).toBe(false);

    // "lio-vance" may be taken by an earlier run: a name of its own for this test.
    const chosen = `lio-${tag.slice(0, 8)}`;
    await address.fill(chosen);
    await expect(page.getByText(chosen).first()).toBeVisible();
    await page.getByRole("button", { name: de.app.welcome.fromAi.finish }).click();
    await page.waitForURL(/\/de\/app$/);
    await expect(page.locator("li", { hasText: de.app.ai.applied }).getByRole("button", { name: de.app.undo })).toBeVisible();

    await expect
      .poll(async () => (await service().from("profiles").select("username").eq("id", who.id).single()).data?.username, { timeout: 15_000 })
      .toBe(chosen);
    await expect.poll(async () => (await service().rpc("public_page", { handle: chosen })).data !== null, { timeout: 15_000 }).toBe(true);
    const site = await service().from("sites").select("page, onboarded").eq("profile_id", who.id).single();
    const saved = site.data?.page as { blocks: { origin?: string }[]; profile: { aiFields?: string[] } } | undefined;
    expect(site.data?.onboarded).toBe(true);
    expect(saved?.blocks.map((block) => block.origin)).toEqual(["ai", "ai", "ai", "ai"]);
    expect(saved?.profile.aiFields).toEqual(expect.arrayContaining(["tagline", "bio"]));
    expect(await runs(who.id)).toEqual([{ status: "succeeded", counted: true }]);

    // The free draft is used: a second one needs Pro (the sheet opens; nothing runs).
    await page.goto("/de/app/build");
    await expect(page.getByText(de.app.ai.quota.used)).toBeVisible({ timeout: 20_000 });
    await buildButton(page).click();
    await expect(page.getByRole("dialog", { name: de.app.ai.pro.title })).toBeVisible();
    expect(await mockCalls(tag)).toBe(1);
  });

  test("a whole run says at most 14 things to screen readers, and nothing before it starts @real", async ({ page, tag }) => {
    const who = await account("ai-announce");
    await openBuild(page, who);
    await fill(page, { fixture: "de-music", tag });
    await page.evaluate(() => {
      const root = document.querySelector("[data-build-screen]");
      const live = "[role=log], [role=status], [role=alert], [aria-live]";
      const counts = { additions: 0 };
      (window as unknown as { __live: typeof counts }).__live = counts;
      new MutationObserver((records) => {
        for (const record of records) {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          if (record.type === "characterData") {
            if (target?.closest(live)) counts.additions += 1;
            continue;
          }
          for (const node of record.addedNodes) {
            const element = node instanceof Element ? node : node.parentElement;
            const inside = Boolean(target?.closest(live)) || Boolean(element?.matches(live) && element.textContent.trim());
            if (inside && (node.textContent ?? "").trim()) counts.additions += 1;
          }
        }
      }).observe(root ?? document.body, { childList: true, subtree: true, characterData: true });
    });
    const count = () => page.evaluate(() => (window as unknown as { __live: { additions: number } }).__live.additions);
    await page.waitForTimeout(500);
    expect(await count()).toBe(0);
    await buildButton(page).click();
    await expect(reviewHeading(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[role=status]", { hasText: "Entwurf fertig" })).toHaveCount(1);
    const said = await count();
    expect(said).toBeGreaterThan(0);
    expect(said).toBeLessThanOrEqual(14);
  });

  test("Stop keeps focus on the button; a stop before any block is not counted @real", async ({ page, tag }) => {
    const who = await account("ai-stop");
    await openBuild(page, who);
    await fill(page, { fixture: "slow", tag });
    await buildButton(page).focus();
    await page.keyboard.press("Enter");
    const stop = page.getByRole("button", { name: de.ai.run.stop });
    await expect(stop).toBeFocused({ timeout: 10_000 });
    await expect(page.getByText(de.ai.run.stopCounts)).toBeVisible();
    // Stop once the run has its id (the strip shows a step).
    await expect(page.locator("[data-status-strip]")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("[role=status]", { hasText: "Noch keine Blöcke." })).toHaveCount(1, { timeout: 20_000 });
    // The same button, now "Try again", still has focus.
    await expect(page.getByRole("button", { name: de.app.ai.actions.retry })).toBeFocused();
    await expect(page.getByText(de.ai.run.notCounted)).toBeVisible();
    await expect.poll(async () => runs(who.id), { timeout: 10_000 }).toEqual([{ status: "stopped", counted: false }]);
    // Back to the form: the free draft is still there.
    await page.keyboard.press("Enter");
    await expect(page.getByText(de.app.ai.quota.free)).toBeVisible({ timeout: 10_000 });
  });

  test("reduced motion: the running step says so in words, and nothing moves once the draft is ready @real", async ({ page, tag }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const who = await account("ai-motion");
    await openBuild(page, who);
    await fill(page, { fixture: "de-music", tag });
    await buildButton(page).click();
    await expect(page.getByText(de.ai.run.state.running, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(reviewHeading(page)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(400);
    const moving = await page.evaluate(() => {
      const screen = document.querySelector("[data-build-screen]");
      return (
        document
          .getAnimations()
          // Running on the clock: the creator page's scroll-linked effects (its header bar, the hero
          // fading as it scrolls away) follow the scroll position only, and never move on their own.
          .filter((animation) => animation.playState === "running" && animation.timeline instanceof DocumentTimeline)
          .map((animation) => (animation.effect as KeyframeEffect | null)?.target ?? null)
          .filter((target): target is Element => target instanceof Element && Boolean(screen?.contains(target)))
          .map((target) => `${target.tagName.toLowerCase()}.${target.getAttribute("class") ?? ""}`)
      );
    });
    expect(moving).toEqual([]);
  });

  test("Arabic: the progress fills from the right, check marks and the spinner are not mirrored, addresses run left to right @real", async ({ page, tag }) => {
    const who = await account("ai-ar", { locale: "ar" });
    await openBuild(page, who, "ar");
    // A source (Instagram: linked, never read) shows as a chip, left to right.
    await page.getByRole("textbox", { name: ar.app.ai.input.sources.label }).fill(LINKS[0] ?? "");
    await page.getByRole("button", { name: ar.app.ai.input.sources.add }).click();
    await expect(page.locator("[data-source-chip] bdi[dir=ltr]")).toHaveCount(1);
    await fill(page, { fixture: "ar-coach", tag, locale: "ar", sentence: "أنا مدربة حياة." });
    await buildButton(page, "ar").click();
    const track = page.locator("[data-progress-track]");
    await expect(track.locator("[data-segment='0'][data-filled]")).toHaveCount(1, { timeout: 20_000 });
    const [trackBox, firstBox] = await Promise.all([track.boundingBox(), track.locator("[data-segment='0']").boundingBox()]);
    expect(Math.abs((trackBox?.x ?? 0) + (trackBox?.width ?? 0) - ((firstBox?.x ?? 0) + (firstBox?.width ?? 0)))).toBeLessThanOrEqual(1);
    // The spinner turns (its animation), but is never flipped (no scale).
    const spinner = page.locator("[data-status-strip] svg.animate-spin, [data-step] svg.animate-spin").first();
    if ((await spinner.count()) > 0) expect(await spinner.evaluate((element) => getComputedStyle(element).scale)).toBe("none");
    await expect(reviewHeading(page, "ar")).toBeVisible({ timeout: 30_000 });
    const check = page.locator("svg.lucide-check").first();
    await expect(check).toBeVisible();
    expect(await check.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
    expect(await check.evaluate((element) => getComputedStyle(element).scale)).toBe("none");
    // What was read: the Instagram link, left to right.
    const read = page.locator("section", { has: page.getByRole("heading", { name: ar.app.ai.review.read }) }).locator("bdi");
    await expect(read).toHaveCount(1);
    await expect(read).toHaveAttribute("dir", "ltr");
  });

  test("a refusal is one alert, says it does not count, and counts nothing @real", async ({ page, tag }) => {
    const who = await account("ai-refusal");
    await openBuild(page, who);
    await fill(page, { fixture: "refusal", tag });
    await buildButton(page).click();
    const alert = page.getByRole("alert").filter({ hasText: de.app.ai.errors.refused });
    await expect(alert).toHaveCount(1, { timeout: 20_000 });
    await expect(alert).toContainText(de.ai.run.notCounted);
    // One alert on the screen (Next's route announcer outside it is not ours).
    await expect(page.locator("[data-build-screen]").getByRole("alert")).toHaveCount(1);
    await expect.poll(async () => runs(who.id), { timeout: 10_000 }).toEqual([{ status: "refused", counted: false }]);
    expect(await mockCalls(tag)).toBe(1);
    await page.getByRole("button", { name: de.app.ai.actions.retry }).click();
    await expect(page.getByText(de.app.ai.quota.free)).toBeVisible({ timeout: 10_000 });
  });

  test("Pro with every draft of the month used: the date they come back, a disabled button and nothing to buy @real", async ({ page }) => {
    const who = await account("ai-prozero");
    await grantPro(who.id);
    const { error } = await service().from("ai_usage").upsert({ profile_id: who.id, month: berlinMonth(), counted: 5 });
    expect(error).toBeNull();
    await signIn(page, who.email, "/de/app/build");
    await page.waitForURL("**/de/app/build");
    const line = page.locator("[data-quota-line]");
    await expect(line).toContainText("Keine KI-Entwürfe mehr diesen Monat", { timeout: 20_000 });
    await expect(line).toContainText("Neue Entwürfe ab");
    const button = buildButton(page);
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-describedby", (await line.getAttribute("id")) ?? "missing");
    await expect(page.getByText(de.app.ai.pro.get)).toHaveCount(0);
    await expect(page.getByText(de.app.ai.pro.soon)).toHaveCount(0);
  });

  test("an answer that fails the checks gets exactly one repair call @real", async ({ page, tag }) => {
    const who = await account("ai-repair");
    await grantPro(who.id);
    await openBuild(page, who);
    await fill(page, { fixture: "invalid-then-repair", tag });
    await buildButton(page).click();
    await expect(reviewHeading(page)).toBeVisible({ timeout: 30_000 });
    expect(await mockCalls(tag)).toBe(2);
  });

  for (const locale of ["de", "en", "ar"] as const) {
    test(`axe: no violations while typing, running and reviewing, light and dark (${locale}) @real`, async ({ page, tag }) => {
      const who = await account(`ai-axe-${locale}`, { locale });
      await grantPro(who.id);
      const m = MESSAGES[locale];
      const scan = async (state: string) => {
        for (const scheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          // Buttons ease into the new scheme's colours: measure once they got there.
          await page.waitForTimeout(500);
          expect(await axe(page), `${state} ${scheme}`).toEqual([]);
        }
      };
      await openBuild(page, who, locale);
      // One real run covers both later states: the slow answer plans for 20 s (running), then the draft.
      await fill(page, { fixture: "slow", tag, locale });
      await scan("input");
      await buildButton(page, locale).click();
      await expect(page.getByRole("button", { name: m.ai.run.stop })).toBeVisible();
      await expect(page.locator("[data-step='plan'][data-state='running']").or(page.locator("[data-status-strip]")).first()).toBeAttached({ timeout: 15_000 });
      // Build turned into Stop: let its colour change finish before measuring contrast.
      await page.waitForTimeout(800);
      await scan("running");
      await expect(reviewHeading(page, locale)).toBeVisible({ timeout: 60_000 });
      await scan("review");
    });
  }
});

test.describe("build with AI in the demo", () => {
  test.skip(realEnabled, "Demo build only.");

  test("no AI anywhere: the routes answer 404, the build screen says why, Home and the editor offer nothing", async ({ page }) => {
    expect((await page.request.post("/api/ai/runs", { data: {} })).status()).toBe(404);
    expect((await page.request.get("/api/ai/quota")).status()).toBe(404);

    const name = `mila-${Date.now().toString(36)}`;
    await page.goto(`/de/signup?name=${name}`);
    await page.waitForLoadState("networkidle");
    await page.locator("#signup-email").fill(`${name}@example.com`);
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL("**/de/app/welcome");
    // No step 0 without the AI: the welcome starts with what the page is for.
    await expect(page.getByRole("heading", { name: de.app.welcome.steps.kind.title })).toBeVisible();
    await expect(page.getByText(de.app.welcome.start.title)).toHaveCount(0);
    await page.getByRole("button", { name: de.app.welcome.skip }).click();
    await page.waitForURL("**/de/app");
    await expect(page.getByText(de.app.home.ai.title)).toHaveCount(0);
    await page.goto("/de/app/editor");
    await expect(page.getByRole("heading", { name: de.app.editor.title }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: de.app.editor.withAi })).toHaveCount(0);

    await page.goto("/de/app/build");
    await expect(page.getByText(de.app.ai.unavailable)).toBeVisible();
    await expect(page.getByRole("link", { name: de.app.ai.continueWithout })).toBeVisible();
    await expect(page.getByRole("button", { name: de.app.ai.start })).toHaveCount(0);
  });
});
