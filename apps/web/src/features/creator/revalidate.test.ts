import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as deleteAccount } from "@/app/api/account/delete/route";
import { POST as pageMoved } from "@/app/api/account/revalidate/route";
import { POST as deleteCustomer } from "@/app/api/admin/customers/[id]/delete/route";
import { POST as setStatus } from "@/app/api/admin/customers/[id]/status/route";

import { creatorPaths, projectSlugs, revalidateCreatorPages } from "./revalidate";

// The routes with a faked signed-in user and database; `revalidatePath` is recorded, in call order
// with the database calls, so a test can tell what was read or dropped before and after an action.

interface State {
  log: string[];
  /** The address the profile read answers (null: no such profile). */
  username: string | null;
  /** The stored page the site read answers (null: no page). */
  page: unknown;
  /** The error an RPC answers, by function name. */
  fail: Record<string, { code: string }>;
  service: boolean;
}

// A page with a project at "tidewatch" that lived at "tide-old" before, a hidden project, a link and
// a project whose address is not one (never stored by the app; skipped).
const PROJECTS = {
  profile: { username: "mila" },
  blocks: [
    { id: "p1", type: "project", slug: "tidewatch", was: ["tide-old"] },
    { id: "l1", type: "link", slug: "not-a-project" },
    { id: "p2", type: "project", slug: "harbour", visible: false },
    { id: "p3", type: "project", slug: "../admin", was: ["Kontakt Seite", 7] },
  ],
};

const state = vi.hoisted((): State => ({ log: [], username: "mila", page: null, fail: {}, service: true }));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    state.log.push(`revalidate ${path}`);
  },
}));

const fakeDb = (who: string) => ({
  from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: () => {
        state.log.push(`${who} reads ${table}`);
        if (table === "sites") return Promise.resolve({ data: state.page === null ? null : { page: state.page }, error: null });
        return Promise.resolve({ data: state.username === null ? null : { username: state.username }, error: null });
      },
    };
    return query;
  },
  rpc: (name: string, args?: { next?: string }) => {
    state.log.push(`${who} rpc ${name}${args?.next ? ` ${args.next}` : ""}`);
    // A decision answers what the server needs for the e-mails (features/moderation/server/decide.ts).
    const data = name === "admin_moderate" ? { decision: "d1", customer: "22222222-2222-4222-8222-222222222222", username: "mila", locale: "de", decidedAt: "2026-11-28T12:00:00Z", report: null } : null;
    return Promise.resolve({ data: state.fail[name] ? null : data, error: state.fail[name] ?? null });
  },
});

vi.mock("@/lib/server/user", () => ({
  requireUser: (request: Request) =>
    Promise.resolve(
      request.headers.get("authorization") === "Bearer good-token"
        ? { user: { id: "11111111-1111-4111-8111-111111111111", email: "mila@example.com" }, db: fakeDb("user") }
        : Response.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    ),
}));

vi.mock("@/lib/supabase/server", () => ({
  serviceSupabase: () => {
    if (!state.service) throw new Error("SUPABASE_SECRET_KEY is not set");
    return fakeDb("service");
  },
}));

vi.mock("@/lib/server/storage-purge", () => ({
  removeAccountFiles: () => {
    state.log.push("files removed");
    return Promise.resolve();
  },
}));

const CUSTOMER = "22222222-2222-4222-8222-222222222222";
const post = (body?: unknown, token = "good-token") =>
  new Request("http://localhost/api", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const forCustomer = { params: Promise.resolve({ id: CUSTOMER }) };
const dropped = () => state.log.filter((entry) => entry.startsWith("revalidate "));
const PAGE = ["revalidate /u/mila", "revalidate /u/mila/opengraph-image"];
/** The page, its link preview and every project page with its link preview. */
const under = (name: string) => [
  `revalidate /u/${name}`,
  `revalidate /u/${name}/opengraph-image`,
  ...["tidewatch", "tide-old", "harbour"].flatMap((slug) => [`revalidate /u/${name}/${slug}`, `revalidate /u/${name}/${slug}/opengraph-image`]),
];

beforeEach(() => {
  state.log = [];
  state.username = "mila";
  state.page = PROJECTS;
  state.fail = {};
  state.service = true;
});

describe("dropping a creator page from the cache", () => {
  it("names the internal page and its link preview, then each project page and its link preview", () => {
    expect(creatorPaths("mila")).toEqual(["/u/mila", "/u/mila/opengraph-image"]);
    expect(creatorPaths("mila", ["tidewatch"])).toEqual(["/u/mila", "/u/mila/opengraph-image", "/u/mila/tidewatch", "/u/mila/tidewatch/opengraph-image"]);
  });

  it("drops each address once and skips what is not an address", () => {
    expect(revalidateCreatorPages(["mila", " Mila ", null, undefined, "../admin", "a", "de/app", "mila-aurel"])).toEqual(["mila", "mila-aurel"]);
    expect(dropped()).toEqual([...PAGE, "revalidate /u/mila-aurel", "revalidate /u/mila-aurel/opengraph-image"]);
  });

  it("drops each project page under each address once, and skips slugs that are not a project address", () => {
    expect(revalidateCreatorPages(["mila", "mila-aurel"], ["tidewatch", "tidewatch", "../x", "kontakt", "A"])).toEqual(["mila", "mila-aurel"]);
    expect(dropped()).toEqual([
      ...PAGE,
      "revalidate /u/mila/tidewatch",
      "revalidate /u/mila/tidewatch/opengraph-image",
      "revalidate /u/mila-aurel",
      "revalidate /u/mila-aurel/opengraph-image",
      "revalidate /u/mila-aurel/tidewatch",
      "revalidate /u/mila-aurel/tidewatch/opengraph-image",
    ]);
  });

  it("reads every project address of a stored page, hidden ones and earlier ones included", () => {
    expect(projectSlugs(PROJECTS)).toEqual(["tidewatch", "tide-old", "harbour"]);
    for (const nothing of [null, undefined, "page", {}, { blocks: "x" }, { blocks: [null, 1, { type: "project" }] }]) expect(projectSlugs(nothing)).toEqual([]);
  });
});

describe("deleting the own account", () => {
  it("reads the addresses first, deletes, then drops the cached page and project pages before the files go", async () => {
    const response = await deleteAccount(post());
    expect(response.status).toBe(200);
    expect(state.log).toEqual(["user reads profiles", "user reads sites", "user rpc delete_my_account", ...under("mila"), "files removed"]);
  });

  it("still drops the page when its project addresses cannot be read", async () => {
    state.page = null;
    expect((await deleteAccount(post())).status).toBe(200);
    expect(dropped()).toEqual(PAGE);
  });

  it("drops nothing when the deletion failed or nobody is signed in", async () => {
    state.fail.delete_my_account = { code: "XX000" };
    expect((await deleteAccount(post())).status).toBe(500);
    expect((await deleteAccount(post(undefined, "bad"))).status).toBe(401);
    expect(dropped()).toEqual([]);
  });
});

describe("the team deletes a customer", () => {
  it("reads the addresses first, deletes as the team member, then drops the cached page and project pages", async () => {
    const response = await deleteCustomer(post(), forCustomer);
    expect(response.status).toBe(200);
    expect(state.log).toEqual(["service reads profiles", "service reads sites", "user rpc admin_delete_customer", ...under("mila"), "files removed"]);
  });

  it("drops nothing when the database refused the caller", async () => {
    state.fail.admin_delete_customer = { code: "42501" };
    expect((await deleteCustomer(post(), forCustomer)).status).toBe(403);
    expect(dropped()).toEqual([]);
  });

  it("still deletes when the address cannot be read (no secret key)", async () => {
    state.service = false;
    expect((await deleteCustomer(post(), forCustomer)).status).toBe(200);
    expect(state.log).toEqual(["user rpc admin_delete_customer", "files removed"]);
  });
});

describe("the team suspends a customer or lets them back in", () => {
  const suspend = { next: "suspended", reason: "Repeated fake ticket sales after a warning.", ground: "terms" };

  it("suspends with its reasons as the team member (admin_moderate), after reading the addresses, then drops the cache", async () => {
    const response = await setStatus(post(suspend), forCustomer);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, recorded: true, creatorMailed: false });
    expect(state.log).toEqual(["service reads profiles", "service reads sites", "user rpc admin_moderate", ...under("mila")]);
  });

  it("lets an account back in as the team member, then drops the cached page and project pages", async () => {
    const response = await setStatus(post({ next: "active" }), forCustomer);
    expect(response.status).toBe(200);
    expect(state.log).toEqual(["user rpc admin_set_status active", "service reads profiles", "service reads sites", ...under("mila")]);
  });

  it("suspends as before on a database without the reasons, and says they were not recorded", async () => {
    state.fail.admin_moderate = { code: "PGRST202" };
    const response = await setStatus(post(suspend), forCustomer);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, recorded: false });
    expect(state.log).toEqual(["service reads profiles", "service reads sites", "user rpc admin_moderate", "user rpc admin_set_status suspended", "service reads profiles", "service reads sites", ...under("mila")]);
  });

  it("refuses a suspension without reasons, other values, strangers and callers the database does not allow, and drops nothing", async () => {
    expect((await setStatus(post({ next: "suspended" }), forCustomer)).status).toBe(400);
    expect((await setStatus(post({ ...suspend, reason: "short" }), forCustomer)).status).toBe(400);
    expect((await setStatus(post({ next: "deleted" }), forCustomer)).status).toBe(400);
    expect((await setStatus(post(suspend), { params: Promise.resolve({ id: "mila" }) })).status).toBe(400);
    expect((await setStatus(post(suspend, "bad"), forCustomer)).status).toBe(401);
    state.fail.admin_moderate = { code: "42501" };
    expect((await setStatus(post(suspend), forCustomer)).status).toBe(403);
    state.fail.admin_set_status = { code: "42501" };
    expect((await setStatus(post({ next: "active" }), forCustomer)).status).toBe(403);
    expect(dropped()).toEqual([]);
  });
});

describe("the account changed its address", () => {
  it("drops the cached page and project pages at the new address and at the one before", async () => {
    state.username = "mila-aurel";
    const response = await pageMoved(post({ previous: "mila" }));
    expect(response.status).toBe(200);
    expect(dropped()).toEqual([...under("mila-aurel"), ...under("mila")]);
  });

  it("needs a signed-in account and ignores a previous value that is not an address", async () => {
    expect((await pageMoved(post({ previous: "mila" }, "bad"))).status).toBe(401);
    expect(dropped()).toEqual([]);
    expect((await pageMoved(post({ previous: "../../de" }))).status).toBe(200);
    expect(dropped()).toEqual(under("mila"));
  });
});
