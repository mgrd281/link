import { NO_IMAGE } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { LocalAccountStore, STORAGE_KEY, type StorageLike } from "./local-store";
import { isStrongEnough, passwordChecks } from "./password";

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

const input = { email: "Mila@Example.com", password: "night-shift-42", username: "mila", locale: "de" as const };

describe("LocalAccountStore", () => {
  it("signs up, starts a session and creates a starter page", async () => {
    const storage = memory();
    const store = new LocalAccountStore(() => storage);
    expect(store.getSnapshot().status).toBe("signedOut");
    expect(await store.signUp(input)).toEqual({ ok: true });
    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("signedIn");
    if (snapshot.status !== "signedIn") return;
    expect(snapshot.account.email).toBe("mila@example.com");
    expect(snapshot.site.page.profile).toMatchObject({ username: "mila", displayName: "mila", locale: "de" });
    expect(snapshot.site.page.profile.avatar.src).toBe(NO_IMAGE);
    expect(snapshot.site.onboarded).toBe(false);
    // The plain password is never stored.
    expect(storage.data.get(STORAGE_KEY)).not.toContain(input.password);
  });

  it("keeps the snapshot reference stable until something changes", async () => {
    const store = fresh();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    const shared = memory();
    const a = new LocalAccountStore(() => shared);
    await a.signUp(input);
    const first = a.getSnapshot();
    expect(a.getSnapshot()).toBe(first);
    a.updateSite((site) => ({ ...site, onboarded: true }));
    expect(a.getSnapshot()).not.toBe(first);
  });

  it("rejects taken, reserved and invalid usernames and duplicate emails", async () => {
    const store = fresh();
    await store.signUp(input);
    store.logOut();
    expect(await store.signUp({ ...input, email: "other@example.com" })).toEqual({ ok: false, error: "usernameTaken" });
    expect(await store.signUp({ ...input, username: "mila2" })).toEqual({ ok: false, error: "emailTaken" });
    expect(await store.signUp({ ...input, email: "x@example.com", username: "login" })).toEqual({ ok: false, error: "reservedUsername" });
    expect(await store.signUp({ ...input, email: "x@example.com", username: "Mila Aurel!" })).toEqual({ ok: false, error: "invalidUsername" });
    expect(await store.signUp({ ...input, email: "not-an-email", username: "mila3" })).toEqual({ ok: false, error: "invalidEmail" });
    expect(await store.signUp({ ...input, email: "y@example.com", username: "mila4", password: "short" })).toEqual({ ok: false, error: "weakPassword" });
  });

  it("logs in with the right password only, with one answer for unknown emails", async () => {
    const store = fresh();
    await store.signUp(input);
    store.logOut();
    expect(store.getSnapshot().status).toBe("signedOut");
    expect(await store.logIn({ email: input.email, password: "wrong-pass-1" })).toEqual({ ok: false, error: "invalidCredentials" });
    expect(await store.logIn({ email: "nobody@example.com", password: input.password })).toEqual({ ok: false, error: "invalidCredentials" });
    expect(await store.logIn({ email: " MILA@example.com ", password: input.password })).toEqual({ ok: true });
    expect(store.getSnapshot().status).toBe("signedIn");
  });

  it("resets and changes passwords", async () => {
    const store = fresh();
    await store.signUp(input);
    expect(await store.changePassword({ current: "nope-nope-1", next: "new-secret-77" })).toEqual({ ok: false, error: "wrongPassword" });
    expect(await store.changePassword({ current: input.password, next: "new-secret-77" })).toEqual({ ok: true });
    store.logOut();
    expect(await store.resetPassword({ email: input.email, password: "after-reset-9" })).toEqual({ ok: true });
    expect(await store.logIn({ email: input.email, password: "new-secret-77" })).toEqual({ ok: false, error: "invalidCredentials" });
    expect(await store.logIn({ email: input.email, password: "after-reset-9" })).toEqual({ ok: true });
  });

  it("renames the address everywhere and exports, then deletes everything", async () => {
    const store = fresh();
    await store.signUp(input);
    expect(store.changeUsername("mila-aurel")).toEqual({ ok: true });
    const snapshot = store.getSnapshot();
    expect(snapshot.status === "signedIn" && snapshot.site.page.profile.username).toBe("mila-aurel");
    const exported = JSON.parse(store.exportData()) as { account: { username: string; password?: unknown } };
    expect(exported.account.username).toBe("mila-aurel");
    expect(exported.account.password).toBeUndefined();
    store.deleteAccount();
    expect(store.getSnapshot().status).toBe("signedOut");
    expect(await store.logIn({ email: input.email, password: input.password })).toEqual({ ok: false, error: "invalidCredentials" });
  });

  it("reports a full storage instead of losing data silently", async () => {
    const storage = memory();
    const store = new LocalAccountStore(() => storage);
    await store.signUp(input);
    storage.full = true;
    expect(store.updateSite((site) => ({ ...site, onboarded: true }))).toEqual({ ok: false, error: "storageFull" });
  });
});

describe("password rules", () => {
  it("asks for 8+ characters, a letter and a non-letter, nothing personal", () => {
    expect(passwordChecks("abc")).toMatchObject({ length: false });
    expect(passwordChecks("abcdefgh")).toMatchObject({ length: true, mixed: false });
    expect(isStrongEnough("night-shift-42")).toBe(true);
    expect(isStrongEnough("mila-2026!", { username: "mila" })).toBe(false);
  });
});
