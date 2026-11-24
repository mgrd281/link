import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

/**
 * Creator pages talk to nobody but Linkyo until the visitor agrees (audit C-01, C-02; CLAUDE.md
 * "Privacy"): no request to another origin before consent, no cookie, and a platform picture (a
 * YouTube channel avatar) comes through our own image optimizer. Checked on /de/p/nizar, on every
 * page the people index lists (each example, concept and prepared preview, in the language it
 * opens in), and on a real page under /u with the Supabase stand-in (E2E_STUB=1, its own build).
 * The newsletter form on examples says it is an example and sends nothing.
 */

/** Every request of a page load that left our origin (http and https only; data: and blob: stay in the browser). */
function foreignRequests(page: Page, origin: string): string[] {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin) foreign.push(url);
  });
  return foreign;
}

/** Loads a page, then scrolls to its end so lazy pictures load too, and waits until the network rests. */
async function visit(page: Page, path: string): Promise<number> {
  const response = await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  });
  await page.waitForLoadState("networkidle");
  return response?.status() ?? 0;
}

test("nizar: nothing from Google or any other host before consent; his avatar comes through our optimizer", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL ?? "http://localhost:3100").origin;
  const foreign = foreignRequests(page, origin);
  for (const locale of ["de", "ar"] as const) {
    expect(await visit(page, `/${locale}/p/nizar`)).toBe(200);
    // The privacy notice is still there: nothing was agreed to.
    await expect(page.getByRole("region", { name: locale === "de" ? "Datenschutz" : "الخصوصية" })).toBeVisible();
    const avatar = page.locator('img[src*="yt3.googleusercontent.com"]').first();
    await expect(avatar).toHaveAttribute("src", /^\/_next\/image\?url=https%3A%2F%2Fyt3\.googleusercontent\.com/);
    await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.complete)).toBe(true);
  }
  expect(foreign).toEqual([]);
  expect(await page.content()).not.toMatch(/src="https:\/\/yt3\.googleusercontent\.com/);
  expect(await context.cookies()).toEqual([]);
});

test.describe("every listed page under /p", () => {
  // In slices, so the workers share the list.
  const SLICES = 4;
  for (let slice = 0; slice < SLICES; slice += 1) {
    test(`no request leaves our origin before consent, no cookie (slice ${String(slice + 1)} of ${String(SLICES)})`, async ({ page, context, baseURL }) => {
      test.setTimeout(300_000);
      const origin = new URL(baseURL ?? "http://localhost:3100").origin;
      const index = (await (await page.request.get("/api/people/de")).json()) as { people: { href: string }[] };
      const paths = [...new Set(index.people.map((person) => person.href))].sort();
      expect(paths.length).toBeGreaterThan(50);
      const mine = paths.filter((_, at) => at % SLICES === slice);
      const found: Record<string, string[]> = {};
      for (const path of mine) {
        const foreign = foreignRequests(page, origin);
        expect(await visit(page, path), path).toBe(200);
        if (foreign.length > 0) found[path] = [...new Set(foreign)];
        page.removeAllListeners("request");
      }
      expect(found).toEqual({});
      expect(await context.cookies()).toEqual([]);
    });
  }
});

test("the newsletter on an example says it is one, and sends nothing", async ({ page }) => {
  await page.goto("/de/p/journalist");
  await page.waitForLoadState("networkidle");
  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") sent.push(`${request.method()} ${request.url()}`);
  });
  const form = page.locator("form").filter({ has: page.locator('input[type="email"]') }).first();
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[type="email"]').fill("leserin@example.com");
  await form.locator('button[type="submit"]').click();
  const status = page.locator("[data-newsletter-example]");
  await expect(status).toHaveAttribute("role", "status");
  await expect(status).toContainText("Nur ein Beispiel");
  await expect(status).toContainText("nichts gesendet");
  await expect(page.getByText(/E-Mail geschickt|Fast geschafft/)).toHaveCount(0);
  expect(sent).toEqual([]);
});

// ─── Real pages (/u) with the Supabase stand-in ───────────────────────────────────────────────
// Opt-in like e2e/stub-app.spec.ts (its own build: see the command there).

const stubEnabled = process.env.E2E_STUB === "1";
const STUB = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;

test.describe("a real portfolio under /u (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  test("its portfolio and project pages load nothing from another origin, even with foreign picture addresses", async ({ page, context, baseURL }) => {
    const id = randomUUID();
    const username = `pf-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const storage = (name: string) => `${STUB}/storage/v1/object/public/media/u/2026/${name}`;
    const picture = (name: string, alt: string) => ({ image: { src: storage(name), alt, w: 1200, h: 800 } });
    const page_ = {
      profile: { username, displayName: "Mira Feld", bio: "", avatar: { src: "https://tracker.example/avatar.jpg", alt: "Mira Feld" }, verified: false, locale: "de" },
      blocks: [
        {
          id: "p1",
          type: "project",
          slug: "hafenstudie",
          title: "Hafenstudie",
          summary: "Eine Serie am Hafen.",
          visible: true,
          highlight: false,
          cover: { src: "https://tracker.example/cover.jpg", alt: "Kran" },
          pictures: [picture("one.png", "Kran im Nebel"), picture("two.png", "Kai bei Nacht"), { image: { src: "http://tracker.example/three.jpg", alt: "Fremd" } }],
        },
      ],
    };
    const response = await fetch(`${STUB}/__stub/seed`, {
      method: "POST",
      body: JSON.stringify({
        users: { [id]: { id, email: `${username}@example.com` } },
        profiles: { [id]: { id, username, locale: "de", status: "active", created_at: "2026-11-01T00:00:00Z" } },
        sites: { [id]: { profile_id: id, kind: null, onboarded: true, prepared: null, page: page_, theme: { template: "werkbogen" }, legal: { name: "", address: "", email: "", phone: "" }, updated_at: "2026-11-20T10:00:00Z" } },
      }),
    });
    expect(response.ok).toBe(true);
    const origin = new URL(baseURL ?? "").origin;
    const foreign = foreignRequests(page, origin);
    expect(await visit(page, `/${username}`)).toBe(200);
    expect(await visit(page, `/${username}/hafenstudie`)).toBe(200);
    expect(foreign).toEqual([]);
    expect(await page.content()).not.toContain("tracker.example");
    expect(await context.cookies()).toEqual([]);
  });
});
