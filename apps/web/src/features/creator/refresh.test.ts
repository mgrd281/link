import { describe, expect, it } from "vitest";

import { refreshPublicPage } from "./refresh";

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
