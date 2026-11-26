# Draft — App mode: the web dashboard inside Linkyo's iPhone app

**Status.** Proposed (iOS web part A: W1, W2a, W5, W9 of the iPhone app plan, 2026-11-26). The lead numbers it
(next free: 0087). Builds on [0086](0086-installable-app.md) (the installable web app) and
[0062](0062-black-and-grey-dashboard.md) (the black-and-grey dashboard).

**Context.** The iPhone app is a native SwiftUI shell with one WKWebView for the deep web screens (block forms,
Design, Arbeiten, the welcome flow, the Settings panes, "View my page"). The same deployment serves browsers and
the app, and payments are a build-time switch shared by both (`lib/flags.ts`). Inside the app the web must not
draw its own bars (the app draws native ones, App Store 4.2), must not sell or point to a sale (3.1.1; the app
is a free companion to a paid web tool, 3.1.3(f), so no purchase and no call to action to buy outside it), must
not offer to install itself, and must hand downloads and shares to the app (a WKWebView ignores `<a download>`
blobs and has no file sharing of its own: dead buttons are a 2.1 rejection). In a browser nothing may change.

**Decision.**

1. **The signal, set by the app before the first paint** (a document-start `WKUserScript`):
   - `<html data-app="ios">`, and `window.linkyoApp = { platform, version, bridge: 1 }`;
   - `applicationNameForUserAgent = "LinkyoApp/<version>"`; the user agent still starts with `Mozilla/`.
   - The web reads it in three ways (`features/app-mode/app-mode.ts`): CSS `:root[data-app]` in `app/globals.css`
     (right from the first paint, also on server-rendered pages); `useAppMode()` where a part must not exist at
     all (a link to a purchase page, a price inside a sentence) in the dashboard's screens, which render in the
     browser only, behind `AppGate`'s splash, so the hook already knows on their first render; `inAppMode()` in
     effects. Only `ios` is a known platform; any other value is a browser. The user agent is read only on the
     server (decision 5).
   - **Trust:** the attribute only hides interface. It grants nothing: any page can set an attribute on itself,
     so no check of rights, price, plan or data may read it. The web posts only from the main frame; the app's
     handler accepts messages only from the main frame of our host.

2. **What app mode hides, and why.** Everything is marked `data-app-hide` (hidden by
   `:root[data-app] [data-app-hide]`) unless it must not exist, then `useAppMode()` leaves it out.

   | Hidden | Where | Why |
   |---|---|---|
   | The phone tab bar, the rail with its section panel, the phone top bar (avatar, back, save state, eye) | `shell.tsx`; the same places in the loading frame (`gate.tsx`) | The app draws its own tab bar, navigation bar and toolbar (4.2) |
   | Offsets for that chrome | `globals.css`: toasts sit at the bottom edge and may take the top under the app's bar (`--toast-offset`, `--toast-top`, `--toast-start`), the scroll padding and `main`'s bottom padding lose the bars, Design's sticky live page sits at `top: 0` | Sticky bars sit flush, nothing hides behind a bar that is not there |
   | Plan pane: the subscription's price, "Pro kommt mit dem Start", "Pro kommt bald…", the past-due note, the whole payment group (Pro holen, Stripe's portal, invoices, Kündigen) | `settings/plan-screen.tsx` | 3.1.1, 3.1.3(f): the pane shows the plan's name, state and dates only |
   | Settings: the order, Widerruf and Kündigen rows and their footer; the team area row | `settings-screen.tsx` | No way to a contract or to the team console from the app |
   | Settings: the AGB open in Safari (`openExternal`) instead of in the app | `settings-screen.tsx` | The AGB state the prices (`features/legal/texts.ts`, not changed here). The Impressum and the privacy policy open in the app |
   | AI: the Pro sheet's price, "Pro kommt bald" and "Pro holen" (its title and the plan link stay, so a tap is never dead); the page service link with its price; the error state's "Pro holen" | `ai/pro-sheet.tsx`, `ai/build-screen.tsx` | 3.1.1, 3.1.3(f) |
   | Invite: the rule that promises Pro ("Pro gibt es noch nicht…" / "Pro gibt es jetzt…") | `invite/invite-screen.tsx` | A promise about a paid plan; the milestones stay |
   | "View my page": the floating Fertig/Bearbeiten bar and the room kept for it; the page's "Made with Linkyo" credit | `own-page-screen.tsx`; `data-credit` on the link in `directions/shared/creator-kit.tsx`, hidden by `:root[data-app]:has([data-console]) [data-credit]`, so only inside the dashboard's previews | The app's toolbar (Done, Edit, Share) stands over the page; the credit leads to the website and its prices. Public creator pages keep it |
   | The website's header and footer around help and legal pages, and the help page's link to the homepage's questions | `marketing/header.tsx`, `marketing/footer.tsx`, `marketing/pages/help-page.tsx` | They lead to the prices; the app draws its own bar |
   | "Linkyo als App" in Settings and Home's install hint (the hint is not used up in the app) | `install/install-row.tsx`, `install/install-hint.tsx` | The app is the app (ADR 0086) |

3. **No service worker in the app.** `ServiceWorkerIsland` does not register the dashboard's worker in app mode. A
   WKWebView runs service workers only for App-Bound Domains (`WKAppBoundDomains` and
   `limitsNavigationsToAppBoundDomains`), which would also limit where the one WebView may go; the app shows its
   own loading, offline and error states instead (plan §1.3), so the worker's offline page is not needed.

4. **The bridge, contract version 1.** Web → app through `webkit.messageHandlers.linkyo`, one plain object per
   message (`features/app-mode/bridge.ts`, files in `bridge-files.ts`). `post()` sends only in app mode, only from
   the main frame, drops undefined fields, and never throws; in a browser every helper answers false at once and
   the caller does what it did before.

   | Message | Fields | Sent by |
   |---|---|---|
   | `ready` | `signedIn`, `accountId` (or null) | the island, once the session is known and whenever it changes; `navigate` and `back` are installed before |
   | `route` | `path` (with the language, `/de/app/settings/plan`), `title` (the screen's name in the page's language, from `features/app/routes.ts`; null for screens outside that table: the welcome flow, "View my page", the AI builder, an order, a proposal), `back` (the path back leads to, or null) | the island, on every screen |
   | `share` | `title?`, `text?`, `url?`, `file?` `{name, mime, base64}` | Home's link (`share-tools.tsx`), the QR sheet (`share-qr.tsx`), the story picture (`share-image-sheet.tsx`), the invite link (`invite/invite-link-card.tsx`) |
   | `download` | `name`, `mime`, `base64` | the data export (`settings-screen.tsx`), the statistics CSV (`analytics-screen.tsx`), the story picture, the QR code as PNG and as SVG |
   | `haptic` | `style: "light"` | `lib/haptics.ts` (every `haptic()` of a user's tap) |
   | `editClosed` | `id` | the editor, when the sheet `?edit=<id>` opened closes (saved, cancelled or the block deleted) |
   | `openExternal` | `url` (absolute, this site only) | the AGB row |
   | `saveState`, `signedOut` | the store's (WP "appsync") | `features/app-mode/store-bridge.ts` |

   App → web on `window.linkyoApp` (created by the web if the app's script has not made it):
   - `navigate(path)`: a path of this site, with or without the language (`/de/app/editor?edit=b1`,
     `/app/design`); the client router, so no reload and nothing the store holds is lost. Answers false for
     anything else (another host, `//…`, a backslash, a non-string, more than 2048 characters). Installed on the
     dashboard's pages (`/<locale>/app/*`, `features/app-mode/app-mode-island.tsx`, mounted by the dashboard's
     layout); elsewhere (a legal page) the app loads the address.
   - `back()`: goes where the current screen's `route.back` leads; false where there is none.
   - `flush()`, `reload()`, `signOut()`: the store's half (WP "appsync", `store-bridge.ts`).

5. **The editor's deep link.** `/<locale>/app/editor?edit=<blockId>` opens that block's sheet once; an unknown id
   opens nothing. The address loses the parameter first (`replaceState`), so a reload or Back does not reopen
   it. The sheet opens a task after the screen's effects, because the shell closes every sheet when the screen
   changes (`navigate()` from Home). It works in a browser too. In the app, closing that sheet posts
   `editClosed`; a sheet opened from the list posts nothing.

6. **The app is not counted.** `optedOut()` in `features/analytics/filter.ts` also drops a user agent with
   `LinkyoApp/` (a word of its own, not `NotLinkyoApp/`), beside GPC and DNT: the owner looking at their own page
   from the app is never a visitor. The app's second WebView (the live page) also sends GPC (plan §1.1); this is
   the safety net. Nothing is read in the visitor's browser.

7. **What a browser sees: nothing changes.** No `data-app`, so no CSS rule applies; `useAppMode()` is false; the
   bridge posts nothing even to a page that has a handler of that name; downloads and `navigator.share` run as
   before. Home, Seite, Settings and the plan pane at 390 × 844 in de and ar, light and dark (16 pictures) are
   byte-equal before and after this change; the s4m picture baseline is byte-equal.

**Consequences.**

- Weight: the dashboard's first load grows by 1.4 KB (321.9 → 323.3 KB of 350); creator pages by 0.3 KB (the
  bridge's core reaches them through `lib/haptics.ts`; the file helpers stay in the dashboard's chunks).
- Tests: `features/app-mode/*.test.ts` (the signal, the bridge against a stand-in WKWebView: main frame only,
  never throws, files as base64, Safari only for our host; the route names and `navigate`'s paths; a static guard
  that every purchase link in `features/app` and `features/ai` renders behind the app-mode value, that every
  blob download and `navigator.share` asks the bridge first, and that the replaced chrome carries
  `data-app-hide`), `features/app/edit-link.test.ts`, `features/analytics/filter.test.ts`, and
  `e2e/app-mode-app.spec.ts` (the app's user agent and script on a phone, de and ar: no web chrome, no purchase
  link, no "€", no "Pro holen", no install hint or row, no worker, sticky at 0, axe clean on every dashboard
  screen, help and the legal pages; ready, route, navigate without a reload, back; every download and share; no
  message from a frame; `?edit=` from another screen and `editClosed`; in a browser the chrome stays, the export
  downloads and nothing is posted).
- Open for the app (native): the navigation policy still has to send `/checkout`, `/service`, `/kuendigen`,
  `/widerruf`, the team area and every other host to Safari (plan §1.6); the web no longer links them from the
  dashboard in app mode, but the policy is the guarantee.
- Not covered here: the creator page's own islands inside "View my page" (its share button and the live
  show's calendar file, `features/directions/poster/*`) still use `navigator.share` and a blob download, which
  the app's WebView needs a delegate for; the Settings footer says "in diesem Browser" inside the app too; the
  privacy policy could say that views from the app are not counted (W8). The AGB opening in Safari is a choice
  the founder may revisit (a chrome-less AGB page in the app would show the prices it states).
