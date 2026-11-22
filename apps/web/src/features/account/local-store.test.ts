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
    // The first name is made from the address ("mila" → "Mila"); the welcome flow asks for the real one.
    expect(snapshot.site.page.profile).toMatchObject({ username: "mila", displayName: "Mila", locale: "de" });
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

describe("LocalAccountStore: the invite program (demo)", () => {
  interface Stored {
    referralCodes?: Record<string, string>;
    referrals?: { inviterId: string; inviteeId: string | null; state: string; reason?: string }[];
    rewards?: Record<string, Record<string, { at: string; revokedAt?: string }>>;
  }
  const stored = (storage: ReturnType<typeof memory>) => JSON.parse(storage.data.get(STORAGE_KEY) ?? "{}") as Stored;

  /** Signs a new account up (optionally through an invite link) and answers its id; it stays signed in. */
  async function join(store: LocalAccountStore, email: string, username: string, ref?: string) {
    store.logOut();
    expect(await withCode(store, { email, locale: "en", signUp: { username, ...(ref ? { ref } : {}) } })).toEqual({ ok: true });
    const snapshot = store.getSnapshot();
    return snapshot.status === "signedIn" ? snapshot.account.id : "";
  }
  async function signInAs(store: LocalAccountStore, email: string) {
    store.logOut();
    expect(await withCode(store, { email, locale: "en" })).toEqual({ ok: true });
  }
  const setUp = () => {
    const storage = memory();
    return { storage, store: new LocalAccountStore(() => storage) };
  };

  it("gives every new account a code and records an invite made with it", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    const code = stored(storage).referralCodes?.[ana] ?? "";
    expect(code).toMatch(/^[2-9a-hjkmnp-z]{8}$/);
    const ben = await join(store, "ben@example.com", "ben-ott", code);
    expect(stored(storage).referrals).toEqual([expect.objectContaining({ inviterId: ana, inviteeId: ben, state: "qualified" })]);
    // The invited person sees who invited them; the inviter sees one counted.
    expect((await store.referrals())?.invitedBy).toEqual({ name: "Ana Lund" });
    await signInAs(store, "ana@example.com");
    const overview = await store.referrals();
    expect(overview).toMatchObject({ code, counted: 1, rewards: {}, verification: null, invitedBy: null });
    expect(overview?.invited).toEqual([expect.objectContaining({ status: "counted", deleted: false, name: null })]);
  });

  it("ignores codes nobody has, and makes a code for accounts from before the program", async () => {
    const { storage, store } = setUp();
    await join(store, "ana@example.com", "ana-lund", "zzzzzzzz");
    expect(stored(storage).referrals ?? []).toEqual([]);
    const db = JSON.parse(storage.data.get(STORAGE_KEY) ?? "{}") as Stored;
    delete db.referralCodes;
    storage.data.set(STORAGE_KEY, JSON.stringify(db));
    const overview = await store.referrals();
    expect(overview?.code).toMatch(/^[2-9a-hjkmnp-z]{8}$/);
    expect((await store.referrals())?.code).toBe(overview?.code);
  });

  it("does not count the inviter's own mailbox (a +alias)", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "a@example.com", "ana-lund");
    await join(store, "a+1@example.com", "ana-two", stored(storage).referralCodes?.[ana]);
    expect(stored(storage).referrals).toEqual([expect.objectContaining({ state: "rejected", reason: "self" })]);
    await signInAs(store, "a@example.com");
    expect(await store.referrals()).toMatchObject({ counted: 0, invited: [expect.objectContaining({ status: "notCounted" })] });
  });

  it("writes the verification review at 3 counted invites and Pro for life at 10, once", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    const code = stored(storage).referralCodes?.[ana];
    for (let n = 1; n <= 2; n += 1) await join(store, `f${String(n)}@example.com`, `friend-${String(n)}`, code);
    expect(stored(storage).rewards?.[ana]).toBeUndefined();
    await join(store, "f3@example.com", "friend-3", code);
    expect(Object.keys(stored(storage).rewards?.[ana] ?? {})).toEqual(["verification_review"]);
    for (let n = 4; n <= 9; n += 1) await join(store, `f${String(n)}@example.com`, `friend-${String(n)}`, code);
    expect(Object.keys(stored(storage).rewards?.[ana] ?? {})).toEqual(["verification_review"]);
    await join(store, "f10@example.com", "friend-10", code);
    const first = stored(storage).rewards?.[ana];
    expect(Object.keys(first ?? {}).sort()).toEqual(["pro_for_life", "verification_review"]);
    await join(store, "f11@example.com", "friend-11", code);
    expect(stored(storage).rewards?.[ana]).toEqual(first);
    await signInAs(store, "ana@example.com");
    expect(await store.referrals()).toMatchObject({ counted: 11, rewards: { verification_review: { revoked: false }, pro_for_life: { revoked: false } } });
  });

  it("keeps counting a friend who deletes their account; deleting the inviter removes their invites", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    await join(store, "ben@example.com", "ben-ott", stored(storage).referralCodes?.[ana]);
    expect(await store.deleteAccount()).toEqual({ ok: true });
    await signInAs(store, "ana@example.com");
    expect(await store.referrals()).toMatchObject({ counted: 1, invited: [{ deleted: true, name: null, status: "counted" }] });
    expect(await store.deleteAccount()).toEqual({ ok: true });
    expect(stored(storage).referrals).toEqual([]);
    expect(stored(storage).referralCodes).toEqual({});
  });

  it("exports the program without the names of the people invited", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    await join(store, "ben@example.com", "ben-ott", stored(storage).referralCodes?.[ana]);
    store.updateSite((site) => ({ ...site, onboarded: true, page: { ...site.page, profile: { ...site.page.profile, displayName: "Bea Friend" } } }));
    await signInAs(store, "ana@example.com");
    // The inviter's screen shows the friend's page name once the page is set up …
    expect((await store.referrals())?.invited[0]?.name).toBe("Bea Friend");
    // … the export never does.
    const exported = await store.exportData();
    expect(exported).not.toContain("Bea Friend");
    expect(exported).not.toContain("ben@example.com");
    const { referrals } = JSON.parse(exported) as { referrals: { counted: number; invited: object[] } };
    expect(referrals.counted).toBe(1);
    expect(referrals.invited).toEqual([{ status: "counted", at: expect.any(String) as string }]);
  });

  it("answers a verification request as the database does: notUnlocked, ok, alreadyOpen, then tooSoon after a decline", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    const links = ["https://instagram.com/ana"];
    expect(await store.requestVerification({ links })).toEqual({ ok: false, error: "notUnlocked" });
    for (let n = 1; n <= 3; n += 1) await join(store, `f${String(n)}@example.com`, `friend-${String(n)}`, stored(storage).referralCodes?.[ana]);
    await signInAs(store, "ana@example.com");
    expect(await store.requestVerification({ links: ["http://instagram.com/ana"] })).toEqual({ ok: false, error: "invalidLinks" });
    expect(await store.requestVerification({ links: ["https://a.example/1", "https://a.example/2", "https://a.example/3", "https://a.example/4"] })).toEqual({ ok: false, error: "invalidLinks" });
    expect(await store.requestVerification({ links, note: "My only account" })).toEqual({ ok: true });
    expect(await store.requestVerification({ links })).toEqual({ ok: false, error: "alreadyOpen" });
    const request = store.teamQueue().verifications[0];
    expect(request).toMatchObject({ customerId: ana, username: "ana-lund", links, note: "My only account", state: "requested", invites: 3 });
    // Someone else on the team decides (here a friend's account stands in for a team member).
    await signInAs(store, "f1@example.com");
    expect(store.teamReview(request?.id ?? "", "decline")).toBe(false);
    expect(store.teamReview(request?.id ?? "", "decline", "identityUnclear")).toBe(true);
    await signInAs(store, "ana@example.com");
    expect(await store.requestVerification({ links })).toEqual({ ok: false, error: "tooSoon" });
    const verification = (await store.referrals())?.verification;
    expect(verification).toMatchObject({ state: "declined", declineReason: "identityUnclear" });
    expect(Date.parse(verification?.retryAt ?? "") - Date.parse(verification?.decidedAt ?? "")).toBe(7 * 86_400_000);
  });

  it("approving a request in the demo team console gives the page the blue check", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    for (let n = 1; n <= 3; n += 1) await join(store, `f${String(n)}@example.com`, `friend-${String(n)}`, stored(storage).referralCodes?.[ana]);
    await signInAs(store, "ana@example.com");
    expect(await store.requestVerification({ links: ["https://instagram.com/ana"] })).toEqual({ ok: true });
    const request = store.teamQueue().verifications[0];
    await signInAs(store, "f1@example.com");
    expect(store.teamReview(request?.id ?? "", "approve")).toBe(true);
    await signInAs(store, "ana@example.com");
    const snapshot = store.getSnapshot();
    expect(snapshot.status === "signedIn" && snapshot.site.page.profile.verified).toBe(true);
    expect(store.teamReview(request?.id ?? "", "approve")).toBe(false);
    expect(await store.requestVerification({ links: ["https://instagram.com/ana"] })).toEqual({ ok: false, error: "alreadyVerified" });
    expect(store.teamCustomer(ana)?.verifications).toEqual([expect.objectContaining({ state: "approved" })]);
  });

  it("never lets the signed-in account review its own request (as SQL's linkyo:notYourself)", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    for (let n = 1; n <= 3; n += 1) await join(store, `f${String(n)}@example.com`, `friend-${String(n)}`, stored(storage).referralCodes?.[ana]);
    await signInAs(store, "ana@example.com");
    expect(await store.requestVerification({ links: ["https://instagram.com/ana"] })).toEqual({ ok: true });
    const request = store.teamQueue().verifications[0]?.id ?? "";
    expect(store.teamReview(request, "approve")).toBe(false);
    expect(store.teamReview(request, "decline", "other")).toBe(false);
    expect(store.teamQueue().verifications).toEqual([expect.objectContaining({ id: request, state: "requested" })]);
    const snapshot = store.getSnapshot();
    expect(snapshot.status === "signedIn" && snapshot.site.page.profile.verified).toBe(false);
    // Another account can.
    await signInAs(store, "f1@example.com");
    expect(store.teamReview(request, "approve")).toBe(true);
  });

  it("counts one mailbox once per inviter, also after its account was deleted (repeat)", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    const code = stored(storage).referralCodes?.[ana];
    await join(store, "Bea.Friend@gmail.com", "bea-one", code);
    expect(await store.deleteAccount()).toEqual({ ok: true });
    // The same Gmail mailbox (dots and a +tag don't make it another one), through the same link.
    await join(store, "beafriend+again@googlemail.com", "bea-two", code);
    expect(stored(storage).referrals).toEqual([
      expect.objectContaining({ inviteeId: null, state: "qualified" }),
      expect.objectContaining({ inviterId: ana, state: "rejected", reason: "repeat" }),
    ]);
    expect(store.teamCustomer(ana)?.counted).toBe(1);
    expect(store.teamCustomer(ana)?.invited).toEqual(
      expect.arrayContaining([expect.objectContaining({ state: "rejected", reason: "repeat" }), expect.objectContaining({ state: "qualified", inviteeId: null })]),
    );
    // While an earlier account of that mailbox still exists, another alias is a repeat as well.
    await join(store, "bea.friend+third@gmail.com", "bea-three", code);
    expect(store.teamCustomer(ana)?.counted).toBe(1);
    // Per inviter: someone else's link still counts that mailbox.
    const cid = await join(store, "cid@example.com", "cid-lund");
    await join(store, "b.e.a.friend@gmail.com", "bea-four", stored(storage).referralCodes?.[cid]);
    expect(store.teamCustomer(cid)).toMatchObject({ counted: 1, invited: [{ state: "qualified", reason: null }] });
  });

  it("lets the demo team remove and restore an invite or a reward; a removed reward is not given again", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    const code = stored(storage).referralCodes?.[ana];
    for (let n = 1; n <= 3; n += 1) await join(store, `f${String(n)}@example.com`, `friend-${String(n)}`, code);
    const invite = store.teamCustomer(ana)?.invited[0]?.id ?? "";
    expect(store.teamSetReferral(invite, "revoked")).toBe("qualified");
    expect(store.teamCustomer(ana)).toMatchObject({ counted: 2, rewards: { verification_review: { source: "referrals", revokedAt: null } } });
    expect(store.teamSetReferral(invite, "qualified")).toBe("revoked");
    expect(store.teamSetReward(ana, "verification_review", false, "abuse")).toBe(true);
    expect(store.teamSetReward(ana, "verification_review", false)).toBe(false);
    await join(store, "f4@example.com", "friend-4", code);
    expect(store.teamCustomer(ana)?.rewards.verification_review).toMatchObject({ reason: "abuse", revokedAt: expect.any(String) as string });
    expect(store.teamQueue().rewards).toEqual([expect.objectContaining({ customerId: ana, kind: "verification_review", counted: 4 })]);
    expect(store.teamSetReward(ana, "verification_review", true)).toBe(true);
    expect(store.teamCustomer(ana)?.rewards.verification_review?.revokedAt).toBeNull();
    expect(store.teamCustomer("nobody")).toBeNull();
  });

  it("tells the sign-up page who invited: the page name once it is set up, nothing for an unknown code", async () => {
    const { storage, store } = setUp();
    const ana = await join(store, "ana@example.com", "ana-lund");
    const code = stored(storage).referralCodes?.[ana] ?? "";
    expect(await store.referralInviter("zzzzzzzz")).toBeNull();
    expect(await store.referralInviter(code)).toEqual({ name: null });
    store.updateSite((site) => ({ ...site, onboarded: true }));
    expect(await store.referralInviter(code.toUpperCase())).toEqual({ name: "Ana Lund" });
  });
});

describe("sixDigits", () => {
  it("is always six digits", () => {
    for (let i = 0; i < 200; i += 1) expect(sixDigits()).toMatch(/^\d{6}$/);
  });
});
