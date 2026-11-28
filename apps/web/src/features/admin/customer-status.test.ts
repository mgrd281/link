import { describe, expect, it } from "vitest";

import { sendCustomerStatus } from "./customer-status";

const ID = "6f1c2f3e-1111-4222-8333-944445555666";
const answering = (body: unknown) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe("suspending a customer from the console", () => {
  it("goes through the route that also drops the cached public page, as the team member, with its reason", async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    const done = await sendCustomerStatus(ID, "suspended", { reason: "Fake ticket sales after a warning.", ground: "terms" }, {
      token: () => Promise.resolve("token-1"),
      send: (path, init) => {
        calls.push({ path, init });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, recorded: true, creatorMailed: false }) });
      },
    });
    expect(done).toEqual({ ok: true, recorded: true, mailed: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe(`/api/admin/customers/${ID}/status`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: "Bearer token-1", "Content-Type": "application/json" });
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ next: "suspended", reason: "Fake ticket sales after a warning.", ground: "terms" });
  });

  it("says when the database could not keep the reason, and when the statement went out", async () => {
    const token = () => Promise.resolve("t");
    expect(await sendCustomerStatus(ID, "suspended", { reason: "Spam on every block.", ground: "terms" }, { token, send: answering({ ok: true, recorded: false }) })).toEqual({
      ok: true,
      recorded: false,
      mailed: false,
    });
    expect(await sendCustomerStatus(ID, "suspended", { reason: "Spam on every block.", ground: "illegal" }, { token, send: answering({ ok: true, creatorMailed: true }) })).toEqual({
      ok: true,
      recorded: true,
      mailed: true,
    });
  });

  it("lets an account back in without a reason", async () => {
    let body: unknown = null;
    await sendCustomerStatus(ID, "active", null, {
      token: () => Promise.resolve("t"),
      send: (_path, init) => {
        body = JSON.parse(init.body as string);
        return Promise.resolve({ ok: true });
      },
    });
    expect(body).toEqual({ next: "active" });
  });

  it("answers not ok when the server refuses, the request fails or nobody is signed in", async () => {
    const token = () => Promise.resolve("t");
    expect(await sendCustomerStatus(ID, "active", null, { token, send: () => Promise.resolve({ ok: false }) })).toEqual({ ok: false });
    expect(await sendCustomerStatus(ID, "active", null, { token, send: () => Promise.reject(new Error("offline")) })).toEqual({ ok: false });
    let called = false;
    const send = () => {
      called = true;
      return Promise.resolve({ ok: true });
    };
    expect(await sendCustomerStatus(ID, "active", null, { token: () => Promise.resolve(null), send })).toEqual({ ok: false });
    expect(called).toBe(false);
  });
});
