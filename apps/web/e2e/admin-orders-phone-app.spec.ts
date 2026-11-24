import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };

/**
 * The page-service screens of the team console on a phone (Stage 3, WP3.4, critique 30): the orders
 * queue, the withdrawals and cancellations, one order and its proposal editor, at 390 px in de and ar,
 * plus what the overview and the navigation say waits. These screens render only with payments and
 * real accounts, so this runs on the stub build of stub-app.spec.ts (E2E_STUB=1, NEXT_PUBLIC_PAYMENTS=test);
 * the team functions the browser calls are answered here. `ADMIN_ORDERS_SHOTS=<dir>` saves the pictures.
 */

const stubEnabled = process.env.E2E_STUB === "1";
const STUB = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;
const SHOTS = process.env.ADMIN_ORDERS_SHOTS ?? "";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PHONE = { width: 390, height: 844 };

type Locale = "de" | "ar";

const OWNER = [
  "pages.create",
  "pages.edit",
  "pages.publish",
  "pages.delete",
  "creators.verify",
  "invites.manage",
  "team.manage",
  "activity.view",
  "customers.view",
  "customers.export",
  "customers.manage",
  "customers.delete",
  "orders.view",
  "billing.view",
  "billing.manage",
  "security.view",
  "security.manage",
  "analytics.view",
];

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const tokenFor = (id: string) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", exp: 4_070_908_800 })}.stub`;

interface Member {
  id: string;
  email: string;
  token: string;
}

async function seed(data: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${STUB}/__stub/seed`, { method: "POST", body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`stub seed failed: ${String(response.status)}`);
}

async function member(locale: Locale): Promise<Member> {
  const id = randomUUID();
  const username = `team-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const email = `${username}@example.com`;
  await seed({
    users: { [id]: { id, email } },
    profiles: { [id]: { id, username, locale, status: "active", created_at: "2026-11-01T00:00:00Z" } },
    sites: {
      [id]: {
        profile_id: id,
        kind: null,
        onboarded: true,
        prepared: null,
        page: { profile: { username, displayName: "Mara Team", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale }, blocks: [] },
        theme: { template: "nocturne" },
        legal: { name: "", address: "", email, phone: "" },
        updated_at: "2026-11-20T10:00:00Z",
      },
    },
  });
  return { id, email, token: tokenFor(id) };
}

async function signIn(context: BrowserContext, baseURL: string | undefined, who: Member): Promise<void> {
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

const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * 3_600_000).toISOString();

/** Two open orders (one due in a few hours, one with a withdrawal waiting) and one withdrawal to decide. */
function orders() {
  const due = { id: randomUUID(), number: "LY-2026-0042", package: "premium", status: "in_progress" };
  const withdrawn = { id: randomUUID(), number: "LY-2026-0043", package: "start", status: "queued" };
  const customer = (name: string) => ({ id: randomUUID(), username: name, email: `${name}@example.com` });
  const queue = [
    { ...withdrawn, withdrawalPending: true, customer: customer("noor-haddad-studio"), orderedAt: iso(-30), dueAt: iso(40), promisedDueAt: iso(40), revisionDueAt: null, assignee: null, revisionsLeft: 1 },
    { ...due, withdrawalPending: false, customer: customer("lina-brandt-fotografie"), orderedAt: iso(-60), dueAt: iso(3), promisedDueAt: iso(3), revisionDueAt: null, assignee: { id: randomUUID(), label: "redaktion@example.com" }, revisionsLeft: 3 },
  ];
  const detail = (row: (typeof queue)[number], amountCents: number) => ({
    id: row.id,
    number: row.number,
    package: row.package,
    status: row.status,
    locale: "de",
    amountCents,
    earlyStart: true,
    withdrawalPending: row.withdrawalPending,
    customer: { ...row.customer, name: "Lina Brandt" },
    orderedAt: row.orderedAt,
    promisedDueAt: row.promisedDueAt,
    dueAt: row.dueAt,
    revisionDueAt: null,
    briefing: { links: ["https://example.com/portfolio/lina-brandt-fotografie-arbeiten-2026"], photos: [], wishes: "Ruhig, viel Weißraum, die Serien zuerst.", pageLocale: "de" },
    assignee: row.assignee,
    revisionsAllowed: 3,
    revisionsUsed: 0,
    revisionsLeft: row.revisionsLeft,
    deliveredAt: null,
    refundedAt: null,
    events: [{ id: 1, at: row.orderedAt, kind: "paid", actor: null, details: {} }],
    proposals: [],
    site: { kind: "photographer", page: { profile: { username: row.customer.username, displayName: "Lina Brandt", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" }, blocks: [] }, theme: { template: "werkbogen" } },
  });
  const [first, second] = queue as [(typeof queue)[number], (typeof queue)[number]];
  const details = { [due.id]: detail(second, 7999), [withdrawn.id]: detail(first, 2499) };
  const contracts = [
    {
      kind: "withdrawal",
      id: randomUUID(),
      receivedAt: iso(-20),
      name: "Noor Haddad",
      email: "noor-haddad-studio@example.com",
      contract: withdrawn.number,
      matched: true,
      suspect: false,
      decision: null,
      refundCents: null,
      handledAt: null,
      note: null,
      refundDueAt: iso(24 * 13),
      account: { id: randomUUID(), username: "noor-haddad-studio", email: "noor-haddad-studio@example.com" },
      order: { id: withdrawn.id, number: withdrawn.number, amountCents: 2499, earlyStart: true, status: "queued", withdrawalPending: true },
      entitlement: null,
      invoice: null,
    },
  ];
  return { queue, details, contracts, due, withdrawn };
}

/** The team functions, answered as a database with the billing migration does for an owner. */
async function database(page: Page, who: Member) {
  const data = orders();
  const answers: Record<string, (body: Record<string, unknown>) => unknown> = {
    admin_me: () => ({ role: "owner", email: who.email, permissions: OWNER }),
    admin_team: () => [{ id: who.id, email: who.email, name: "Mara Team", role: "owner", addedAt: "2026-11-01T00:00:00Z" }],
    admin_activity: () => [],
    admin_customers: () => [],
    admin_blocked_ips: () => [],
    admin_referral_queue: () => ({ verifications: [], held: [], rewards: [] }),
    admin_orders: () => data.queue,
    admin_order: (body) => data.details[String(body.target)] ?? null,
    admin_contract_requests: () => data.contracts,
    admin_ai_status: () => ({ enabled: false, today: { runs: 0, spentMicros: 0 } }),
  };
  await page.route(`${STUB}/rest/v1/rpc/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.continue();
    const name = new URL(request.url()).pathname.split("/").pop() ?? "";
    const answer = answers[name];
    if (!answer) return route.continue();
    const body = (request.postDataJSON() as Record<string, unknown> | null) ?? {};
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(answer(body)) });
  });
  return data;
}

/** Nothing reaches past the screen's edges, outside boxes that scroll sideways on purpose. */
async function overflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > width + 1) out.push(`page scrolls sideways: ${String(document.documentElement.scrollWidth)} > ${String(width)}`);
    for (const element of document.querySelectorAll("main *")) {
      let scroller: Element | null = element.parentElement;
      let inside = false;
      while (scroller && scroller !== document.body) {
        const overflowX = getComputedStyle(scroller).overflowX;
        if (overflowX !== "visible") {
          inside = true;
          break;
        }
        scroller = scroller.parentElement;
      }
      if (inside) continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right > width + 1 || box.left < -1) out.push(`${element.tagName.toLowerCase()}.${(element.getAttribute("class") ?? "").slice(0, 60)}`);
    }
    return out.slice(0, 5);
  });
}

/** Every button and link of a group lies inside the screen (reachable without sideways scrolling). */
async function reachable(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((elements) => {
    const width = document.documentElement.clientWidth;
    return elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      return box.left < -1 || box.right > width + 1 ? [`${element.textContent}: ${String(Math.round(box.left))}–${String(Math.round(box.right))}`] : [];
    });
  });
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

test.describe("orders on a phone (stub build, payments=test)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  for (const locale of ["de", "ar"] as const) {
    test(`queue, withdrawals, one order and its editor fit 390 px (${locale})`, async ({ page, context, baseURL, isMobile }) => {
      test.skip(!isMobile, "phone layout");
      test.setTimeout(120_000);
      const messages = locale === "ar" ? ar : de;
      await page.setViewportSize(PHONE);
      const who = await member(locale);
      await signIn(context, baseURL, who);
      const data = await database(page, who);
      const shoot = async (name: string) => {
        if (!SHOTS) return;
        mkdirSync(SHOTS, { recursive: true });
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await page.screenshot({ path: path.join(SHOTS, `${name}-${locale}-phone.png`), fullPage: true });
      };

      // The queue: one card per order, nothing cut off, every card reachable.
      await page.goto(`/${locale}/admin/orders`);
      await expect(page.locator("[data-orders-list] [data-order]")).toHaveCount(2);
      expect(await overflow(page), "queue").toEqual([]);
      expect(await reachable(page, "[data-orders-list] a"), "queue cards").toEqual([]);
      expect(await axe(page), "queue").toEqual([]);
      await shoot("orders");

      // Withdrawals and cancellations: the decisions are buttons inside the screen.
      await page.goto(`/${locale}/admin/orders?tab=contracts`);
      await expect(page.locator("[data-contract-action]").first()).toBeVisible();
      expect(await overflow(page), "contracts").toEqual([]);
      expect(await reachable(page, "[data-contract-action]"), "contract actions").toEqual([]);
      expect(await axe(page), "contracts").toEqual([]);
      await shoot("contracts");

      // One order: its actions wrap inside the screen.
      await page.goto(`/${locale}/admin/orders/${data.due.id}`);
      await expect(page.locator("[data-order-actions]")).toBeVisible();
      expect(await overflow(page), "order").toEqual([]);
      expect(await reachable(page, "[data-order-actions] button, [data-order-actions] a"), "order actions").toEqual([]);
      expect(await axe(page), "order").toEqual([]);
      await shoot("order");

      // The proposal editor: the kit fields and the way back are on screen.
      await page.goto(`/${locale}/admin/orders/${data.due.id}/proposal`);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(await overflow(page), "proposal").toEqual([]);
      await shoot("proposal");

      // What waits (A-17): the overview lists the withdrawal and the order due today; "More" carries the count.
      await page.goto(`/${locale}/admin`);
      const look = page.locator("[data-needs-look]");
      await expect(look.getByRole("link", { name: new RegExp(messages.admin.overview.contractsWaiting) })).toContainText("1");
      await expect(look.getByRole("link", { name: new RegExp(messages.admin.overview.verificationsWaiting) })).toContainText("0");
      await expect(page.getByRole("navigation", { name: messages.admin.nav.label }).locator("visible=true").locator("[data-waiting]")).toHaveText("3");
      // Revenue this month counts the page service: the orders were read.
      await expect(page.locator("[data-revenue-orders=ready]")).toBeVisible();
      expect(await overflow(page), "overview").toEqual([]);
      await shoot("overview-orders");
    });
  }
});
