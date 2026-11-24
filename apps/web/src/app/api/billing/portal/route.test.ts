import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { handle, requests } from "../../../../../e2e/mocks/stripe.handler.mjs";

/**
 * The Plan pane's "Payments and invoices": a Stripe customer portal session for the signed-in
 * owner, against the local Stripe stand-in (e2e/mocks/stripe.handler.mjs) on an ephemeral port.
 * The customer comes from the owner's own entitlement (read as the owner), never from the request.
 */

interface Query {
  table: string;
  filters: [string, string, unknown][];
}

interface State {
  payments: boolean;
  /** What the entitlements read answers. */
  row: { stripe_customer_id: string | null } | null;
  error: { code: string; message: string } | null;
  queries: Query[];
}

const state = vi.hoisted((): State => ({ payments: true, row: null, error: null, queries: [] }));

vi.mock("@/lib/flags", () => ({
  get paymentsEnabled() {
    return state.payments;
  },
  get paymentsMode() {
    return state.payments ? "test" : "off";
  },
}));

/** A PostgREST query builder as far as the route uses it: it records the filters and answers `state`. */
function builder(table: string) {
  const query: Query = { table, filters: [] };
  state.queries.push(query);
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      query.filters.push(["eq", column, value]);
      return chain;
    },
    not: (column: string, operator: string, value: unknown) => {
      query.filters.push([`not.${operator}`, column, value]);
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: state.error ? null : state.row, error: state.error }),
  };
  return chain;
}

vi.mock("@/lib/server/user", () => ({
  requireUser: (request: Request) =>
    Promise.resolve(
      request.headers.get("authorization") === "Bearer owner-session"
        ? { user: { id: "owner-1", email: "owner@example.com" }, db: { from: builder } }
        : Response.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    ),
}));

let server: Server;
let origin = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${String(port)}`;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_unit");
  vi.stubEnv("STRIPE_API_HOST", "127.0.0.1");
  vi.stubEnv("STRIPE_API_PORT", String(port));
  vi.stubEnv("STRIPE_API_PROTOCOL", "http");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://linkyo.test");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  state.payments = true;
  state.row = null;
  state.error = null;
  state.queries = [];
  requests.length = 0;
});

const { POST } = await import("./route");

const post = (body: unknown = { locale: "de" }, authorization: string | null = "Bearer owner-session") =>
  POST(
    new Request("http://localhost/api/billing/portal", {
      method: "POST",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      body: JSON.stringify(body),
    }),
  );

interface Recorded {
  method: string;
  path: string;
  body: Record<string, unknown>;
}
const portalCalls = () => (requests as Recorded[]).filter((entry) => entry.method === "POST" && entry.path === "/v1/billing_portal/sessions");

describe("POST /api/billing/portal", () => {
  it("does not exist where contracts cannot be made (payments off)", async () => {
    state.payments = false;
    const response = await post();
    expect(response.status).toBe(404);
    expect(state.queries).toEqual([]);
  });

  it("answers 401 without a session", async () => {
    const response = await post({ locale: "de" }, null);
    expect(response.status).toBe(401);
    expect(state.queries).toEqual([]);
  });

  it("refuses an unknown language", async () => {
    const response = await post({ locale: "fr" });
    expect(response.status).toBe(400);
  });

  it("reads the customer from the owner's own Stripe entitlement, never from the request", async () => {
    state.row = { stripe_customer_id: "cus_owner1" };
    const response = await post({ locale: "de", customer: "cus_someone_else" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.queries).toEqual([
      {
        table: "entitlements",
        filters: [
          ["eq", "profile_id", "owner-1"],
          ["eq", "source", "stripe"],
          ["not.is", "stripe_customer_id", null],
        ],
      },
    ]);
    const [call] = portalCalls();
    expect(call?.body).toMatchObject({ customer: "cus_owner1", return_url: "https://linkyo.test/de/app/settings/plan", locale: "de" });
  });

  it("answers the portal's address, which leads back to the Plan pane", async () => {
    state.row = { stripe_customer_id: "cus_owner1" };
    const { url } = (await (await post({ locale: "en" })).json()) as { url: string };
    expect(url.startsWith(`${origin}/__portal/bps_`)).toBe(true);
    const page = await (await fetch(url)).text();
    expect(page).toContain("cus_owner1");
    expect(page).toContain('href="https://linkyo.test/en/app/settings/plan"');
  });

  it("lets Stripe pick the portal's language for Arabic (it has none)", async () => {
    state.row = { stripe_customer_id: "cus_owner1" };
    expect((await post({ locale: "ar" })).status).toBe(200);
    expect(portalCalls()[0]?.body).toMatchObject({ locale: "auto", return_url: "https://linkyo.test/ar/app/settings/plan" });
  });

  it("answers 409 noCustomer while Stripe does not know the account, and asks Stripe nothing", async () => {
    for (const row of [null, { stripe_customer_id: null }]) {
      state.row = row;
      const response = await post();
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ ok: false, error: "noCustomer" });
    }
    expect(portalCalls()).toEqual([]);
  });

  it("answers 409 unavailable on a database without the billing tables, 500 on any other error", async () => {
    state.error = { code: "PGRST205", message: "Could not find the table 'public.entitlements' in the schema cache" };
    const missing = await post();
    expect(missing.status).toBe(409);
    expect(await missing.json()).toEqual({ ok: false, error: "unavailable" });
    state.error = { code: "57014", message: "canceling statement due to statement timeout" };
    expect((await post()).status).toBe(500);
    expect(portalCalls()).toEqual([]);
  });

  it("answers 502 when Stripe refuses the session", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // The stand-in refuses a customer id that is not one (Stripe answers 400 for an unknown customer).
    state.row = { stripe_customer_id: "not-a-customer" };
    const response = await post();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "server" });
  });

  it("answers 503 notConfigured without a Stripe key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    try {
      state.row = { stripe_customer_id: "cus_owner1" };
      const response = await post();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false, error: "notConfigured" });
    } finally {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit");
    }
  });
});
