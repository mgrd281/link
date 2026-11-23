import { describe, expect, it } from "vitest";

import { changeAddress, refreshPublicPage } from "./refresh";

describe("telling the server the page moved", () => {
  it("posts the previous address as the signed-in account", async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    const sent = await refreshPublicPage("mila", {
      token: () => Promise.resolve("token-1"),
      send: (path, init) => {
        calls.push({ path, init });
        return Promise.resolve();
      },
    });
    expect(sent).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/api/account/revalidate");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: "Bearer token-1" });
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ previous: "mila" });
  });

  it("does nothing in demo mode or signed out, and never throws", async () => {
    let called = false;
    const send = () => {
      called = true;
      return Promise.resolve();
    };
    expect(await refreshPublicPage("mila", { token: () => Promise.resolve(null), send })).toBe(false);
    expect(called).toBe(false);
    expect(await refreshPublicPage("mila", { token: () => Promise.resolve("t"), send: () => Promise.reject(new Error("offline")) })).toBe(false);
  });
});

describe("changing the page's address (Settings and the welcome flow)", () => {
  it("tells the server the previous address once the change worked", async () => {
    const refreshed: string[] = [];
    const refresh = (previous: string) => {
      refreshed.push(previous);
      return Promise.resolve(true);
    };
    const result = await changeAddress("mila-berg", "mila", () => Promise.resolve({ ok: true }), refresh);
    expect(result).toEqual({ ok: true });
    expect(refreshed).toEqual(["mila"]);
  });

  it("tells nothing when the change was refused, or nothing changed", async () => {
    const refreshed: string[] = [];
    const refresh = (previous: string) => {
      refreshed.push(previous);
      return Promise.resolve(true);
    };
    expect(await changeAddress("taken", "mila", () => Promise.resolve({ ok: false, error: "usernameTaken" }), refresh)).toEqual({ ok: false, error: "usernameTaken" });
    await changeAddress("mila", "mila", () => Promise.resolve({ ok: true }), refresh);
    await changeAddress("mila", "", () => Promise.resolve({ ok: true }), refresh);
    expect(refreshed).toEqual([]);
  });
});
