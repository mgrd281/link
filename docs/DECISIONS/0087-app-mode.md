# 0087 — App mode: the web dashboard inside Linkyo's iPhone app

**Status.** Accepted (iOS web part A: W1, W2a, W5, W9 of the iPhone app plan, 2026-11-26), with the lead's
decisions on the second review's open points (decision 8). Pairs with [0088](0088-app-sync.md) (the session
hand-off, the page operations, the save guard and the store's half of the bridge). Builds on
[0086](0086-installable-app.md) (the installable web app) and [0062](0062-black-and-grey-dashboard.md) (the
black-and-grey dashboard).

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
   - React may take `<html>` over after the app's script ran (it renders a whole document in the browser
     when the server's stream stops at a "not found" in a layout, as for `/<l>/app/orders/<id>` that can
     never exist, or the root layout's own error page, `app/global-error.tsx`, with its own `<html>`) and
     keeps only the attributes it renders. `appPlatform()` then reads the platform from
     `window.linkyoApp.platform`, and `data-app` is put back before the browser paints (`keepAppSignal`,
     `useKeepAppSignal`): once by the dashboard's island (`AppModeIsland`), and by the not-found and error
     pages and the root layout's error page, so the CSS and the code never disagree on app mode.
   - The web reads it in three ways (`features/app-mode/app-mode.ts`): CSS `:root[data-app="ios"]` in
     `app/globals.css` (right from the first paint, also on server-rendered pages); `useAppMode()` where a part must not exist at
     all (a link to a purchase page, a price inside a sentence) in the dashboard's screens, which render in the
     browser only, behind `AppGate`'s splash, so the hook already knows on their first render; `inAppMode()` in
     effects. Only `ios` is a known platform; any other value is a browser, for the CSS too (one predicate:
     the chrome never hides where the purchase links still show; a unit test holds the two together). The user agent is read only on the
     server (decision 5).
   - **Trust:** the attribute (and `window.linkyoApp`) only hides interface. It grants nothing: any page can set an attribute on itself,
     so no check of rights, price, plan or data may read it. The web posts only from the main frame; the app's
     handler accepts messages only from the main frame of our host.

2. **What app mode hides, and why.** Everything is marked `data-app-hide` (hidden by
   `:root[data-app="ios"] [data-app-hide]`) unless it must not exist, then `useAppMode()` leaves it out.

   | Hidden | Where | Why |
   |---|---|---|
   | The phone tab bar, the rail with its section panel, the phone top bar (avatar, back, save state, eye) | `shell.tsx`; the same places in the loading frame (`gate.tsx`) | The app draws its own tab bar, navigation bar and toolbar (4.2) |
   | Offsets for that chrome | `globals.css`: toasts sit at the bottom edge and may take the top under the app's bar (`--toast-offset`, `--toast-top`, `--toast-start`), the scroll padding and `main`'s bottom padding lose the bars, Design's sticky live page sits at `top: 0` | Sticky bars sit flush, nothing hides behind a bar that is not there |
   | Plan pane: where the plan comes from (the source line: the subscription's price and Stripe, the team, the invite reward's "Pro für immer"), "Pro kommt mit dem Start", "Pro kommt bald…", the past-due badge and note (a payment nudge; a past-due account shows no badge rather than a false "Aktiv"), the feature list ("Das ist enthalten"), the whole payment group (Pro holen, Stripe's portal, invoices, Kündigen). What stays: the plan's name ("Linkyo Pro", the account's own plan bought elsewhere, 3.1.3(b)), the states Aktiv, Gekündigt and Reserviert, the dates, and the AI drafts left (they name no plan, price or upgrade) | `settings/plan-screen.tsx` (`PlanGroups`) | 3.1.1, 3.1.3(f): the pane shows the plan's name, state and dates only (decision 9) |
   | Settings: the order, Widerruf and Kündigen rows and their footer; the team area row | `settings-screen.tsx` | No way to a contract or to the team console from the app |
   | Settings: the AGB open in Safari (`openExternal`) instead of in the app (accepted by the lead) | `settings-screen.tsx` | The AGB state the prices (`features/legal/texts.ts`, not changed here). The Impressum and the privacy policy open in the app |
   | Settings: the "App" group: "Darstellung", "Sprache der App", its footer "Gilt nur für dich, in diesem Browser" (and the install row, below). "Sprache der Seite", the page's language for its visitors, stays | `settings-screen.tsx` | The app owns its language and appearance (decision 8). A stored web theme is ignored too: `lib/theme-script.ts` sets no `data-theme` under `data-app`, so the web view follows `prefers-color-scheme`, which the app sets |
   | AI: the Pro sheet's price, "Pro kommt bald" and "Pro holen"; its title and close button say the fact in the app's own words (`appMode.ai.title`: "KI-Entwürfe sind für dieses Konto nicht freigeschaltet", `appMode.ai.close`); the plan link stays, so a tap is never dead. The page service link with its price; the error state's "Pro holen"; the used-up free draft says `appMode.ai.quotaFree` ("…Weitere Entwürfe sind für dieses Konto nicht freigeschaltet.") | `ai/pro-sheet.tsx`, `ai/build-screen.tsx` | 3.1.1, 3.1.3(f), and the "Pro" rule (decision 8) |
   | Invite: the "Pro für immer" reward (loaded or not), the rule that promises Pro ("Pro gibt es noch nicht…" / "Pro gibt es jetzt…"); the terms' sentence on Pro says only `appMode.invite.terms` ("Belohnungen sind persönlich, nicht übertragbar und nicht in Geld einlösbar."). Home's invite row names only the verification (`appMode.home.inviteSubtitle`). The invite link, its share and the count stay | `invite/invite-screen.tsx`, `home-screen.tsx` | A promise about a paid plan (the "Pro" rule, decision 8) |
   | The not-found and error pages: the ways to the website ("Zur Startseite", "Vorlagen ansehen", `data-app-hide`); a dashboard 404 shows only "Zum Dashboard", a page outside the dashboard shows "Zum Dashboard" instead (added by `useAppMode()` once the page knows it is in the app), and its sentence names the dashboard instead of the home page (`appMode.errors.notFoundBody`; the website's sentence carries `data-app-hide`). The root layout's own error page puts `data-app` back and offers only "Noch einmal versuchen" and "Zum Dashboard" (`/<l>/app`); its link to the home page carries `data-app-hide` | `errors/error-screen.tsx`, `app/global-error.tsx`, `errors/global-error-screen.tsx` | The website shows the prices; inside the app's web view a link to it would carry the web view there |
   | Ctrl/⌘ K on help and legal pages (an iPad keyboard): the people search does not open | `search/people-search.tsx` (`inAppMode()`) | Its header button is hidden with the header; its results lead to the website's pages |
   | "View my page": the floating Fertig/Bearbeiten bar and the room kept for it; the page's "Made with Linkyo" credit | `own-page-screen.tsx`; `data-credit` on the link in `directions/shared/creator-kit.tsx`, hidden by `:root[data-app="ios"]:has([data-console]) [data-credit]`, so only inside the dashboard's previews | The app's toolbar (Done, Edit, Share) stands over the page; the credit leads to the website and its prices. Public creator pages keep it |
   | The website's header and footer around help and legal pages, and the help page's link to the homepage's questions | `marketing/header.tsx`, `marketing/footer.tsx`, `marketing/pages/help-page.tsx` | They lead to the prices; the app draws its own bar |
   | Help: the articles' links on to the website (Funktionen, Portfolio, Vorlagen); the links to Sicherheit and Kontakt stay | `help/help-center.tsx`, `marketing/pages/help-page.tsx` (`inApp` per related page) | They lead on to sign-up and the homepage with its prices. They are the router's links (`pushState`), which the app's navigation policy is never asked about, so only the web can keep the web view on the app's pages |
   | The sign-in and sign-up frame: the logo's link to the homepage and the legal foot (AGB, and Widerruf and Kündigen in a payments build) | `account/auth/auth-shell.tsx` | The app signs in natively; the web shows these pages only for a moment, when the web view's session has ended (plan §1.2 step 5) |
   | Settings: "Abmelden" | `settings-screen.tsx` | Signing out is the app's own row (plan §1.1, §1.2 step 7): it ends the web view's session with the app's and wipes the device. A web-only sign-out would land on `/login`, which the app answers with a new hand-off, so the row would seem to do nothing (2.1) |

   Where a link may lead inside the app's web view: the dashboard (`/<l>/app/**`), help, contact, the legal
   pages, Sicherheit, and the sign-in pages; `e2e/app-mode-app.spec.ts` walks every link a person can reach
   from help, contact, the legal and the sign-in pages, and from every dashboard screen (Home, Seite, Design,
   Arbeiten, Statistik, Settings and its panes, Einladen, the AI builder, "View my page") and a dashboard 404,
   in German and Arabic, two levels deep, every `<details>` opened first, and fails on any other page, a "€",
   or (on a dashboard screen) the word "Pro" outside the creator's own content.
   A link that opens a new window (the sign-up form's AGB and Datenschutz words, `target="_blank"`) and a
   link to another host are real navigations, which the app's policy sees: the app opens them outside its
   web view (in Safari), never a purchase page.
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
   | `share` | `title?`, `text?`, `url?`, `file?` `{name, mime, base64}` | Home's link (`share-tools.tsx`), the QR sheet (`share-qr.tsx`), the story picture (`share-image-sheet.tsx`), the invite link (`invite/invite-link-card.tsx`), and the creator page's own share button in "View my page" (`directions/poster/share-island.tsx`: the page's public address, `pageUrl(username)`, which the dashboard names on `data-share-url` around the page; never `/<l>/app/preview`, in a browser too) |
   | `download` | `name`, `mime`, `base64` | the data export (`settings-screen.tsx`), the statistics CSV (`analytics-screen.tsx`), the story picture, the QR code as PNG and as SVG, the Premium kit's story pictures (`proposals/proposal-screen.tsx`: fetched from their signed Storage address by `appDownloadFrom`, as Storage is another host the web view does not open; a failed fetch says so in a toast), and a planned live's reminder in "View my page" (`directions/poster/live-time.ts` `remind()`: `live.ics`, `text/calendar`, UTF-8) |
   | `haptic` | `style: "light"` | `lib/haptics.ts` (every `haptic()` of a user's tap) |
   | `editClosed` | `id`, `missing?` (`true`) | the editor, when the sheet `?edit=<id>` opened closes (saved, cancelled or the block deleted); with `missing: true` at once when the page has no block of that id (deleted on another device, a stale list): no sheet opens, so the app pops back to its list instead of waiting |
   | `openExternal` | `url` (absolute, this site only) | the AGB row |
   | `saveState`, `signedOut` | the store's ([0088](0088-app-sync.md)) | `features/app-mode/store-bridge.ts` |

   App → web on `window.linkyoApp` (created by the web if the app's script has not made it):
   - `navigate(path)`: a path of this site, with or without the language (`/de/app/editor?edit=b1`,
     `/app/design`); the client router, so no reload and nothing the store holds is lost. Answers false for
     anything else (another host, `//…`, a backslash, a non-string, more than 2048 characters). Installed on the
     dashboard's pages (`/<locale>/app/*`, `features/app-mode/app-mode-island.tsx`, mounted by the dashboard's
     layout); elsewhere (a legal page) the app loads the address.
   - `back()`: goes where the current screen's `route.back` leads; false where there is none.
   - `flush()`, `reload()`, `signOut()`: the store's half ([0088](0088-app-sync.md), `store-bridge.ts`).

5. **The editor's deep link.** `/<locale>/app/editor?edit=<blockId>` opens that block's sheet once; an unknown id
   opens nothing. The address loses the parameter first (`replaceState`), so a reload or Back does not reopen
   it. The sheet opens a task after the screen's effects, because the shell closes every sheet when the screen
   changes (`navigate()` from Home). It works in a browser too. In the app, closing that sheet posts
   `editClosed {id}`; an unknown id posts `editClosed {id, missing: true}` at once (`editLinkOutcome` in
   `features/app/edit-link.ts`); a sheet opened from the list posts nothing.

6. **The app is not counted.** `optedOut()` in `features/analytics/filter.ts` also drops a user agent with
   `LinkyoApp/` (a word of its own, not `NotLinkyoApp/`), beside GPC and DNT: the owner looking at their own page
   from the app is never a visitor. The app's second WebView (the live page) also sends GPC (plan §1.1); this is
   the safety net. Nothing is read in the visitor's browser.

7. **What a browser sees: nothing changes.** One exception, a fix for browsers too: the share button of the page
   in "View my page" shares the page's public address instead of the dashboard's `/<l>/app/preview`. No `data-app`, so no CSS rule applies; `useAppMode()` is false; the
   bridge posts nothing even to a page that has a handler of that name; downloads and `navigator.share` run as
   before. Home, Seite, Settings and the plan pane at 390 × 844 in de and ar, light and dark (16 pictures) are
   byte-equal before and after this change; the s4m picture baseline is byte-equal.

8. **The lead's decisions on the second review (2026-11-26).**
   - **The AGB open in Safari** (`openExternal`), accepted: a chrome-less AGB page in the app would show the
     prices they state.
   - **Full-screen web tasks:** the AI builder (`/<l>/app/build`), an order (`/<l>/app/orders/<id>`) and a
     proposal (`/<l>/app/proposals/<id>`) keep their own web top bar with its close button in app mode; the
     app presents those routes full screen, without a navigation bar of its own (`route` names no title for
     them).
   - **Signing out is native only:** no web "Abmelden" in the app (decision 2).
   - **The creator page's two islands are bridged in app mode**, the browser unchanged: the share button
     (`share`, with the public address) and a planned live's reminder (`download` of `live.ics`). Both reuse
     the bridge's core (`features/app-mode/bridge.ts`, already on creator pages through `lib/haptics.ts`).
   - **The "Pro" rule (App Store 3.1.3(f): no call to action for a purchase):** inside the app no text names
     "Pro" as something to get, unlock, wait for or be given: no reward, rule, sheet title or error that says
     it. Where the dashboard tells a Free account about the paid plan, the app says the fact in words of its
     own, under `appMode.*` (de, en, ar), without "Pro", without a price and without a hint to buy. The word
     may appear only inside the creator's own content (their page, shown as it is). `e2e/app-mode-app.spec.ts`
     fails on "Pro" as a word on every dashboard screen in app mode; `app-mode-wording.test.ts` holds
     `appMode.*` free of "Pro" and of prices.
   - **The app owns its language and appearance:** it sets the app's language natively and `PATCH`es
     `profiles.locale` (plan I8), and sets the appearance; Settings shows neither row in the app, and a theme
     stored in the web view never overrides the device's (`lib/theme-script.ts`).
   - **`editClosed.missing`** (decision 5).

**Consequences.**

- Weight: the dashboard's first load grows by 1.4 KB with the first round (321.9 → 323.3 KB of 350) and is
  323.1 KB after the second; creator pages carry the bridge's core (it reaches them through `lib/haptics.ts`;
  the file helpers stay in the dashboard's chunks) and, since the second round, the share button's and the
  reminder's use of it (+0.16 to +0.21 KB): page code `/u/<name>` 30.2 → 30.4 KB, `/u/<name>/<project>`
  23.3 → 23.5 KB, `/<l>/p/<slug>` 32.0 → 32.2 KB, `/<l>/p/<slug>/<project>` 26.4 → 26.5 KB (budget 35 KB);
  the website's pages +0.18 KB (the signal's restore, the theme script's platform list, the people search's
  check); `/de`'s HTML 54.2 → 54.3 KB of 60.
- Tests: `features/app-mode/*.test.ts` (the signal, the bridge against a stand-in WKWebView: main frame only,
  never throws, files as base64, a file fetched from another host, Safari only for our host; the route names and
  `navigate`'s paths; the CSS keyed on the platforms the code knows; a static guard that every purchase link and
  every `<a download>` in `features/app`, `features/ai` and `features/errors` renders behind the app-mode value,
  that every blob download and `navigator.share` in the dashboard and on the creator page's two islands asks
  the bridge first, that the replaced chrome, including the sign-in frame's home link and legal foot, carries
  `data-app-hide`, and that the not-found and error pages lead only to the dashboard in the app;
  `app-mode-wording.test.ts`: `appMode.*` free of "Pro" and prices, the AI sheet and the quota error in the
  app's words; `creator-islands.test.ts`: the reminder's `.ics` through the bridge, UTF-8),
  `features/app/edit-link.test.ts` (`editLinkOutcome`), `lib/theme-script.test.ts`,
  `features/analytics/filter.test.ts`, and `e2e/app-mode-app.spec.ts` (the app's user agent and script on a
  phone, de and ar: no web chrome, no purchase link, no "€", no "Pro", no "Pro holen", no install hint or row,
  no worker, sticky at 0, axe clean on every dashboard screen, help and the legal pages; no web sign-out, no
  app language or appearance rows; the two-level link walks from help, contact, the legal and the sign-in
  pages and from every dashboard screen and a dashboard 404; a dashboard 404 with only "Zum Dashboard"; no
  people search on Ctrl/⌘ K; a stored theme ignored; ready, route, navigate without a reload, back; every
  download and share, also the creator page's share and reminder in "View my page"; no message from a frame;
  `?edit=` from another screen, `editClosed` and `missing`; in a browser the chrome stays, the export
  downloads, nothing is posted, "View my page" shares the public address and a stored theme applies).
- Open for the app (native): the navigation policy still has to send `/checkout`, `/service`, `/kuendigen`,
  `/widerruf`, the team area and every other host to Safari (plan §1.6); the web no longer links them from the
  dashboard in app mode, but the policy is the guarantee.
- Open for the app and the lead:
  - the store's half (`store-bridge.ts`, WP "appsync") installs its methods for any `data-app` value; it should
    ask `inAppMode()` too, so all three parts agree on one predicate;
  - the plan pane of an account that has Pro (bought on the web, given by the team, or the invite reward)
    names its plan, "Linkyo Pro", in the app: the account's state, not an offer (no price, no way to buy, no
    "coming"); the e2e "Pro" check runs on a Free demo account, so it does not see it. Whether the app shows
    the plan's name is the lead's call.
- Not covered here: the privacy policy could say that views from the app are not counted (W8).
