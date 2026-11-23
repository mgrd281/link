import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as deleteAccount } from "@/app/api/account/delete/route";
import { POST as pageMoved } from "@/app/api/account/revalidate/route";
import { POST as deleteCustomer } from "@/app/api/admin/customers/[id]/delete/route";
import { POST as setStatus } from "@/app/api/admin/customers/[id]/status/route";

import { creatorPaths, revalidateCreatorPages } from "./revalidate";

// The routes with a faked signed-in user and database; `revalidatePath` is recorded, in call order
// with the database calls, so a test can tell what was read or dropped before and after an action.

interface State {
  log: string[];
  /** The address the profile read answers (null: no such profile). */
  username: string | null;
  /** The error an RPC answers, by function name. */
  fail: Record<string, { code: string }>;
  service: boolean;
}

const state = vi.hoisted((): State => ({ log: [], username: "mila", fail: {}, service: true }));

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
        return Promise.resolve({ data: state.username === null ? null : { username: state.username }, error: null });
      },
    };
    return query;
  },
  rpc: (name: string, args?: { next?: string }) => {
    state.log.push(`${who} rpc ${name}${args?.next ? ` ${args.next}` : ""}`);
    return Promise.resolve({ data: null, error: state.fail[name] ?? null });
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

beforeEach(() => {
  state.log = [];
  state.username = "mila";
  state.fail = {};
  state.service = true;
});

describe("dropping a creator page from the cache", () => {
  it("names the internal page and its link preview", () => {
    expect(creatorPaths("mila")).toEqual(["/u/mila", "/u/mila/opengraph-image"]);
  });

  it("drops each address once and skips what is not an address", () => {
    expect(revalidateCreatorPages("mila", " Mila ", null, undefined, "../admin", "a", "de/app", "mila-aurel")).toEqual(["mila", "mila-aurel"]);
    expect(dropped()).toEqual([...PAGE, "revalidate /u/mila-aurel", "revalidate /u/mila-aurel/opengraph-image"]);
  });
});

describe("deleting the own account", () => {
  it("reads the address first, deletes, then drops the cached page before the files go", async () => {
    const response = await deleteAccount(post());
    expect(response.status).toBe(200);
    expect(state.log).toEqual(["user reads profiles", "user rpc delete_my_account", ...PAGE, "files removed"]);
  });

  it("drops nothing when the deletion failed or nobody is signed in", async () => {
    state.fail.delete_my_account = { code: "XX000" };
    expect((await deleteAccount(post())).status).toBe(500);
    expect((await deleteAccount(post(undefined, "bad"))).status).toBe(401);
    expect(dropped()).toEqual([]);
  });
});

describe("the team deletes a customer", () => {
  it("reads the address first, deletes as the team member, then drops the cached page", async () => {
    const response = await deleteCustomer(post(), forCustomer);
    expect(response.status).toBe(200);
    expect(state.log).toEqual(["service reads profiles", "user rpc admin_delete_customer", ...PAGE, "files removed"]);
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
  it("changes the status as the team member, then drops the cached page", async () => {
    for (const next of ["suspended", "active"]) {
      state.log = [];
      const response = await setStatus(post({ next }), forCustomer);
      expect(response.status).toBe(200);
      expect(state.log).toEqual([`user rpc admin_set_status ${next}`, "service reads profiles", ...PAGE]);
    }
  });

  it("refuses other values, strangers and callers the database does not allow, and drops nothing", async () => {
    expect((await setStatus(post({ next: "deleted" }), forCustomer)).status).toBe(400);
    expect((await setStatus(post({ next: "suspended" }), { params: Promise.resolve({ id: "mila" }) })).status).toBe(400);
    expect((await setStatus(post({ next: "suspended" }, "bad"), forCustomer)).status).toBe(401);
    state.fail.admin_set_status = { code: "42501" };
    expect((await setStatus(post({ next: "suspended" }), forCustomer)).status).toBe(403);
    expect(dropped()).toEqual([]);
  });
});

describe("the account changed its address", () => {
  it("drops the cached page at the new address and at the one before", async () => {
    state.username = "mila-aurel";
    const response = await pageMoved(post({ previous: "mila" }));
    expect(response.status).toBe(200);
    expect(dropped()).toEqual(["revalidate /u/mila-aurel", "revalidate /u/mila-aurel/opengraph-image", ...PAGE]);
  });

  it("needs a signed-in account and ignores a previous value that is not an address", async () => {
    expect((await pageMoved(post({ previous: "mila" }, "bad"))).status).toBe(401);
    expect(dropped()).toEqual([]);
    expect((await pageMoved(post({ previous: "../../de" }))).status).toBe(200);
    expect(dropped()).toEqual(PAGE);
  });
});
