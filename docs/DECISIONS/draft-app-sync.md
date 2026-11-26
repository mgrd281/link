# draft — The iPhone app and the web dashboard share one page safely

**Status.** Proposed (iOS web part B, 2026-11-26; the lead numbers it). Builds on PLAN.md D2–D5 (`audit/ios`). Pairs
with `draft-app-mode.md` (app mode and the interface half of the bridge).

**Context.** The iPhone app signs in natively (`/api/auth/code` → `/api/auth/verify`, or `/api/auth/password`) and
keeps its session in the Keychain. Its deep screens are the web dashboard in one WKWebView. Its native screens
(Home, Add, the block list, the share extension) change the page themselves. The page is one JSON row (`sites`),
which the web store loaded once and saved whole with no version check, so a native write and the web view's next
autosave silently undid each other, and so did two browser tabs. Supabase rotates refresh tokens and revokes a
session whose spent token comes back after the 10 s reuse window (`supabase/config.toml`), so the app and its web
view cannot share one session.

**Decision.**

1. **Hand-off: the web view gets a second session of its own** (`POST /api/auth/handoff`).
   - Bearer only: the app's access token in `Authorization`; no cookie is read, so no other site can use the route
     (no CSRF). `Cache-Control: no-store`.
   - `requireUser`, then the checks `/api/auth/verify` makes at sign-in: a blocked address or an account that is not
     active gets 403 and no link. Then `auth.admin.generateLink({ type: "magiclink" })` for the account's own
     address. It sends no e-mail.
   - Body `{ deviceId, next? }`. `deviceId` must be `dev_<12 hex>`, the form a browser keeps
     (`DEVICE_ID`, `features/account/server/auth.ts`); anything else is 422. `next` passes `safePath` and must be a
     dashboard path (`/<locale>/app…`), else the account's language's `/app`.
   - Answer `{ ok, url }`: a relative `/api/auth/confirm?token_hash=…&type=magiclink&next=…&device=<deviceId>`. The
     web view opens it; the existing confirm route verifies the token, writes the cookies, logs the sign-in and
     redirects. The confirm route now logs a valid `device` instead of `dev_email_link`, so both of the app's
     sessions carry its device id and the console's "Sign out device" ends both.
   - The confirm route also refuses an account that is not active, as `/api/auth/verify` and `/api/auth/password`
     do: it ends the session the token just opened (on the server and in the browser's cookies), logs a failed
     sign-in and redirects to `/<locale>/login?link=suspended`, which shows the code sign-in's own words
     (`auth.errors.suspended`). Before, an e-mailed link or a hand-off link made before the suspension still signed
     the account in.
   - 401 without a valid token; 409 in a demo build or without the server key; 502 when Supabase cannot make the
     link. Never a 500. Neither the token, the link nor the address is logged.
   - The link is single-use and lives as long as Supabase's OTP (10 minutes locally). Making it replaces an e-mailed
     code that is still open for this address and any earlier link (only the newest token works, ADR 0035). **The
     app keeps one hand-off in flight:** it opens a link before it asks for the next one, since a second request
     makes the first link fail (`/<locale>/login?link=expired`).
   - The app repeats the hand-off whenever its web view reaches `/<locale>/login`; a 401 means the app's own session
     is gone and it signs out natively.

2. **Page operations: native screens never build block JSON** (`POST /api/app/page`).
   - Body (at most 64 KB, else 413):

     ```json
     { "baseUpdatedAt": "<the row's updated_at>",
       "ops": [ { "op": "add", "url": "…" },
                { "op": "addImage", "src": "…", "alt": "…", "w": 1080, "h": 1350 },
                { "op": "move", "id": "…", "to": 0 },
                { "op": "show", "id": "…", "visible": false },
                { "op": "remove", "id": "…" } ] }
     ```

   - Answer 200 `{ ok, updatedAt, changed: [ids], added: [ids] }`; `changed` in the order of the operations,
     `added` the new blocks' ids in the order of the `add`/`addImage` operations.
   - **`updatedAt` and `baseUpdatedAt` are opaque strings.** The app stores the value exactly as `flush()` or this
     route answered it and sends it back verbatim; it never parses it. Postgres keeps microseconds, Swift's `Date`
     and `ISO8601DateFormatter` keep milliseconds, so a value parsed and written out again never matches (409).
   - `add`: the web's own code: `detectLink` (tracking parameters off), `blockFromLink` (no sample pictures), placed
     where the Add sheet places it (`insertAt`: the top, under the social icons, in the order sent), then the
     platform details from `lookupLinkMetadata`, as `/api/link-metadata` gives them to the editor, patched with
     `metadataPatch`. Details that would break the schema (a title over 120 characters) are left out.
   - `addImage`: only a picture the account uploaded itself: this project's public `media` bucket, the account's own
     folder, an upload's path (`<uid>/<yyyy>/<uuid>.jpg|webp|png`, as `features/app/media-upload.ts` names them). The
     app uploads to Storage first (JPEG, WebP or PNG; the bucket refuses HEIC).
   - `move` (`to` is the block's index afterwards), `show`, `remove`: by id. An unknown id answers 422 naming it; an id
     the page holds twice too (`ambiguousBlock`).
   - Validation: every new block passes `blockSchema`; the whole page is parsed with `pageSchema`, and the call is
     refused (422 `invalidPage` with the problems) only for a problem it adds. Blocks the call does not touch stay
     exactly as stored, also ones the schema no longer reads: a native call never deletes someone's old block.
   - The read and the write run as the account (row-level security; a suspended account is refused with 403). Both
     carry the version check: the row is read only at `baseUpdatedAt` and written only while it still has it. A newer
     row answers 409 `{ error: "conflict", updatedAt }` and nothing is written.
   - A successful write drops the cached public page (and the project pages it touches), so visitors see a native
     change at once. Web saves keep the one-minute window (ADR 0067); a native operation is a single deliberate act.
   - No dry run (`preview?` in PLAN.md W4 was left out: nothing needs it yet).

3. **The save guard in the web store** (`SupabaseAccountStore`).
   - Every save, and the keepalive save when a tab is hidden or closed, is `update … where profile_id = me and
     updated_at = <the version this tab read or last saved>`. A successful save answers the new version, which the
     next save builds on; saves stay one at a time, so a tab never conflicts with itself. An address change in this
     tab rewrites the row too (`change_username`); the tab then takes that version as its base.
   - **A bad network never costs a change.** Every write since the last version the server confirmed to this tab
     that may have reached the database without an answer is remembered (a fingerprint of its content, without
     limit; the same content once): no answer at all (the connection dropped, a timeout; PostgREST's client reports
     status 0) or a server error (5xx). A 4xx answer from PostgREST wrote nothing, and an attempt made while
     `navigator.onLine` was false never left the device; neither is remembered. The list is cleared only when a
     version is confirmed (for the writes sent up to it), when a refused save's read-back shows this tab's own
     version (it then builds on that), and when the page is replaced. So a save that landed just before the phone
     went offline is still recognised as this tab's own after any number of failed attempts.
   - **The keepalive save is the last code a closing tab runs**: when it is refused, nothing sends it again. A save
     of this tab's that may land first with a version this tab does not know yet would make an exact keepalive fail
     and lose the last change. So the keepalive is guarded with `updated_at >= <base>` instead of `=` exactly
     while one of this tab's saves is on its way, or while the list above is not empty. Either order then keeps the
     last change: the save lands first and the keepalive follows, or the keepalive lands first and the save (still
     guarded exactly) changes nothing. When both land in a tab that stays open (a phone switching apps), their
     answers may come back in either order; writes are numbered as they are sent, and an older one's late answer
     never moves the base back.
   - **The real window, and its price** (taken on purpose). It opens when a save goes out and closes when its
     answer comes; after a save with no answer or a 5xx it stays open until a later save is confirmed or a refused
     save's read-back finds this tab's own version. On a bad network that can be a while: the retries come 2, 5 and
     15 s after failures in a row, then every 30 s, and each change tries at once. If, inside the window, another
     tab or the app writes the page and this tab is then closed, the keepalive overwrites that write instead of
     being refused, and nobody sees a toast. A browser cannot tell a request that never left (a network error
     while it says it is online) from one whose answer was lost, so a failed save of that kind opens the window
     even when it wrote nothing. What is also still not kept: two keepalives on their way at once (hidden, back,
     changed, hidden again, all while the first is still travelling) that reach the database in reverse order,
     where the older one wins; and a change made after the team gave the badge (a version this tab has not seen)
     in a tab that closes before its save, refused as this tab's own and sent again, went through: the keepalive
     is refused as stale. A database function `save_site(content, base, pending)` that writes when the row is at
     `base` or holds what may have landed would close all of these without the window; it needs a migration and
     is a follow-up.
   - A keepalive that fails while the tab is still there (a phone back from another app) is retried like any
     failed save.
   - Signing out (Settings' "Abmelden" too), the data export and the deletion first save until nothing waits, a
     refused save of this tab's own sent again included, also past the rebase limit below; only a save that failed
     stops it. Signing out first asks the editor for its change from the last moment (its 400 ms autosave delay,
     `features/account/pending-edits.ts`), so a change made just before "Abmelden" is saved too; the demo store does
     the same. The store's own `pagehide` and `visibilitychange` handler asks the editor first as well, so the
     keepalive carries that change whatever order the page's listeners run in.
   - A save that changes no row is read back to decide:
     - the row still has the same version: the database refused the write (a suspended account); retried like any
       failed save, never a conflict;
     - the row holds what this tab read, is sending, or may have written (the list above), apart from what the
       server owns (`sites_guard` writes the badge and the address into every page): the address was changed, the
       team gave the badge, or one of this tab's own saves landed without an answer. It builds on the newer version
       and sends again, at once. The server has just answered, so the save no longer counts as failing (`flush()`
       resolves, signing out saves the change). After three such rebases in a row without a confirmed save (every
       answer lost), the next send waits like a failed save (sync "error", the retry delays) instead of going out
       at once; the page here stays, and it never turns into a conflict;
     - anything else was changed elsewhere (another tab, the iPhone app): **the newer version wins.** It replaces the
       page here, the editor starts over from it (no undo into the replaced version, and a change made from the old
       one is never written over it), and a toast says so in de, en and ar (`app.sync.conflict`): "Deine Seite wurde an
       anderer Stelle geändert. Wir haben die neueste Fassung geladen. Deine letzte Änderung hier wurde nicht
       gespeichert."
   - **The unsaved change here is lost on purpose.** The other write is newer and, from the app, small and
     deliberate (one link added, one block moved). Merging two versions of one JSON document needs per-block
     versions or operations on both sides; that is a later step (the realtime split of PLAN.md D9). Until then the
     toast says plainly what happened, and the change is one tap to redo. No retry loop: a refused save is read back
     once.
   - The demo store keeps everything in this browser and needs no guard. Both stores keep the same interface.

4. **The store half of the bridge** (`features/app-mode/store-bridge.ts`, mounted once in the dashboard layout).
   - In app mode only (`data-app` on `<html>`, set by the native shell before the first paint) and only in the main
     frame. `data-app` grants nothing: every write still goes through the account's session and the server's rules.
   - On `window.linkyoApp` (made when missing; the interface half's `navigate` and `back` stay):
     - `flush(): Promise<{ updatedAt }>`: the editor's last-moment change (its autosave delay) goes to the store, then
       everything is saved; answers the version a native write builds on. Rejects when a change could not be saved.
     - `reload(): Promise<void>`: saves what waits, reads the row again and starts the editor over from it.
     - `signOut(): Promise<void>`: saves (best effort), then ends the web view's session (`scope: "local"`). Rejects
       after 10 s offline; the app then clears the web view's data anyway.
     - Right after the web view opens, the store is still checking the session. All three wait for that check (at
       most 10 s) before they answer: `flush()` answers `{ updatedAt: null }` only for a web view that is signed
       out, and rejects (`storeLoading`) when the check never ends; `signOut()` ends the session even then, so it is
       revoked on the server, not only deleted from the cookie.
   - To the app (`webkit.messageHandlers.linkyo`, never throwing): `{ type: "saveState", state: "saving" | "saved" |
     "error" | "conflict", updatedAt }` whenever it changes, and `{ type: "signedOut" }` when the session ends (also
     after a deletion inside the web view).
   - A native write is: `await flush()` → the operation with that `updatedAt` → `await reload()`. On 409 the app
     reloads, and either retries once on the new version or says it could not.

**Limits.** At most 20 operations and 64 KB per call; a link up to 2048 characters; the page's own limits (200 blocks,
the project and contact rules, under 1 MB per row: 422 `pageTooLarge`). **Rate limiting** is WP4.4's: it should cover
`/api/auth/handoff` (each call mints a sign-in token) and `/api/app/page` (each `add` may ask a platform for details,
and each write drops a cached page), per account and per IP. The hand-off is the one new way to turn a leaked access
token (about an hour) into a long-lived session, under a device id the caller chooses. WP4.4 should also consider
handing off only a token whose session (`session_id` in its JWT) has a `sign_ins` row with the same `deviceId`; the
app's native sign-in writes both.

**What a browser user notices.** Nothing, in one tab: rapid edits, slow networks, lost answers, a stretch offline, a
reload, an address change or the team's badge never conflict and never lose a change (the save state shows "error"
until the network is back). With two tabs (or the app) changing the page, the tab that saves later shows the newer
page and the toast instead of overwriting it.

**Consequences.**

- A team action that rewrites a page's content (none today; `admin_set_verified` and the verification approval only
  touch the badge) would meet the same guard in an open tab.
- Pictures moved to Storage during a save that was then refused stay in the account's folder until the account is
  deleted.
- The store's snapshot carries `baseUpdatedAt`, `revision` and `conflicts`; `EditorProvider` takes `revision` and
  `conflicts` for the creator's own page only (the team's editors are unchanged).
- Tests: `features/account/supabase-store.test.ts`, `features/account/local-store.test.ts` (signing out),
  `features/app-mode/store-bridge.test.ts`,
  `app/api/app/page/{ops,route}.test.ts`, `app/api/auth/{handoff,confirm}/route.test.ts`, and the real-mode
  `e2e/app-sync-app.spec.ts` (`@real`, laptop and phone).
