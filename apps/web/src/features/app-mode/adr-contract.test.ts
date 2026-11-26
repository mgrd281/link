import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEVICE_ID } from "@/features/account/server/auth";
import { isOwnMedia } from "@/app/api/app/page/ops";

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
/** Auth's codes for a session that is gone: a refresh refused with one of them wipes the device. */
const WIPE_CODES = ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "user_not_found", "session_expired", "user_banned"];

/** The part of a document from `from` to `to` (both must be there). */
function part(text: string, from: string, to: string): string {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start + from.length);
  expect(start, from).toBeGreaterThanOrEqual(0);
  expect(end, to).toBeGreaterThan(start);
  return text.slice(start, end);
}

/** The rows of the first Markdown table in `text` (header and divider left out), as their cells (no `|` inside one). */
function tableRows(text: string): string[][] {
  const lines = text.split("\n").map((line) => line.trim());
  const start = lines.findIndex((line) => line.startsWith("|"));
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.slice(1, -1).split("|").map((cell) => cell.trim()));
  }
  return rows;
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
    // Only a token Auth turned down with its own code is a 401; Auth that could not answer, or anything
    // else that answered (a gateway, a firewall), is a 503 the app retries (lib/server/user.ts `outage`).
    expect(source("app/api/auth/handoff/route.ts")).toContain('requireUser(request, { outage: "unavailable" })');
    expect(text).toMatch(/\| 503 \| `unavailable` \|[^\n]*never signs out on it/);
    for (const code of ["bad_jwt", "session_not_found", "user_not_found", "no_authorization"]) {
      expect(source("lib/server/user.ts"), code).toContain(`"${code}"`);
      expect(text, code).toContain(`\`${code}\``);
    }
    expect(text).toMatch(/\| 503 \| `unavailable` \|[^\n]*"Invalid API key"/);
  });

  it("the hand-off: a 401 is answered with one refresh, and only a refused refresh wipes the device (plan §1.2 step 9)", () => {
    const text = handoff();
    expect(text).toContain("**A 401 is answered with one refresh, never a wipe by itself.**");
    expect(text).toMatch(/refreshes its session once[\s\S]*?and repeats the call/);
    expect(text).toMatch(/wipes the device \*\*only\*\* when that\s+refresh is refused with a wipe code/);
    // What Auth really answers (Auth v2.197.0): the request, where the code is, and every wipe code. A
    // client reading OAuth's `error` (`invalid_grant`) or a numeric `code` would never match and retry a
    // dead session forever.
    const wipe = part(text, "**A 401 is answered with one refresh, never a wipe by itself.**", "A 401 right after");
    expect(wipe).toMatch(/`POST \/auth\/v1\/token\?grant_type=refresh_token` with the headers `apikey` and\s+`X-Supabase-Api-Version: 2024-01-01`/);
    expect(wipe).toMatch(/the string in the answer's `code` field\. Without the version header `code` is the number\s+400 and the string is in `error_code`/);
    expect(wipe).toMatch(/never sends OAuth's `error` field, nor `invalid_grant`/);
    expect(wipe).toMatch(/a sign-out, a device sign-out, a suspension and a\s+deletion all answer 400 `refresh_token_not_found`/);
    for (const code of WIPE_CODES) expect(wipe, code).toContain(`\`${code}\``);
    const cell = tableRows(part(text, "| Status | `error` | When | App does |", "- The link is single-use")).find(([status, error]) => status === "401" && error === "`unauthorized`");
    for (const code of WIPE_CODES) expect(cell?.[3], code).toContain(`\`${code}\``);
    expect(cell?.[3]).not.toContain("invalid_grant");
    expect(text).toMatch(/A 401\s+right after a successful refresh is treated like a 503 \(try again later, never wipe\)/);
    for (const route of ["`/api/auth/handoff`", "`/api/app/page`", "any other Bearer route"]) expect(text, route).toContain(route);
    // ADR 0087's checklist for the app says the same.
    const shell = part(MODE, "**For the native shell.**", "**Consequences.**");
    expect(shell).toContain("**A 401 is answered with one refresh, never a wipe by itself**");
    expect(shell).toMatch(/\(`POST \/auth\/v1\/token\?grant_type=refresh_token` with `X-Supabase-Api-Version: 2024-01-01`\) is refused with\s+a wipe code, the string in the answer's `code` \(in `error_code` when the header is missing\)/);
    expect(shell).toMatch(/a sign-out, a device sign-out, a suspension and a deletion all answer 400\s+`refresh_token_not_found`/);
    for (const code of WIPE_CODES) expect(shell, code).toContain(`\`${code}\``);
    expect(shell).toMatch(/a 401 right after a\s+successful refresh is treated like a 503/);
  });

  it("the hand-off: what the app does with every answer, and the bounded loop on the login page", () => {
    const rows = tableRows(part(handoff(), "| Status | `error` | When | App does |", "- The link is single-use"));
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const [status = "", error = "", , does = ""] of rows) {
      const answer = `${status} ${error}`;
      expect(does.length, answer).toBeGreaterThan(10);
      if (status === "422") expect(does, answer).toMatch(/an app bug: reports it; no retry/);
      if (status === "503" || status === "502") expect(does, answer).toMatch(/tries again later with a growing pause/);
      if (error === "`suspended`") expect(does, answer).toMatch(/native "account suspended" screen and stops handing off/);
      if (error === "`blocked`") expect(does, answer).toMatch(/native error view[^|]*no retry loop/);
      if (status === "409") expect(does, answer).toMatch(/native error view; no retry/);
      if (status === "401") expect(does, answer).toMatch(/refreshes its session once/);
    }
    const loop = handoff();
    expect(loop).toContain("**The hand-off loop is bounded.**");
    expect(loop).toMatch(/at most once per landing there/);
    expect(loop).toMatch(/`\/<locale>\/login\?link=retry`[^.]*and\s+`\/<locale>\/login\?link=expired`[^.]*get that one automatic hand-off/);
    expect(loop).toMatch(/`\/<locale>\/login\?link=suspended` gets none/);
    expect(loop).toMatch(/After two\s+failed hand-offs in a row within about a minute[^.]*native error view with "Try again"/);
  });

  it("the confirm route never answers suspended for a failed read: ?link=retry, in de, en and ar", () => {
    const confirm = source("app/api/auth/confirm/route.ts");
    expect(confirm).toMatch(/if \(readError\) \{[\s\S]*?link=retry/);
    for (const route of ["verify", "password"]) expect(source(`app/api/auth/${route}/route.ts`), route).toMatch(/if \(readError\) \{[\s\S]*?fail\("serverError", 502\)/);
    const text = handoff();
    expect(text).toContain("The confirm route never answers `suspended` for a\n     failed read");
    // A failed read ends only the session just opened (scope local), so the app's own session survives
    // `link=retry`; a suspended account loses every session (auth-js's default scope, global).
    for (const route of ["confirm", "verify", "password"]) {
      const code = source(`app/api/auth/${route}/route.ts`);
      expect(code, route).toMatch(/if \(readError\) \{[\s\S]*?admin\.signOut\(data\.session\.access_token, "local"\)[\s\S]*?return/);
      expect(code, route).toMatch(/if \(profile\?\.status !== "active"\) \{[^}]*admin\.signOut\(data\.session\.access_token\)\./);
    }
    expect(text).toMatch(/it ends only the session the token just opened \(`admin\.signOut\(token, "local"\)`[^)]*\), so the account's other sessions, the app's own native session among them, stay/);
    expect(text).toMatch(/only the session just opened ended, scope `local`, so\s+no other device of the account is signed out/);
    expect(text).toMatch(/it ends every session of the account \(`admin\.signOut\(token\)`, scope `global`: an account that is not\s+active loses every session\)/);
    expect(text).toContain("`/<locale>/login?link=retry`");
    expect(text).toContain("`auth.errors.linkRetry`");
    expect(source("features/account/auth/login-form.tsx")).toContain('link === "retry" ? "linkRetry"');
  });

  it("the page operations: every error name, every extra field and the input limits", () => {
    const names = [...errorNames(source("app/api/app/page/route.ts")), ...errorNames(source("app/api/app/page/ops.ts")), ...errorNames(source("lib/server/user.ts"))];
    expect(names).toEqual(expect.arrayContaining(["invalidJson", "tooManyOps", "invalidBody", "badUrl", "badImage", "badIndex", "unknownBlock", "ambiguousBlock", "invalidPage", "conflict", "pageTooLarge", "tooLarge", "notFound"]));
    const text = page();
    for (const name of names) expect(text, name).toContain(`\`${name}\``);
    for (const field of ["max", "path", "op", "id", "problems", "updatedAt"]) expect(text, field).toContain(`\`${field}\``);
    for (const status of ["400", "401", "403", "404", "409", "413", "422", "502", "503"]) expect(text, status).toContain(`| ${status} |`);
    expect(source("app/api/app/page/route.ts")).toContain('requireUser(request, { outage: "unavailable" })');
    expect(text).toMatch(/\| 503 \| `unavailable` \| \|[^\n]*never signs out on it/);
    for (const limit of ["1 to 20", "at most 300", "from 1 to 8192", "below the number of blocks"]) expect(text, limit).toContain(limit);
  });

  it("the page operations: what the app does with every answer", () => {
    const rows = tableRows(part(SYNC, "| Status | `error` | Extra fields | When | App does |", "3. **The save guard"));
    expect(rows.length).toBeGreaterThanOrEqual(18);
    for (const [status = "", error = "", , , does = ""] of rows) {
      const answer = `${status} ${error}`;
      expect(does.length, answer).toBeGreaterThan(10);
      if (status === "422") expect(does, answer).toMatch(/no retry/);
      if (status === "503" || status === "502") expect(does, answer).toMatch(/tries again later with a growing pause/);
      if (status === "404") expect(does, answer).toMatch(/loads the dashboard again/);
      if (error === "`suspended`") expect(does, answer).toMatch(/native "account suspended" screen/);
      if (error === "`unavailable`" && status === "409") expect(does, answer).toMatch(/native error view; no retry/);
      if (error === "`conflict`") expect(does, answer).toMatch(/`reload\(\)`/);
      if (status === "401") expect(does, answer).toMatch(/refreshes its session once/);
    }
    for (const status of ["200", "400", "401", "403", "404", "409", "413", "422", "502", "503"]) expect(rows.some(([cell]) => cell === status), status).toBe(true);
  });

  it("addImage: the exact address, uid and uuid in lowercase, never .jpeg; the server stays strict", () => {
    const text = page();
    expect(text).toContain("`<SUPABASE_URL>/storage/v1/object/public/media/<uid>/<yyyy>/<uuid>.<jpg|webp|png>`");
    expect(text).toContain("`UUID().uuidString.lowercased()`");
    expect(text).toMatch(/never `\.jpeg`/);
    const storage = "https://project.supabase.co";
    const owner = "0f4c5a3e-1111-4222-8333-444455556666";
    const at = (uid: string, file: string) => `${storage}/storage/v1/object/public/media/${uid}/2026/${file}`;
    const uuid = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
    expect(isOwnMedia(at(owner, `${uuid}.jpg`), owner, storage)).toBe(true);
    for (const wrong of [at(owner, `${uuid.toUpperCase()}.jpg`), at(owner, `${uuid}.JPG`), at(owner, `${uuid}.jpeg`), at(owner.toUpperCase(), `${uuid}.jpg`)]) {
      expect(isOwnMedia(wrong, owner, storage), wrong).toBe(false);
    }
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
    // What the app reads is the bare reason, as the message and as the string form, not "Error: saveFailed",
    // through its own wrapper (ADR 0087 "For the native shell" item 1), not WebKit's private error key.
    expect(bridge).toMatch(/class BridgeRejection extends Error[\s\S]*toString\(\): string \{\s*return this\.message;/);
    expect(text).toMatch(/the app reads it\s+through its own wrapper/);
    expect(text).not.toContain("`userInfo[WKJavaScriptExceptionMessage]`");
    // saveFailed is also a refused save whose read-back failed; a slow network is no failure.
    expect(text).toMatch(/\| `saveFailed` \|[^\n]*a refused save could not be read back[^\n]*A slow network is no failure/);
  });

  it("says the methods exist only on dashboard pages, and how the app tells its own sign-out from the others", () => {
    const text = half();
    expect(text).toContain("**Only on dashboard pages.**");
    expect(text).toContain("waits for the `ready` that follows");
    expect(text).toMatch(/calls `reload\(\)` after that `ready`/);
    // Off the dashboard the methods are missing (a TypeError), and the last route is stale there.
    expect(text).toContain("Off the dashboard none of the five");
    expect(text).not.toMatch(/(?<!On a dashboard page )`navigate\(\)` and `back\(\)` never reject/);
    expect(text).toMatch(/never from the last `route`/);
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
    // Where the web view is: WKWebView.url, never the last route (a router link off the dashboard sends nothing).
    expect(text).not.toContain("its last `route`, or `WKWebView.url`");
    expect(text).toMatch(/on the dashboard by `WKWebView.url`, which it observes with KVO/);
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
      "try { return {ok:true, value: await window.linkyoApp.flush()} } catch (e) { return {ok:false, reason: String(e && e.message || e)} }",
      "**Where the web view is: `WKWebView.url`.**",
      "**A 401 is answered with one refresh, never a wipe by itself**",
    ]) {
      expect(shell(), words).toContain(words);
    }
    expect(shell()).not.toContain("an error whose message is the reason");
    // WebKit's private key is named only to say the app does not use it.
    expect(shell()).not.toContain("the reason is in `userInfo[WKJavaScriptExceptionMessage]`");
    expect(shell()).toContain("`userInfo[WKJavaScriptExceptionMessage]` is not part of the contract");
    // accountId: a lowercase UUID string, compared case-insensitively (Swift's uuidString is upper case).
    expect(shell()).toMatch(/`accountId` is the account's UUID as a \*\*lowercase\*\* string/);
    expect(shell()).toMatch(/compares it case-insensitively/);
  });
});

describe("ADR 0088: only a hidden tab reads the row quickly; a tab on screen waits for a slow network", () => {
  it("§3 and 'What a browser user notices' say so, as the store does", () => {
    const guard = part(SYNC, "3. **The save guard", "4. **The store half");
    expect(guard).toContain("**Only a hidden tab reads this way**");
    expect(guard).toContain("**A tab on screen reads as every read does**");
    expect(guard).toMatch(/not for a slower read-back that started while it was on screen/);
    expect(guard).toMatch(/\*\*reads the row again instead of sending the save\*\*/);
    expect(guard).toContain("had not landed by the time of the read");
    expect(guard).not.toContain("cannot land any more");
    expect(guard).toMatch(/\*\*Accepted, not covered:\*\* a resolved write that commits\s+only after that read/);
    const notice = part(SYNC, "**What a browser user notices.**", "**Consequences.**");
    expect(notice).toMatch(/also on a slow network: the toast comes\s+when the read-back does/);
    const store = source("features/account/supabase-store.ts");
    // The quick read (one attempt, aborted after READ_BACK_LIMIT) is taken only when the page is hidden.
    expect(store).toMatch(/private async readRow\(id: string, quick = pageHidden\(\)\)/);
    expect(store).toMatch(/if \(!quick\) return await query\.maybeSingle\(\);/);
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
