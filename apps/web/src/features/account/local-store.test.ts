import { NO_IMAGE } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { LocalAccountStore, sixDigits, STORAGE_KEY, type StorageLike } from "./local-store";
import type { CodeRequest } from "./types";

function memory(): StorageLike & { data: Map<string, string>; full: boolean } {
  const data = new Map<string, string>();
  return {
    data,
    full: false,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (this.full) throw new DOMException("full", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key) => void data.delete(key),
  };
}

const fresh = () => {
  const storage = memory();
  return new LocalAccountStore(() => storage);
};

const signUp: CodeRequest = { email: "Mila@Example.com", locale: "de", signUp: { username: "mila" } };
const logIn: CodeRequest = { email: " MILA@example.com ", locale: "de" };

/** Asks for a code and enters it, as the screens do. */
async function withCode(store: LocalAccountStore, request: CodeRequest) {
  const sent = await store.requestCode(request);
  if (!sent.ok || !sent.demoCode) return sent;
  return store.verifyCode({ ...request, code: sent.demoCode });
}

describe("LocalAccountStore", () => {
  it("signs up with a code, starts a session and creates a starter page", async () => {
    const storage = memory();
    const store = new LocalAccountStore(() => storage);
    expect(store.getSnapshot().status).toBe("signedOut");
    const sent = await store.requestCode(signUp);
    expect(sent).toMatchObject({ ok: true, pending: "code" });
    expect(sent.ok && sent.demoCode).toMatch(/^\d{6}$/);
    expect(store.getSnapshot().status).toBe("signedOut");
    expect(await store.verifyCode({ ...signUp, code: sent.ok ? (sent.demoCode ?? "") : "" })).toEqual({ ok: true });
    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("signedIn");
    if (snapshot.status !== "signedIn") return;
    expect(snapshot.account.email).toBe("mila@example.com");
    expect(snapshot.site.page.profile).toMatchObject({ username: "mila", displayName: "mila", locale: "de" });
    expect(snapshot.site.page.profile.avatar.src).toBe(NO_IMAGE);
    expect(snapshot.site.onboarded).toBe(false);
    // Codes live only in memory, never in storage.
    expect(storage.data.get(STORAGE_KEY)).not.toMatch(/"code"/);
  });

  it("refuses wrong codes, then expires the code after five tries", async () => {
    const store = fresh();
    const sent = await store.requestCode(signUp);
    const right = sent.ok ? (sent.demoCode ?? "") : "";
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i += 1) expect(await store.verifyCode({ ...signUp, code: wrong })).toEqual({ ok: false, error: "invalidCode" });
    expect(await store.verifyCode({ ...signUp, code: wrong })).toEqual({ ok: false, error: "codeExpired" });
    expect(await store.verifyCode({ ...signUp, code: right })).toEqual({ ok: false, error: "codeExpired" });
    expect(store.getSnapshot().status).toBe("signedOut");
    // A new code works.
    expect(await withCode(store, signUp)).toEqual({ ok: true });
  });

  it("only the newest code counts", async () => {
    const store = fresh();
    const first = await store.requestCode(signUp);
    const second = await store.requestCode(signUp);
    const old = first.ok ? (first.demoCode ?? "") : "";
    const now = second.ok ? (second.demoCode ?? "") : "";
    if (old !== now) expect(await store.verifyCode({ ...signUp, code: old })).toEqual({ ok: false, error: "invalidCode" });
    expect(await store.verifyCode({ ...signUp, code: now })).toEqual({ ok: true });
  });

  it("keeps the snapshot reference stable until something changes", async () => {
    const store = fresh();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    const shared = memory();
    const a = new LocalAccountStore(() => shared);
    await withCode(a, signUp);
    const first = a.getSnapshot();
    expect(a.getSnapshot()).toBe(first);
    a.updateSite((site) => ({ ...site, onboarded: true }));
    expect(a.getSnapshot()).not.toBe(first);
  });

  it("checks the page address and email before sending a code", async () => {
    const store = fresh();
    await withCode(store, signUp);
    store.logOut();
    const other = (email: string, username: string) => store.requestCode({ email, locale: "de", signUp: { username } });
    expect(await other("other@example.com", "mila")).toEqual({ ok: false, error: "usernameTaken" });
    expect(await other("x@example.com", "login")).toEqual({ ok: false, error: "reservedUsername" });
    expect(await other("x@example.com", "Mila Aurel!")).toEqual({ ok: false, error: "invalidUsername" });
    expect(await other("not-an-email", "mila3")).toEqual({ ok: false, error: "invalidEmail" });
  });

  it("signs in with a code, with the same answer for unknown emails", async () => {
    const store = fresh();
    await withCode(store, signUp);
    store.logOut();
    expect(store.getSnapshot().status).toBe("signedOut");
    // No account: the same "code is on its way", but there is no code.
    expect(await store.requestCode({ email: "nobody@example.com", locale: "de" })).toEqual({ ok: true, pending: "code" });
    expect(await store.verifyCode({ email: "nobody@example.com", locale: "de", code: "123456" })).toEqual({ ok: false, error: "codeExpired" });
    expect(await withCode(store, logIn)).toEqual({ ok: true });
    expect(store.getSnapshot().status).toBe("signedIn");
  });

  it("signs an existing account in when someone signs up again with its email", async () => {
    const store = fresh();
    await withCode(store, signUp);
    store.logOut();
    expect(await withCode(store, { ...signUp, signUp: { username: "mila-new" } })).toEqual({ ok: true });
    const snapshot = store.getSnapshot();
    expect(snapshot.status === "signedIn" && snapshot.account.username).toBe("mila");
  });

  it("renames the address everywhere and exports, then deletes everything", async () => {
    const store = fresh();
    await withCode(store, signUp);
    expect(await store.changeUsername("mila-aurel")).toEqual({ ok: true });
    const snapshot = store.getSnapshot();
    expect(snapshot.status === "signedIn" && snapshot.site.page.profile.username).toBe("mila-aurel");
    const exported = JSON.parse(await store.exportData()) as { account: { username: string } };
    expect(exported.account.username).toBe("mila-aurel");
    await store.deleteAccount();
    expect(store.getSnapshot().status).toBe("signedOut");
    expect(await store.requestCode(logIn)).toEqual({ ok: true, pending: "code" });
  });

  it("reports a full storage instead of losing data silently", async () => {
    const storage = memory();
    const store = new LocalAccountStore(() => storage);
    await withCode(store, signUp);
    storage.full = true;
    expect(store.updateSite((site) => ({ ...site, onboarded: true }))).toEqual({ ok: false, error: "storageFull" });
  });

  it("logs sign-ins and wrong codes with their context, exports and deletes them with the account", async () => {
    const storage = memory();
    const context = () => Promise.resolve({ ip: "192.0.2.4", country: "DE", city: "Berlin", device: { type: "desktop" as const, os: "macOS", browser: "Safari" }, deviceId: "dev_test" });
    const store = new LocalAccountStore(() => storage, context);
    await withCode(store, signUp);
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.logOut();
    const sent = await store.requestCode(logIn);
    const right = sent.ok ? (sent.demoCode ?? "") : "";
    expect((await store.verifyCode({ ...logIn, code: right === "000000" ? "111111" : "000000" })).ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await store.verifyCode({ ...logIn, code: right });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const log = await store.signIns();
    expect(log.map((entry) => entry.result)).toEqual(["success", "failed", "success"]);
    expect(log[0]).toMatchObject({ ip: "192.0.2.4", city: "Berlin", deviceId: "dev_test" });
    expect((JSON.parse(await store.exportData()) as { signIns: unknown[] }).signIns).toHaveLength(3);
    await store.deleteAccount();
    expect((JSON.parse(storage.data.get(STORAGE_KEY) ?? "{}") as { logins: unknown }).logins).toEqual({});
  });
});

describe("sixDigits", () => {
  it("is always six digits", () => {
    for (let i = 0; i < 200; i += 1) expect(sixDigits()).toMatch(/^\d{6}$/);
  });
});
