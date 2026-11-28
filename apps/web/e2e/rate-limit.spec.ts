import { randomInt } from "node:crypto";

import { expect, test, type APIResponse } from "@playwright/test";

import en from "../src/messages/en.json" with { type: "json" };
import { enterDemoCode } from "./auth";

/**
 * The in-route limits on the running server (lib/rate-limit.ts, ADR 0090-csp-and-limits): after its
 * share, an address gets 429 with `Retry-After` and `no-store`, while another address is still served.
 * Each test sends its own client address (`x-forwarded-for`, as Vercel sets it), from the documentation
 * range, so no other spec's requests count (they come from the machine itself, which is never counted).
 * Nothing leaves the machine: every request is one the route refuses or answers without fetching.
 *
 * The two auth routes need real accounts (a demo build answers 404 before any limit): they run with
 * the stub build (E2E_STUB=1, see e2e/stub-app.spec.ts), where the Supabase stand-in answers.
 */

const STUB = process.env.E2E_STUB === "1";

/** A client address no other test uses in this run. */
const address = () => `203.0.113.${String(randomInt(1, 255))}, 10.0.0.${String(randomInt(1, 255))}`;

function expectRefused(response: APIResponse, window: number): void {
  expect(response.status()).toBe(429);
  const retry = Number(response.headers()["retry-after"]);
  expect(retry).toBeGreaterThan(0);
  expect(retry).toBeLessThanOrEqual(window);
  expect(response.headers()["cache-control"]).toBe("no-store");
}

/** Sends `max` requests from one address (none refused), then one more (refused), then one from another address. */
async function limitHolds(max: number, window: number, send: (from: string, n: number) => Promise<APIResponse>): Promise<void> {
  const from = address();
  for (let n = 0; n < max; n++) expect((await send(from, n)).status(), `request ${String(n + 1)}`).not.toBe(429);
  expectRefused(await send(from, max), window);
  expect((await send(`198.51.100.${String(randomInt(1, 255))}`, max + 1)).status()).not.toBe(429);
}

test.describe("rate limits", () => {
  test("/api/import-links: 10 per address in 10 minutes", async ({ request }) => {
    // An address the importer does not read: answered at once, no page fetched.
    await limitHolds(10, 600, (from) => request.post("/api/import-links", { headers: { "x-forwarded-for": from }, data: { url: "not an address" } }));
  });

  test("/api/link-metadata: 60 per address a minute", async ({ request }) => {
    // A host the route never asks (422 without a request).
    await limitHolds(60, 60, (from) => request.get("/api/link-metadata?url=https%3A%2F%2Fintranet.local%2Fx", { headers: { "x-forwarded-for": from } }));
  });

  test("/api/admin/verify: 5 tries per address in 10 minutes", async ({ request }) => {
    const answers: number[] = [];
    await limitHolds(5, 600, async (from) => {
      const response = await request.post("/api/admin/verify", { headers: { "x-forwarded-for": from }, data: { code: "not-the-team-code" } });
      answers.push(response.status());
      return response;
    });
    expect(answers.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
  });

  test("/api/csp-report: 60 reports per address a minute", async ({ request }) => {
    const report = { "csp-report": { "document-uri": "http://localhost/de", "blocked-uri": "inline", "effective-directive": "style-src-attr" } };
    await limitHolds(60, 60, (from) => request.post("/api/csp-report", { headers: { "x-forwarded-for": from, "content-type": "application/csp-report" }, data: JSON.stringify(report) }));
  });

  test("the team gate says \"too many attempts\" past the limit, not \"wrong code\", also for the right code", async ({ page }) => {
    test.skip(STUB, "The demo's team code works only in a demo build.");
    const name = `rl-${Date.now().toString(36)}`;
    await page.goto(`/en/signup?name=${name}`);
    await page.waitForLoadState("networkidle");
    await page.locator("#signup-email").fill(`${name}@example.com`);
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL("**/en/app/welcome");
    // The browser's requests come from this machine, which is never counted: give them a client address.
    const from = address();
    await page.route("**/api/admin/verify", (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": from } }));
    await page.goto("/en/admin");
    await page.locator("#team-name").fill("Mara");
    const code = page.locator("#team-code");
    for (let n = 0; n < 5; n++) {
      await code.fill("not-the-code");
      await page.locator("form button[type=submit]").click();
      await expect(page.getByText(en.admin.gate.codeWrong)).toBeVisible();
    }
    await code.fill("linkyo-team-4827");
    await page.locator("form button[type=submit]").click();
    await expect(page.getByText(en.auth.errors.tooManyAttempts)).toBeVisible();
    await expect(page.getByText(en.admin.gate.codeWrong)).toHaveCount(0);
  });

  test("the machine itself (local development, the other specs) is never counted", async ({ request }) => {
    for (let n = 0; n < 7; n++) expect((await request.post("/api/admin/verify", { data: {} })).status()).toBe(400);
  });

  test.describe("auth (real accounts, stub build)", () => {
    test.skip(!STUB, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

    test("/api/auth/code: 30 codes per address and 10 per e-mail address in 15 minutes", async ({ request }) => {
      const stamp = Date.now().toString(36);
      await limitHolds(30, 900, (from, n) =>
        request.post("/api/auth/code", { headers: { "x-forwarded-for": from }, data: { email: `limit-${stamp}-${String(n)}@example.com`, locale: "de" } }),
      );
      const refused = { ok: false, error: "tooManyAttempts" };
      let last: APIResponse | null = null;
      for (let n = 0; n < 11; n++) last = await request.post("/api/auth/code", { headers: { "x-forwarded-for": address() }, data: { email: `one-${stamp}@example.com`, locale: "de" } });
      expectRefused(last!, 900);
      expect(await last!.json()).toEqual(refused);
    });

    test("/api/auth/verify: 40 tries per address in 15 minutes", async ({ request }) => {
      const stamp = Date.now().toString(36);
      await limitHolds(40, 900, (from, n) =>
        request.post("/api/auth/verify", { headers: { "x-forwarded-for": from }, data: { email: `verify-${stamp}-${String(n)}@example.com`, code: "000000" } }),
      );
    });

    test("/api/auth/password: 40 tries per address and 10 per e-mail address in 15 minutes", async ({ request }) => {
      const stamp = Date.now().toString(36);
      await limitHolds(40, 900, (from, n) =>
        request.post("/api/auth/password", { headers: { "x-forwarded-for": from }, data: { email: `pw-${stamp}-${String(n)}@example.com`, password: "not-it" } }),
      );
      let last: APIResponse | null = null;
      for (let n = 0; n < 11; n++) last = await request.post("/api/auth/password", { headers: { "x-forwarded-for": address() }, data: { email: `pw-one-${stamp}@example.com`, password: "not-it" } });
      expectRefused(last!, 900);
    });
  });
});
