import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The AI tab of "Try it" on the design page (plan §1.5.2): the run view replays test data, labelled
 * as such at every step, silent for screen readers, with a button to play it again; reduced motion
 * shows the finished run; Arabic fills the progress from the right; axe finds nothing.
 */

const LOCALES = ["de", "en", "ar"] as const;
const CHIP = { de: "Testdaten · keine echte Aufzeichnung", en: "Test data · not a real recording", ar: "بيانات اختبار · ليست تسجيلًا حقيقيًا" } as const;
const PLAY = { de: "Abspielen", en: "Play", ar: "تشغيل" } as const;
const REPLAY = { de: "Nochmal abspielen", en: "Play again", ar: "إعادة التشغيل" } as const;
/** The test data's planning waits (de 36.1 s, ar 29.6 s; English plays the German run), as the run view rounds them. */
const SHORTENED = { de: "Wartezeit gekürzt (echt: 36 s)", en: "Wait shortened (actual: 36 s)", ar: "اختصرنا الانتظار (المدة الفعلية: 30 ث)" } as const;

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

async function openSpecimen(page: Page, locale: (typeof LOCALES)[number]) {
  await page.goto(`/${locale}/design#ai-run`);
  const section = page.locator("#ai-run");
  await section.locator("[data-ai-replay]").scrollIntoViewIfNeeded();
  return section;
}

for (const locale of LOCALES) {
  test(`AI run specimen (${locale}): test data, labelled at every step, plays silently and plays again`, async ({ page }) => {
    await page.addInitScript(countLiveMutations, "#ai-run");
    const section = await openSpecimen(page, locale);
    const stage = section.locator("[data-ai-replay]");
    const chip = section.locator("[data-run-source]");
    const progress = section.getByRole("progressbar");
    // It plays by itself once in view.
    await expect(stage).toHaveAttribute("data-ai-replay", "playing", { timeout: 10_000 });
    const steps = new Set<string>();
    while ((await stage.getAttribute("data-ai-replay")) === "playing") {
      await expect(chip).toBeVisible();
      await expect(chip).toHaveAttribute("data-run-source", "fixture");
      await expect(chip).toHaveText(CHIP[locale]);
      steps.add((await progress.getAttribute("aria-valuenow")) ?? "");
      await page.waitForTimeout(200);
    }
    await expect(stage).toHaveAttribute("data-ai-replay", "done");
    await expect(chip).toHaveText(CHIP[locale]);
    await expect(section.locator("[data-ai-run]")).toHaveAttribute("data-phase", "review");
    await expect(progress).toHaveAttribute("aria-valuenow", "7");
    // The chip was there while the run went through its steps (several values of the progress bar).
    expect(steps.size).toBeGreaterThanOrEqual(3);
    // The real planning wait was cut, and the run view says so with the real figure.
    await expect(section.locator("[data-ai-run]")).toContainText(SHORTENED[locale]);
    // Nothing was said to screen readers, and the replay has no live region at all.
    expect(await page.evaluate(() => (window as unknown as { __liveMutations: number }).__liveMutations)).toBe(0);
    expect(
      await section.locator('[aria-live], [role="status"], [role="log"], [role="alert"]').evaluateAll((regions) => regions.filter((region) => !region.closest('[aria-hidden="true"], [inert]')).length),
    ).toBe(0);
    // One button plays it again; the same button stops it.
    await section.getByRole("button", { name: REPLAY[locale], exact: true }).click();
    await expect(stage).toHaveAttribute("data-ai-replay", "playing");
    await expect(section.locator("[data-ai-run]")).toHaveAttribute("data-phase", "running");
    await stage.getByRole("button").first().click();
    await expect(stage).toHaveAttribute("data-ai-replay", "done");
    await expect(section.locator("[data-ai-run]")).toHaveAttribute("data-phase", "review");
  });

  test(`AI run specimen (${locale}): with reduced motion, the finished run and a Play button`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const section = await openSpecimen(page, locale);
    await page.waitForTimeout(1500);
    const stage = section.locator("[data-ai-replay]");
    await expect(stage).toHaveAttribute("data-ai-replay", "ready");
    await expect(section.locator("[data-ai-run]")).toHaveAttribute("data-phase", "review");
    await expect(section.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "7");
    await expect(section.getByRole("button", { name: PLAY[locale], exact: true })).toBeVisible();
    await expect(section.locator("[data-run-source]")).toHaveText(CHIP[locale]);
    // Nothing in the run view moves (the creator's page in the phone keeps its own still, scroll-linked effects).
    const running = await section.evaluate(
      (root) =>
        document.getAnimations().filter((animation) => {
          const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
          return animation.playState === "running" && target instanceof Element && root.contains(target) && !target.closest("[data-draft-phone]");
        }).length,
    );
    expect(running).toBe(0);
  });
}

test("AI run specimen (ar): the progress fills from the right", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const section = await openSpecimen(page, "ar");
  const track = section.locator("[data-progress-track]");
  const [bar, first, last] = await Promise.all([track.boundingBox(), track.locator('[data-segment="0"]').boundingBox(), track.locator('[data-segment="6"]').boundingBox()]);
  if (!bar || !first || !last) throw new Error("The progress bar has no box");
  expect(Math.abs(first.x + first.width - (bar.x + bar.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(last.x - bar.x)).toBeLessThanOrEqual(1);
});

for (const locale of LOCALES) {
  for (const scheme of ["light", "dark"] as const) {
    test(`axe: the AI run specimen (${locale}, ${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await openSpecimen(page, locale);
      const results = await new AxeBuilder({ page }).include("#ai-run").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
      expect(summary).toEqual([]);
    });
  }
}
