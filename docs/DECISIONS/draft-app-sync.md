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
   - 401 without a valid token; 409 in a demo build or without the server key; 502 when Supabase cannot make the
     link. Never a 500. Neither the token, the link nor the address is logged.
   - The link is single-use and lives as long as Supabase's OTP (10 minutes locally). Making it replaces an e-mailed
     code that is still open for this address (only the newest token works, ADR 0035).
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
     next save builds on; saves stay one at a time, so a tab never conflicts with itself.
   - A save that changes no row is read back to decide:
     - the row still has the same version: the database refused the write (a suspended account); retried like any
       failed save, never a conflict;
     - the row holds what this tab read, saved or sent without an answer, apart from what the server owns
       (`sites_guard` writes the badge and the address into every page): the address was changed, or the team gave
       the badge, or this tab's own keepalive save landed. It builds on the newer version and sends again;
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
   - To the app (`webkit.messageHandlers.linkyo`, never throwing): `{ type: "saveState", state: "saving" | "saved" |
     "error" | "conflict", updatedAt }` whenever it changes, and `{ type: "signedOut" }` when the session ends (also
     after a deletion inside the web view).
   - A native write is: `await flush()` → the operation with that `updatedAt` → `await reload()`. On 409 the app
     reloads, and either retries once on the new version or says it could not.

**Limits.** At most 20 operations and 64 KB per call; a link up to 2048 characters; the page's own limits (200 blocks,
the project and contact rules, under 1 MB per row: 422 `pageTooLarge`). **Rate limiting** is WP4.4's: it should cover
`/api/auth/handoff` (each call mints a sign-in token) and `/api/app/page` (each `add` may ask a platform for details,
and each write drops a cached page).

**What a browser user notices.** Nothing, in one tab: rapid edits, slow networks, a reload, an address change or the
team's badge never conflict. With two tabs (or the app) changing the page, the tab that saves later shows the newer
page and the toast instead of overwriting it.

**Consequences.**

- A team action that rewrites a page's content (none today; `admin_set_verified` and the verification approval only
  touch the badge) would meet the same guard in an open tab.
- Pictures moved to Storage during a save that was then refused stay in the account's folder until the account is
  deleted.
- The store's snapshot carries `baseUpdatedAt`, `revision` and `conflicts`; `EditorProvider` takes `revision` and
  `conflicts` for the creator's own page only (the team's editors are unchanged).
- Tests: `features/account/supabase-store.test.ts`, `features/app-mode/store-bridge.test.ts`,
  `app/api/app/page/{ops,route}.test.ts`, `app/api/auth/{handoff,confirm}/route.test.ts`, and the real-mode
  `e2e/app-sync-app.spec.ts` (`@real`, laptop and phone).
