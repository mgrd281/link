# 0088 — The iPhone app and the web dashboard share one page safely

**Status.** Accepted (iOS web part B, 2026-11-26). Builds on PLAN.md D2–D5 (`audit/ios`). Pairs with
[0087](0087-app-mode.md) (app mode and the interface half of the bridge).

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
   - Body `{ deviceId, next? }`. `deviceId` must be `dev_` and 12 **lowercase** hex digits, the form a browser
     keeps (`DEVICE_ID`, `features/account/server/auth.ts`); anything else is 422 `invalidDevice`.
     `/api/auth/code` takes any device id up to 64 characters, so an id with capitals signs in natively and
     fails only here: the app makes its id in this form. `next`, when sent, is a string of at most 200
     characters, else 422 `invalidNext`. A string that `safePath` refuses or that is no dashboard path
     (`/<locale>/app…`) falls back, without an error, to the account's language's `/app`: also a path with a
     query (`?edit=`, `?tab=`), which the app opens with `navigate()` after the first `ready` instead
     ([0087](0087-app-mode.md), "For the native shell").
   - Answer `{ ok, url }`: a relative `/api/auth/confirm?token_hash=…&type=magiclink&next=…&device=<deviceId>`. The
     web view opens it; the existing confirm route verifies the token, writes the cookies, logs the sign-in and
     redirects. The confirm route now logs a valid `device` instead of `dev_email_link`, so both of the app's
     sessions carry its device id and the console's "Sign out device" ends both.
   - The confirm route also refuses an account that is not active, as `/api/auth/verify` and `/api/auth/password`
     do: it ends the session the token just opened (on the server and in the browser's cookies), logs a failed
     sign-in and redirects to `/<locale>/login?link=suspended`, which shows the code sign-in's own words
     (`auth.errors.suspended`). Before, an e-mailed link or a hand-off link made before the suspension still signed
     the account in. Every answer of the confirm route, each a redirect, carries `Cache-Control: no-store`: it is
     for one single-use token and sets or ends a session, so no browser or cache in between may keep it.
   - Never a 500. Neither the token, the link nor the address is logged. The answers, in the order the route
     checks them (every one `{ ok: false, error }` but the first):

     | Status | `error` | When |
     |---|---|---|
     | 200 | — | `{ ok: true, url }` |
     | 409 | `unavailable` | a demo build (no real accounts) or no server key |
     | 401 | `unauthorized` | no `Authorization: Bearer`, or a token Supabase Auth turned down (invalid, expired, its session or its user gone) |
     | 503 | `unavailable` | Supabase Auth could not check the token (no answer, a 5xx, a rate limit): try again later; never sign out on it |
     | 422 | `invalidDevice` | `deviceId` missing or not `dev_` + 12 lowercase hex digits; also a body that is not JSON |
     | 422 | `invalidNext` | `next` is not a string, or longer than 200 characters |
     | 409 | `unavailable` | the account has no e-mail address |
     | 403 | `blocked` | the request's address is blocked (as at sign-in) |
     | 403 | `suspended` | the account is not active |
     | 502 | `serverError` | the account could not be read, or Supabase could not make the link: try again later |
   - The link is single-use and lives as long as Supabase's OTP (10 minutes locally). Making it replaces an e-mailed
     code that is still open for this address and any earlier link (only the newest token works, ADR 0035). **The
     app keeps one hand-off in flight:** it opens a link before it asks for the next one, since a second request
     makes the first link fail (`/<locale>/login?link=expired`).
   - The app repeats the hand-off whenever its web view reaches `/<locale>/login`; a 401 means the app's own session
     is gone and it signs out natively. Only a 401 does: a 503 `unavailable` (Supabase Auth could not check the
     token) and a 502 `serverError` say nothing about the session, and the app tries again later, keeping its
     session, the Keychain and the App Group (the share extension's queue) as they are. Two exceptions:
     - **not while the app signs out itself.** After `signOut()` the web view goes to
       `/<locale>/login?next=…` (plan §1.2 step 7 ends the web view's session before the native one); a
       hand-off there would sign it back in;
     - **a `signedOut` the app did not cause** (§4: the account was deleted in the web view, its session was
       ended elsewhere): the app tries one hand-off; a 401 means the account or its session is gone, and the app
       wipes the device (plan §1.2 steps 8 and 9); a link means only the web view's session had ended, and it
       opens it; a 503 or a 502 means neither is known yet, and the app tries again later without wiping.

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
   - **Input limits** (else 422 `invalidBody` with the `path` of the first problem, e.g. `ops`,
     `baseUpdatedAt`, `ops.0.alt`): `baseUpdatedAt` a timestamp string of at most 40 characters (never null);
     `ops` 1 to 20 operations (more: `tooManyOps`); `add.url` 1 to 2048 characters; `addImage.src` 1 to 2048
     characters, `alt` at most 300, `w` and `h` integers from 1 to 8192; `id` 1 to 200 characters; `move.to` an
     integer from 0, below the number of blocks (else `badIndex`); `show.visible` a boolean.
   - **Answers** (every one `{ ok: false, error, … }` but the first):

     | Status | `error` | Extra fields | When |
     |---|---|---|---|
     | 200 | — | `updatedAt`, `changed`, `added` | written |
     | 400 | `invalidJson` | | the body is not JSON |
     | 401 | `unauthorized` | | no `Authorization: Bearer`, or a token Supabase Auth turned down (invalid, expired, its session or its user gone) |
     | 503 | `unavailable` | | Supabase Auth could not check the token (no answer, a 5xx, a rate limit): try again later; never sign out on it |
     | 403 | `suspended` | | the account is not active |
     | 404 | `notFound` | | the account has no profile or no page row |
     | 409 | `unavailable` | | a demo build (no real accounts) |
     | 409 | `conflict` | `updatedAt` (the current version; null when it could not be read) | the row is no longer at `baseUpdatedAt`; nothing written |
     | 413 | `tooLarge` | `max` (65536) | the body is above 64 KB |
     | 422 | `tooManyOps` | `max` (20) | more than 20 operations |
     | 422 | `invalidBody` | `path` | the body breaks the limits above (an empty `ops` too, with `path` `ops`) |
     | 422 | `badUrl` | `op` (its index) | an `add` whose link is no address, or whose block the schema refuses |
     | 422 | `badImage` | `op` | an `addImage` that is not the account's own upload, or whose block the schema refuses |
     | 422 | `badIndex` | `op` | a `move` past the end |
     | 422 | `unknownBlock`, `ambiguousBlock` | `id` | an id the page does not hold, or holds twice |
     | 422 | `invalidPage` | `problems` | the page the blocks schema would refuse (only for a problem the call adds) |
     | 422 | `pageTooLarge` | | the database refused the page for its size (1 MB) |
     | 502 | `serverError` | | a read (the account, the page or its version) or the write failed: try again later |

3. **The save guard in the web store** (`SupabaseAccountStore`).
   - Every save, and the keepalive save when a tab is hidden (and, with the one exception below, when it is
     closed), is `update … where profile_id = me and updated_at = <the version this tab read or last saved>`. A
     successful save answers the new version, which the next save builds on; saves stay one at a time, so a tab
     never conflicts with itself. An address change in this tab rewrites the row too (`change_username`); the tab
     then takes that version as its base.
   - **A bad network never costs a change.** Every write since the last version the server confirmed to this tab
     that may have reached the database without an answer is remembered (a fingerprint of its content, without
     limit; the same content once): no answer at all (the connection dropped, a timeout; PostgREST's client reports
     status 0) or a server error (5xx). A 4xx answer from PostgREST wrote nothing, and an attempt made while
     `navigator.onLine` was false never left the device; neither is remembered. The list is cleared only when a
     version is confirmed (for the writes sent up to it), when a refused save's read-back shows this tab's own
     version (it then builds on that), and when the page is replaced. So a save that landed just before the phone
     went offline is still recognised as this tab's own after any number of failed attempts.
   - **A save without an answer is read back at once.** A read often gets through where the write's answer did not (a
     connection that drops on the way back); it runs on its own, so no save waits for it (a hidden tab does, for a
     while). When the row holds that save's content, the save landed and counts as confirmed (its version becomes
     the base, the list above is cleared up to it, and the window below closes); when it holds another version of
     this tab's own, the tab builds on that. Without this, a network that keeps losing write answers would refuse
     every later save for good (each carries the version before the first landed write, and the refusals' answers
     are lost too), where the store before the guard wrote them all.
   - **A hidden tab usually keeps running, but its keepalive may be the last write it makes.** When the tab is
     hidden (a tab switch on a computer, another app on a phone: `visibilitychange` to `hidden`), what is pending is
     sent as a `keepalive` request, which outlives a page the phone freezes. A phone may end a frozen page later
     without another event: iOS ends a suspended app's web view with no `pagehide`, so in the iPhone app the hidden
     path is the only exit there is.
     - Nothing uncertain (no save of this tab's on its way, the list above empty): at once, with the exact guard.
     - A save on its way, or a lost answer (the list above not empty): the tab sends nothing else meanwhile, waits
       for that to settle, at most 3 s (`HIDDEN_WAIT`), and reads the row again for a lost answer. Holding a
       version of this tab's own (a write that landed without an answer), it builds on that version; still at the
       version it built on, nothing of its landed; holding a version from elsewhere, that page wins. Each of these
       resolves the lost answers, and the tab sends what is left with the exact guard against the version it
       knows then, like any save. Back on screen before that, the rest goes as a normal save instead. A refusal
       there is a normal one: the row is read again; this tab's own version is built on and sent again, a page
       changed elsewhere wins, and the toast shows when the tab is back.
     - A lost answer that no read of the row has resolved when the wait ends (reads fail, or take longer than
       3 s): the row may hold this tab's own landed write, which an exact keepalive never matches, and no code may
       run after it. That keepalive takes the closing tab's guard (`updated_at >= <base>`, below), with its price.
     **The price, accepted:** a phone that freezes the page right after hiding it and ends it within those 3 s,
     before the keepalive went, loses the edits made since the last save that reached the database (that save
     itself is kept, and so is every write from elsewhere); so does one that ends it after the 3 s while a save is
     still on its way (its keepalive, exact, is refused by that save).
   - **The loose guard: a closing tab, and a hidden one with an unresolved lost answer** (`pagehide`: the page is
     going away and cannot wait). The keepalive is the last code it runs: when it is refused, nothing sends it
     again. A save of this tab's that lands first, with a version this tab does not know yet, would make an exact
     keepalive fail and lose the last change. So on `pagehide` the keepalive is guarded with `updated_at >= <base>`
     instead of `=` exactly while one of this tab's saves is on its way, or while the list above is not empty; a
     hidden tab's keepalive only while a lost answer is still unresolved after its wait (above); otherwise it is
     exact too. Either order then keeps the last change: the save lands first and the keepalive follows, or the
     keepalive lands first and the save (still guarded exactly) changes nothing. When both land in a page that
     stays (a page kept in the back/forward cache), their answers may come back in either order; writes are
     numbered as they are sent, and an older one's late answer never moves the base back.
   - **The real window, and its price** (taken on purpose). It opens only when a tab is closed (`pagehide`) while a
     save of its is on its way, or while the list above is not empty (a save with no answer or a 5xx, until a later
     save is confirmed or a read-back finds this tab's own version; on a bad network that can be a while: the
     retries come 2, 5 and 15 s after failures in a row, then every 30 s), and when a hidden tab's 3 s wait ends
     with a lost answer that no read of the row could resolve (the reads fail too). Then the keepalive overwrites **any write
     from elsewhere since this tab last read or saved** (another tab, the app), instead of being refused, and the
     closing tab sees nothing. The other tab learns of it only on its next save: that save is refused, it shows the
     toast and the closing tab's page, and that change is dropped. A browser cannot tell a request that never left
     (a network error while it says it is online) from one whose answer was lost, so a failed save of that kind
     opens the window even when it wrote nothing. What is also still not kept: a change made after the team gave the
     badge (a version this tab has not seen) in a tab that closes before its save, refused as this tab's own and
     sent again, went through: the keepalive is refused as stale. A database function `save_site(content, base,
     pending)` that writes when the row is at `base` or holds what may have landed would close both without the
     window; it needs a migration and is a follow-up.
   - A keepalive that fails while the tab is still there (a phone back from another app) is retried like any
     failed save.
   - Signing out (Settings' "Abmelden" too), the data export and the deletion first save until nothing waits, a
     refused save of this tab's own sent again included, also past the rebase limit below; only a save that failed
     stops it. Signing out first asks the editor for its change from the last moment (its 400 ms autosave delay,
     `features/account/pending-edits.ts`), so a change made just before "Abmelden" is saved too; the demo store does
     the same. The store's own `pagehide` and `visibilitychange` handler asks the editor first as well, so the
     keepalive carries that change whatever order the page's listeners run in.
   - **A session's save state ends with it.** A change waiting, the retry timer, failures in a row, the writes whose
     answers were lost and a hidden tab's wait belong to one session: they are forgotten when the session ends and
     when another account signs in in the same document (signed out in Settings, then signed in on the login page,
     without a reload); late answers to the last account's writes change nothing. Before, they carried over: the next
     account's tab started with a change waiting and the last account's lost writes, and closing it sent its own
     unchanged page with the loose guard (above), over a write its app had made since; hidden instead, it showed the
     conflict toast for a change it never made.
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
   - In app mode only (`inAppMode()`, the same predicate as the rest of app mode: `data-app="ios"` on `<html>`, set
     by the native shell before the first paint) and only in the main frame (`inMainFrame()`). `data-app` grants
     nothing: every write still goes through the account's session and the server's rules.
   - On `window.linkyoApp` (made when missing, never replaced), through `installOnApp` like the interface half
     ([0087](0087-app-mode.md)); its `navigate` and `back` stay, whichever half mounts first:
     - `flush(): Promise<{ updatedAt }>`: the editor's last-moment change (its autosave delay) goes to the store, then
       everything is saved; answers the version a native write builds on. Rejects when a change could not be saved.
     - `reload(): Promise<void>`: saves what waits, reads the row again and starts the editor over from it.
     - `signOut(): Promise<void>`: saves (best effort), then ends the web view's session (`scope: "local"`). Rejects
       after 10 s offline; the app then clears the web view's data anyway.
     - Right after the web view opens, the store is still checking the session. All three wait for that check (at
       most 10 s) before they answer: `flush()` answers `{ updatedAt: null }` only for a web view that is signed
       out, and rejects (`storeLoading`) when the check never ends; `signOut()` ends the session even then, so it is
       revoked on the server, not only deleted from the cookie.
   - **Only on dashboard pages.** Like `navigate` and `back`, the three exist only while the web view shows a
     dashboard page (`/<locale>/app/…`): the router's links from the dashboard to a legal page or help keep the
     document but take all five methods off. Before it calls one, the app brings the web view back to the dashboard
     (`goBack()`, or loads `/<locale>/app`) and waits for the `ready` that follows; after a native write made while
     the web view was away, it calls `reload()` after that `ready` ([0087](0087-app-mode.md) decision 4).
   - **Why a call rejects** (the error's message, as `callAsyncJavaScript` hands it to the app):

     | Method | Rejects with | Meaning | What the app does |
     |---|---|---|---|
     | `flush()`, `reload()`, `signOut()`: not a function | (a `TypeError`) | the web view is not on a dashboard page | brings it back and waits for `ready` (above) |
     | `flush()`, `reload()` | `storeLoading` | the store's session check did not end within 10 s | reloads the web view and waits for `ready`; no native write meanwhile |
     | `flush()`, `reload()` | `saveFailed` | a save failed (offline, a server error); the change stays and is retried | tries again later (back online); no native write until `flush()` resolves |
     | `flush()`, `reload()` | `tooLarge` | the page is over the database's size limit; retrying cannot help until the page changes | says so; no retry |
     | `reload()` | `reloadFailed` | everything was saved, but the row could not be read again | tries again later |
     | `signOut()` | `signOutTimeout` | the session did not end within 10 s (offline) | clears the web view's data anyway (plan §1.2 step 7) |

     `navigate()` and `back()` never reject: they answer false. A save state of `error` (`saveState`) is the same
     condition as `saveFailed`.
   - To the app through the bridge's `post()` ([0087](0087-app-mode.md): app mode, the main frame, plain data, never
     throwing): `{ type: "saveState", state: "saving" | "saved" | "error" | "conflict", updatedAt }` whenever it
     changes, never before the `ready` that names the account ([0087](0087-app-mode.md) decision 4, also again
     after each `ready` of a new mount), and `{ type: "signedOut" }` when the session ends: after `signOut()`, after
     a deletion inside the web view (Settings › Konto keeps its delete row in the app), and when the session was
     ended elsewhere. `signedOut` names no reason; the app tells its own sign-out from the others because it
     called `signOut()` itself, and answers the others with one hand-off (§1).
   - A native write is: `await flush()` → the operation with that `updatedAt` → `await reload()`. On 409 the app
     reloads, and either retries once on the new version or says it could not.

**Limits.** At most 20 operations and 64 KB per call; a link up to 2048 characters; the page's own limits (200 blocks,
the project and contact rules, under 1 MB per row: 422 `pageTooLarge`).

**For WP4.4 (security), not built here:**

- **Rate limits** on `POST /api/auth/handoff` (each call mints a sign-in token) and `POST /api/app/page` (each `add`
  may ask a platform for details, and each write drops a cached page), per account and per IP.
- **Binding the hand-off to the device id:** `/api/auth/handoff` is the one new way to turn a leaked access token
  (about an hour) into a long-lived session, under a device id the caller chooses. It should hand off only a token
  whose session (`session_id` in its JWT) has a `sign_ins` row with the same `deviceId`; the app's native sign-in
  writes both.

**What a browser user notices.** Nothing, in one tab: rapid edits, slow networks, lost answers, a stretch offline, a
reload, hiding and showing the tab, an address change or the team's badge never conflict and never lose a change (the
save state shows "error" until the network is back), with one exception on phones: a page that the phone freezes and
ends within 3 s of hiding it (while a save is on its way, or a lost answer is read back), or later while that save is
still on its way, loses the edits made since the last save that reached the database (the price in §3). With two tabs
(or the app) changing the page, the tab that saves later shows the newer page and the toast instead of overwriting it,
also when it is hidden while its save is on its way. The other exception is the window above: a tab **closed**
(`pagehide`) while a save of its is on its way, or while an answer it lost is not yet resolved, and a tab **hidden**
whose lost answer no read could resolve in 3 s, overwrite any write from elsewhere since it last read or saved; the
other tab learns of it only on its next save (the toast, and that change is dropped).

**Consequences.**

- A team action that rewrites a page's content (none today; `admin_set_verified` and the verification approval only
  touch the badge) would meet the same guard in an open tab.
- Pictures moved to Storage during a save that was then refused stay in the account's folder until the account is
  deleted.
- The store's snapshot carries `baseUpdatedAt`, `revision` and `conflicts`; `EditorProvider` takes `revision` and
  `conflicts` for the creator's own page only (the team's editors are unchanged).
- Tests: `features/account/supabase-store.test.ts` ("one document, two accounts": a sign-out while saves fail, then
  another account in the same tab, also without a sign-out between and with a keepalive failing late; with "hidden,
  then ended by the phone with no other event": a lost answer that landed or a 503 that wrote, reads failing, hidden
  and ended 200 ms later; reads back in time; a page changed elsewhere; a read that never answers),
  `features/account/local-store.test.ts` (signing out), `features/app-mode/store-bridge.test.ts`,
  `features/app-mode/adr-contract.test.ts` (this ADR names every error the two routes answer and every reason a bridge
  method rejects with), `app/api/app/page/{ops,route}.test.ts`, `app/api/auth/{handoff,confirm}/route.test.ts`, and
  the real-mode `e2e/app-sync-app.spec.ts` (`@real`, laptop and phone; also a lost answer, reads failing, the page
  hidden and then ended with `Page.crash`: the change is in the row; and a sign-out while saves fail, another account
  signed in with a password in the same tab, its app's write through the route, the tab closed: the write stays).
