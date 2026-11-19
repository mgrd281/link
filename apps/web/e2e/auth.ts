import { expect, type Page } from "@playwright/test";

/**
 * Demo mode sends no email: the code step shows the code on screen. This reads it and enters it,
 * as someone would from the email (the field submits by itself at six digits).
 */
export async function enterDemoCode(page: Page): Promise<string> {
  const shown = page.locator("[id$='-demo'] strong");
  await expect(shown).toHaveText(/^\d{6}$/);
  const code = (await shown.textContent()) ?? "";
  await page.locator('input[autocomplete="one-time-code"]').fill(code);
  return code;
}
