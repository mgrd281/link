import { describe, expect, it } from "vitest";

import { sendCustomerStatus } from "./customer-status";

const ID = "6f1c2f3e-1111-4222-8333-944445555666";

describe("suspending a customer from the console", () => {
  it("goes through the route that also drops the cached public page, as the team member", async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    const done = await sendCustomerStatus(ID, "suspended", {
      token: () => Promise.resolve("token-1"),
      send: (path, init) => {
        calls.push({ path, init });
        return Promise.resolve({ ok: true });
      },
    });
    expect(done).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe(`/api/admin/customers/${ID}/status`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: "Bearer token-1", "Content-Type": "application/json" });
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ next: "suspended" });
  });

  it("answers false when the server refuses, the request fails or nobody is signed in", async () => {
    const token = () => Promise.resolve("t");
    expect(await sendCustomerStatus(ID, "active", { token, send: () => Promise.resolve({ ok: false }) })).toBe(false);
    expect(await sendCustomerStatus(ID, "active", { token, send: () => Promise.reject(new Error("offline")) })).toBe(false);
    let called = false;
    const send = () => {
      called = true;
      return Promise.resolve({ ok: true });
    };
    expect(await sendCustomerStatus(ID, "active", { token: () => Promise.resolve(null), send })).toBe(false);
    expect(called).toBe(false);
  });
});
