import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEVICE_ID } from "@/features/account/server/auth";

import { BRIDGE_VERSION } from "./bridge";

/**
 * The native developer works from ADR 0087 and 0088 alone: they must say what the code answers. These
 * read the routes, the store and the bridge, and fail when an answer, a reason or a rule the app needs is
 * missing from the decision that documents it.
 */

const ROOT = path.resolve(import.meta.dirname, "../../../../..");
const WEB = path.join(ROOT, "apps/web/src");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const source = (file: string) => readFileSync(path.join(WEB, file), "utf8");
const MODE = read("docs/DECISIONS/0087-app-mode.md");
const SYNC = read("docs/DECISIONS/0088-app-sync.md");

/** The part of a document from `from` to `to` (both must be there). */
function part(text: string, from: string, to: string): string {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start + from.length);
  expect(start, from).toBeGreaterThanOrEqual(0);
  expect(end, to).toBeGreaterThan(start);
  return text.slice(start, end);
}

/** Every error name a file can answer: the quoted words after `error:` (a value, a choice or a type). */
function errorNames(text: string): string[] {
  const names = new Set<string>();
  for (const [, value = ""] of text.matchAll(/\berror:\s*([^,;}\n]+)/g)) {
    for (const [, name = ""] of value.matchAll(/"(\w+)"/g)) if (name !== "next") names.add(name);
  }
  return [...names].sort();
}

describe("ADR 0088 answers what the two routes answer", () => {
  const handoff = () => part(SYNC, "1. **Hand-off", "2. **Page operations");
  const page = () => part(SYNC, "2. **Page operations", "3. **The save guard");

  it("the hand-off: every error name, and the device id in lowercase hex", () => {
    const names = [...errorNames(source("app/api/auth/handoff/route.ts")), ...errorNames(source("lib/server/user.ts"))];
    expect(names).toEqual(expect.arrayContaining(["invalidDevice", "invalidNext", "unauthorized", "suspended", "blocked", "unavailable", "serverError"]));
    const text = handoff();
    for (const name of names) expect(text, name).toContain(`\`${name}\``);
    expect(DEVICE_ID.source).toBe("^dev_[0-9a-f]{12}$");
    expect(text).toMatch(/12 \*\*lowercase\*\* hex digits/);
    // A `next` that is no string or too long is refused; one with a query falls back.
    expect(text).toContain("at most 200");
    expect(text).toMatch(/query[^.]*`navigate\(\)`/);
    // Only a token Auth turned down is a 401, on which the app signs out and wipes the device; Auth that
    // could not answer is a 503 the app retries (lib/server/user.ts `outage`, both app routes ask for it).
    expect(source("app/api/auth/handoff/route.ts")).toContain('requireUser(request, { outage: "unavailable" })');
    expect(text).toMatch(/\| 503 \| `unavailable` \|[^\n]*never sign out on it/);
    expect(text).toContain("Only a 401 does");
  });

  it("the page operations: every error name, every extra field and the input limits", () => {
    const names = [...errorNames(source("app/api/app/page/route.ts")), ...errorNames(source("app/api/app/page/ops.ts")), ...errorNames(source("lib/server/user.ts"))];
    expect(names).toEqual(expect.arrayContaining(["invalidJson", "tooManyOps", "invalidBody", "badUrl", "badImage", "badIndex", "unknownBlock", "ambiguousBlock", "invalidPage", "conflict", "pageTooLarge", "tooLarge", "notFound"]));
    const text = page();
    for (const name of names) expect(text, name).toContain(`\`${name}\``);
    for (const field of ["max", "path", "op", "id", "problems", "updatedAt"]) expect(text, field).toContain(`\`${field}\``);
    for (const status of ["400", "401", "403", "404", "409", "413", "422", "502", "503"]) expect(text, status).toContain(`| ${status} |`);
    expect(source("app/api/app/page/route.ts")).toContain('requireUser(request, { outage: "unavailable" })');
    expect(text).toMatch(/\| 503 \| `unavailable` \| \|[^\n]*never sign out on it/);
    for (const limit of ["1 to 20", "at most 300", "from 1 to 8192", "below the number of blocks"]) expect(text, limit).toContain(limit);
  });
});

describe("ADR 0088 §4 names every reason a bridge method rejects with", () => {
  const half = () => part(SYNC, "4. **The store half of the bridge**", "**Limits.**");

  it("the store's half, flush and reload, and the save errors they pass on", () => {
    const bridge = source("features/app-mode/store-bridge.ts");
    const store = source("features/account/supabase-store.ts");
    const types = source("features/account/types.ts");
    const reasons = new Set<string>();
    // `until(store, …, reason, limit)`: the reason is the string right before the wait.
    for (const [, reason = ""] of bridge.matchAll(/"(\w+)", (?:READY_WAIT|SIGN_OUT_WAIT)\b/g)) reasons.add(reason);
    for (const [, reason = ""] of store.matchAll(/new Error\((?:[^)]*?\?\? )?"(\w+)"\)/g)) reasons.add(reason);
    for (const [, union = ""] of types.matchAll(/syncError\?: ([^;]+);/g)) for (const [, reason = ""] of union.matchAll(/"(\w+)"/g)) reasons.add(reason);
    expect([...reasons].sort()).toEqual(["reloadFailed", "saveFailed", "signOutTimeout", "storeLoading", "tooLarge"]);
    const text = half();
    for (const reason of reasons) expect(text, reason).toContain(`| \`${reason}\` |`);
    // What the app reads is the rejection's string form: the bare reason, not "Error: saveFailed".
    expect(bridge).toMatch(/class BridgeRejection extends Error[\s\S]*toString\(\): string \{\s*return this\.message;/);
    expect(text).toContain("`userInfo[WKJavaScriptExceptionMessage]`");
  });

  it("says the methods exist only on dashboard pages, and how the app tells its own sign-out from the others", () => {
    const text = half();
    expect(text).toContain("**Only on dashboard pages.**");
    expect(text).toContain("waits for the `ready` that follows");
    expect(text).toMatch(/calls `reload\(\)` after that `ready`/);
    expect(SYNC).toContain("**not while the app signs out itself.**");
    expect(SYNC).toContain("**a `signedOut` the app did not cause**");
  });
});

describe("ADR 0087 records the order, the dashboard-only methods and what the native shell must do", () => {
  const bridge = () => part(MODE, "4. **The bridge, contract version 1.**", "5. **The editor's deep link.**");
  const shell = () => part(MODE, "**For the native shell.**", "**Consequences.**");

  it("decision 4: ready first, then route, then saveState; navigate takes dashboard paths only; five methods only on the dashboard", () => {
    const text = bridge();
    expect(text).toContain("**The order of the messages.** `ready` is always the first message after the dashboard mounts");
    expect(text).toContain("`navigate(path)`: a dashboard path");
    expect(text).toContain("**All five exist only while a dashboard page (`/<locale>/app/…`) is shown.**");
    expect(text).toContain(`\`BRIDGE_VERSION\` = ${String(BRIDGE_VERSION)}`);
    // The app brings the web view back with goBack(): a page restored from the back/forward cache sends
    // ready, route and saveState again, as the island does on `pageshow` with `persisted`.
    expect(source("features/app-mode/app-mode-island.tsx")).toMatch(/addEventListener\("pageshow"/);
    expect(text).toMatch(/each time the browser restores a dashboard page from its back\/forward cache/);
    expect(text).toMatch(/Each mount, and each restore from the\s+back\/forward cache, sends all three again/);
  });

  it("decision 1: the app's object is plain and extensible, and a frozen one never breaks the dashboard", () => {
    expect(part(MODE, "1. **The signal", "2. **What app mode hides")).toContain("**The app's object is a plain, extensible object.**");
  });

  it("the native shell: one content world, all five after ready, the account checked, a timeout, versions, conflict, mime parameters, ?edit=", () => {
    for (const words of [
      "`WKContentWorld.page`",
      "`forMainFrameOnly: true`",
      "`injectionTime: .atDocumentStart`",
      "`callAsyncJavaScript(_:arguments:in:in:)`",
      "**After `ready`, all five methods are there**",
      "**`ready.accountId` is checked.**",
      "**`ready` may never come**",
      `\`ready.bridge\` is the web's contract version (\`BRIDGE_VERSION\`, ${String(BRIDGE_VERSION)})`,
      "`conflict` stays the last state",
      "`text/csv;charset=utf-8`",
      "**`?edit=` and `?tab=` after the hand-off.**",
      "the reason is in `userInfo[WKJavaScriptExceptionMessage]`",
    ]) {
      expect(shell(), words).toContain(words);
    }
    expect(shell()).not.toContain("an error whose message is the reason");
  });
});

describe("ADR 0088 tells a browser user the truth about phones", () => {
  it("'What a browser user notices' names the phone that freezes and ends a hidden page", () => {
    const notice = part(SYNC, "**What a browser user notices.**", "**Consequences.**");
    expect(notice).toMatch(/phone freezes and\s+ends within 3 s of hiding it/);
    // The read-back's limit as the store has it (`READ_BACK_LIMIT`): a hidden tab's keepalive goes then at the latest.
    const store = source("features/account/supabase-store.ts");
    const limit = Number((/export const READ_BACK_LIMIT = ([\d_]+);/.exec(store)?.[1] ?? "").replaceAll("_", "")) / 1000;
    expect(limit).toBeGreaterThan(0);
    const seconds = String(limit).replace(".", "\\.");
    expect(notice).toMatch(new RegExp(`within ${seconds} s while a lost answer's read hangs`));
    expect(notice).toMatch(new RegExp(`hidden\\*\\*\\s+whose lost answer no read could resolve in ${seconds} s`));
    expect(part(SYNC, "3. **The save guard", "4. **The store half")).toMatch(new RegExp(`at most\\s+${seconds} s \\(\`READ_BACK_LIMIT\`\\)`));
  });
});
