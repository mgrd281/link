// A stand-in for the Supabase HTTP API, for the stub specs (e2e/stub-app.spec.ts, E2E_STUB=1). It
// answers the few requests the app makes on the screens those specs open (the session's user, the
// account's profile and page, orders, the public page, the functions that delete, suspend and
// rename), from data a test seeds over POST /__stub/seed. It is not a database: no row-level
// security, no SQL. What it gives is a real-mode build that runs without the local stack, so the
// browser behaviour of public pages, the order screen and the checkouts can be driven end to end.
//
//   STUB_SUPABASE_PORT=55103 node e2e/stub/supabase-stub.mjs
import http from "node:http";

const PORT = Number(process.env.STUB_SUPABASE_PORT ?? 55103);

// 1 × 1 pictures for the public `media` bucket: the optimizer can decode both.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");

/** @type {{ users: Record<string, { id: string, email: string }>, profiles: Record<string, any>, sites: Record<string, any>, orders: Record<string, any>, entitlements: Record<string, any>, calls: string[] }} */
let state = { users: {}, profiles: {}, sites: {}, orders: {}, entitlements: {}, calls: [] };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "*",
  "access-control-max-age": "600",
};

const send = (res, status, body, headers = {}) => {
  const payload = body === undefined ? "" : Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { ...CORS, ...(Buffer.isBuffer(body) ? {} : { "content-type": "application/json" }), ...headers });
  res.end(payload);
};

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(text ? JSON.parse(text) : {});
      } catch {
        resolve({});
      }
    });
  });

/** The account a bearer token stands for: the `sub` of its (unsigned) payload, if such a user was seeded. */
function caller(req) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1] ?? "";
  try {
    const { sub } = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return state.users[sub] ?? null;
  } catch {
    return null;
  }
}

const authUser = (user) => ({ id: user.id, aud: "authenticated", role: "authenticated", email: user.email, email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" });

/** `column=eq.value` filters of a PostgREST query string. */
const filters = (url) => [...url.searchParams].flatMap(([key, value]) => (value.startsWith("eq.") ? [[key, value.slice(3)]] : []));
const matching = (rows, url) => rows.filter((row) => filters(url).every(([key, value]) => String(row[key]) === value));

/** Rows as PostgREST answers them: one object when the client asked for exactly one, else a list. */
function rows(req, res, list) {
  if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
    if (list.length === 1) send(res, 200, list[0]);
    else send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: null, hint: null });
    return;
  }
  send(res, 200, list);
}

/** What `public_page()` answers: active, onboarded accounts only. */
function publicPage(handle) {
  const profile = Object.values(state.profiles).find((row) => row.username === String(handle).trim().toLowerCase());
  const site = profile ? state.sites[profile.id] : null;
  if (!profile || !site || profile.status !== "active" || !site.onboarded) return null;
  return { page: site.page, theme: site.theme ?? {}, legal: site.legal ?? {}, updatedAt: site.updated_at };
}

/** An account's profile and page are gone (the account was deleted). */
function forget(id) {
  const without = (table) => Object.fromEntries(Object.entries(table).filter(([key]) => key !== id));
  state.profiles = without(state.profiles);
  state.sites = without(state.sites);
}

const RPC = {
  public_page: (args) => publicPage(args.handle),
  username_status: () => "ok",
  my_orders: (_args, user) => Object.values(state.orders).filter((order) => order.profile_id === user?.id),
  my_order: (args, user) => {
    const order = state.orders[args.target];
    return order && order.profile_id === user?.id ? order : null;
  },
  change_username: (args, user) => {
    const profile = user ? state.profiles[user.id] : null;
    if (!profile) return "unavailable";
    profile.username = String(args.candidate).trim().toLowerCase();
    const site = state.sites[profile.id];
    if (site) site.page = { ...site.page, profile: { ...site.page.profile, username: profile.username } };
    return "ok";
  },
  delete_my_account: (_args, user) => {
    if (user) forget(user.id);
    return null;
  },
  admin_delete_customer: (args) => {
    forget(args.customer);
    return null;
  },
  admin_set_status: (args) => {
    if (state.profiles[args.customer]) state.profiles[args.customer].status = args.next;
    return null;
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${String(PORT)}`);
  const path = url.pathname;
  if (req.method === "OPTIONS") return send(res, 204);
  if (path === "/health") return send(res, 200, { ok: true });

  // Test control: replace or extend the data, and read which functions were called.
  if (path === "/__stub/seed" && req.method === "POST") {
    const seed = await readBody(req);
    for (const key of ["users", "profiles", "sites", "orders", "entitlements"]) Object.assign(state[key], seed[key] ?? {});
    return send(res, 200, { ok: true });
  }
  if (path === "/__stub/reset" && req.method === "POST") {
    state = { users: {}, profiles: {}, sites: {}, orders: {}, entitlements: {}, calls: [] };
    return send(res, 200, { ok: true });
  }
  if (path === "/__stub/calls") return send(res, 200, state.calls);

  const user = caller(req);

  if (path === "/auth/v1/user") return user ? send(res, 200, authUser(user)) : send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
  if (path === "/auth/v1/logout") return send(res, 204);
  if (path.startsWith("/auth/v1/")) return send(res, 400, { code: 400, error_code: "validation_failed", msg: "not available in the stub" });

  if (path.startsWith("/rest/v1/rpc/")) {
    const name = path.slice("/rest/v1/rpc/".length);
    const args = req.method === "POST" ? await readBody(req) : Object.fromEntries(url.searchParams);
    state.calls.push(name);
    const answer = RPC[name] ? RPC[name](args, user) : null;
    return send(res, 200, answer);
  }

  if (path.startsWith("/rest/v1/")) {
    const table = path.slice("/rest/v1/".length);
    if (table === "profiles" && req.method === "GET") return rows(req, res, matching(Object.values(state.profiles), url));
    if (table === "sites") {
      const found = matching(Object.values(state.sites), url);
      if (req.method === "GET") return rows(req, res, found);
      if (req.method === "PATCH") {
        const patch = await readBody(req);
        for (const row of found) Object.assign(row, patch);
        return (req.headers.prefer ?? "").includes("return=representation") ? rows(req, res, found) : send(res, 204);
      }
    }
    if (table === "orders" && req.method === "GET") return rows(req, res, matching(Object.values(state.orders), url));
    // An owner's Pro entitlements (the Plan pane's portal route reads its Stripe customer from them).
    if (table === "entitlements" && req.method === "GET") return rows(req, res, matching(Object.values(state.entitlements), url));
    // Every other table is empty; writes are accepted and forgotten.
    return req.method === "GET" ? rows(req, res, []) : send(res, 204);
  }

  // Storage: the public media bucket serves a tiny picture (WebP for *.webp), listings are empty.
  if (path.startsWith("/storage/v1/object/public/media/")) {
    const webp = path.endsWith(".webp");
    return send(res, 200, webp ? WEBP : PNG, { "content-type": webp ? "image/webp" : "image/png", "cache-control": "max-age=3600" });
  }
  if (path.startsWith("/storage/v1/object/list/")) return send(res, 200, []);
  if (path.startsWith("/storage/v1/")) return send(res, 200, []);

  return send(res, 404, { message: "not in the stub" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.warn(`Supabase stub on http://127.0.0.1:${String(PORT)}`);
});
