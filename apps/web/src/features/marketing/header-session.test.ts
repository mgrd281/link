import { describe, expect, it, vi } from "vitest";

import type { AccountSnapshot } from "@/features/account/types";

import { createHeaderSession, type HeaderStore } from "./header-session";

const signedIn = { status: "signedIn", account: { username: "mila", email: "mila@example.com" }, site: { page: { profile: { displayName: "Mila Berg", avatar: { src: "/avatars/mila.webp" } } } } } as unknown as AccountSnapshot;

/** A store that starts signed in and can be told to sign out. */
function fakeStore(initial: AccountSnapshot = signedIn) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const store: HeaderStore = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => listeners.add(listener),
  };
  return {
    store,
    change(next: AccountSnapshot) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the website header's session", () => {
  it("real accounts without the cookie: signed out, and the account code is not loaded", async () => {
    const load = vi.fn(() => Promise.resolve(fakeStore().store));
    const session = createHeaderSession({ realAccounts: true, cookie: () => "theme=dark", load });
    session.subscribe(() => undefined);
    await settle();
    expect(session.value).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("does not stay signed out once the visitor signs in within the same document (W-07)", async () => {
    let cookie = "";
    const { store } = fakeStore();
    const load = vi.fn(() => Promise.resolve(store));
    const session = createHeaderSession({ realAccounts: true, cookie: () => cookie, load });
    const stop = session.subscribe(() => undefined);
    await settle();
    expect(session.value).toBeNull();
    stop();

    // Sign-in sets the session cookie; the header mounts again (Back, or a client-side link).
    cookie = "sb-abcd-auth-token.0=base64-xyz";
    const seen = vi.fn();
    session.subscribe(seen);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(session.value).toEqual({ name: "Mila Berg", avatar: "/avatars/mila.webp" });
    expect(seen).toHaveBeenCalled();

    // Later mounts reuse the loaded store, which follows sign-out by itself.
    session.subscribe(() => undefined);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("follows the store: signing out shows the signed-out header", async () => {
    const fake = fakeStore();
    const session = createHeaderSession({ realAccounts: false, cookie: () => "", load: () => Promise.resolve(fake.store) });
    session.subscribe(() => undefined);
    await settle();
    expect(session.value?.name).toBe("Mila Berg");
    fake.change({ status: "signedOut" });
    expect(session.value).toBeNull();
  });

  it("shows no picture from another server, and tries the code again after a failed load", async () => {
    const remote = { ...signedIn, site: { page: { profile: { displayName: "", avatar: { src: "https://tracker.example/a.jpg" } } } } } as unknown as AccountSnapshot;
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(fakeStore(remote).store);
    const session = createHeaderSession({ realAccounts: false, cookie: () => "", load });
    session.subscribe(() => undefined);
    await settle();
    expect(session.value).toBeNull();
    session.refresh();
    await settle();
    expect(session.value).toEqual({ name: "mila", avatar: undefined });
  });
});
