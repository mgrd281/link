import type { AccountSnapshot } from "@/features/account/types";

/** What the website's header shows of a signed-in visitor: a name for the avatar and its picture. */
export interface HeaderAccount {
  name: string;
  avatar: string | undefined;
}

/** The account store as the header reads it (structural: `accountStore`). */
export interface HeaderStore {
  getSnapshot(): AccountSnapshot;
  subscribe(listener: () => void): unknown;
}

/**
 * Real accounts keep their session in a first-party cookie (`sb-<project>-auth-token`, split into
 * `.0`, `.1` when long). Without it nobody is signed in, and the account code is not even loaded.
 */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;

/**
 * A picture the header may show as it is: one of Linkyo's own files or one made in this browser.
 * Anything on another server shows initials instead (the website loads nothing from third parties).
 */
const ownPicture = (src: string | undefined): string | undefined => (src && /^(?:\/(?!\/)|data:image\/|blob:)/.test(src) ? src : undefined);

/**
 * The visitor's session for the website's header, read after the first paint. `value` is `undefined`
 * until it is known (the server and the first paint show the signed-out header), then `null` or the
 * account. The account store loads on demand: in a demo build always (the session lives in this
 * browser), with real accounts only once the session cookie is there, so visitors without an
 * account download none of it.
 *
 * "No cookie" is never final: a visitor who signs in moves on inside the same document (client-side
 * links, `router.replace` after the code) and comes back to the website with the router cache or
 * Back. So `refresh()` looks again on every header mount and when the page is shown again, until the
 * cookie is there and the store, which then follows sign-in and sign-out itself, is loading.
 */
export function createHeaderSession(deps: { realAccounts: boolean; cookie: () => string; load: () => Promise<HeaderStore> }) {
  const listeners = new Set<() => void>();
  let value: HeaderAccount | null | undefined;
  let loading = false;

  const set = (next: HeaderAccount | null) => {
    const same = next === null ? value === null : value?.name === next.name && value.avatar === next.avatar;
    if (same) return;
    value = next;
    for (const listener of listeners) listener();
  };

  const read = (store: HeaderStore) => {
    const snapshot = store.getSnapshot();
    if (snapshot.status === "signedIn") {
      const profile = snapshot.site.page.profile;
      // A new account may have no name or address yet: then the first part of its e-mail.
      const name = profile.displayName.trim() || snapshot.account.username || (snapshot.account.email.split("@")[0] ?? "");
      set({ name, avatar: ownPicture(profile.avatar.src) });
    } else if (snapshot.status === "signedOut") set(null);
  };

  const refresh = () => {
    if (loading) return;
    if (deps.realAccounts && !SESSION_COOKIE.test(deps.cookie())) {
      set(null);
      return;
    }
    loading = true;
    deps.load().then(
      (store) => {
        store.subscribe(() => {
          read(store);
        });
        read(store);
      },
      () => {
        // The code could not be loaded (offline): signed out for now, and the next mount tries again.
        loading = false;
        set(null);
      },
    );
  };

  return {
    get value() {
      return value;
    },
    refresh,
    subscribe(listener: () => void) {
      listeners.add(listener);
      refresh();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
