# 0087 — App mode: the web dashboard inside Linkyo's iPhone app

**Status.** Accepted (iOS web part A: W1, W2a, W5, W9 of the iPhone app plan, 2026-11-26), with the lead's
decisions on the second review's open points (decision 8) and on the last review (decision 9). Pairs with
[0088](0088-app-sync.md) (the session hand-off, the page operations, the save guard and the store's half of the
bridge). Builds on [0086](0086-installable-app.md) (the installable web app) and
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
   - **The app's object is a plain, extensible object.** The web adds its methods to it. An object the app froze,
     sealed or made non-extensible is replaced by a plain copy of its fields, so the dashboard never breaks on it
     (`linkyoApp()` in `features/app-mode/app-object.ts`); where `window.linkyoApp` itself is read-only, the web
     installs nothing and never throws. A property the app fixed on its object (non-writable) stays the app's.

2. **What app mode hides, and why.** Everything is marked `data-app-hide` (hidden by
   `:root[data-app="ios"] [data-app-hide]`) unless it must not exist, then `useAppMode()` leaves it out.

   | Hidden | Where | Why |
   |---|---|---|
   | The phone tab bar, the rail with its section panel, the phone top bar (avatar, back, save state, eye) | `shell.tsx`; the same places in the loading frame (`gate.tsx`) | The app draws its own tab bar, navigation bar and toolbar (4.2) |
   | Offsets for that chrome | `globals.css`: toasts sit at the bottom edge and may take the top under the app's bar (`--toast-offset`, `--toast-top`, `--toast-start`), the scroll padding and `main`'s bottom padding lose the bars, Design's sticky live page sits at `top: 0` | Sticky bars sit flush, nothing hides behind a bar that is not there |
   | Plan pane: where the plan comes from (the source line: the subscription's price and Stripe, the team, the invite reward's "Pro für immer"), "Pro kommt mit dem Start", "Pro kommt bald…", the past-due badge and note (a payment nudge; a past-due account shows no badge rather than a false "Aktiv") and its renewal date (it would say the same in other words), the feature list ("Das ist enthalten"), the whole payment group (Pro holen, Stripe's portal, invoices, Kündigen). What stays: the plan's name ("Linkyo Pro", the account's own plan bought elsewhere, 3.1.3(b)), the states Aktiv, Gekündigt and Reserviert, the dates, and the AI drafts left (they name no plan, price or upgrade) | `settings/plan-screen.tsx` (`PlanGroups`) | 3.1.1, 3.1.3(f): the pane shows the plan's name, state and dates only (decision 9) |
   | Settings: the order, Widerruf and Kündigen rows and their footer; the team area row. The group that is left is "Rechtliches" (`appMode.settings.legal`), not "Verträge und Rechtliches" (decision 10) | `settings-screen.tsx` | No way to a contract or to the team console from the app |
   | Settings: the plan row's value (the plan's name, "Linkyo Pro"); the row reads "Plan" and leads to the pane | `settings/plan-screen.tsx` (`PlanRow`) | The plan's name stands only on the pane (decision 9) |
   | Settings: the AGB open in Safari (`openExternal`) instead of in the app (accepted by the lead) | `settings-screen.tsx` | The AGB state the prices (`features/legal/texts.ts`, not changed here). The Impressum and the privacy policy open in the app |
   | Settings: the "App" group: "Darstellung", "Sprache der App", its footer "Gilt nur für dich, in diesem Browser" (and the install row, below). "Sprache der Seite", the page's language for its visitors, stays | `settings-screen.tsx` | The app owns its language and appearance (decision 8). A stored web theme is ignored too: `lib/theme-script.ts` sets no `data-theme` under `data-app`, so the web view follows `prefers-color-scheme`, which the app sets |
   | AI: the Pro sheet's price, "Pro kommt bald" and "Pro holen"; its title and close button say the fact in the app's own words (`appMode.ai.title`: "KI-Entwürfe sind für dieses Konto nicht verfügbar", `appMode.ai.close`); the plan link stays, so a tap is never dead, with a neutral label (`appMode.ai.plan`: "Zu deinem Plan"; the pane shows no feature list in the app, so "Was dein Plan enthält" would promise what it hides). The page service link with its price; the error state's "Pro holen"; the used-up draft says `appMode.ai.quotaFree` ("Deinen KI-Entwurf hast du genutzt. Weitere Entwürfe gibt es für dieses Konto nicht.", without "kostenlos": a free draft set against paid ones points at a plan to buy, decision 10). "Nicht freigeschaltet" (not unlocked) was dropped: it hints that the drafts could be switched on (decision 9) | `ai/pro-sheet.tsx`, `ai/build-screen.tsx` | 3.1.1, 3.1.3(f), and the "Pro" rule (decision 8) |
   | Invite: the "Pro für immer" reward (loaded or not), the rule that promises Pro ("Pro gibt es noch nicht…" / "Pro gibt es jetzt…"); the terms' sentence on Pro says only `appMode.invite.terms` ("Belohnungen sind persönlich, nicht übertragbar und nicht in Geld einlösbar."). Home's invite row names only the verification (`appMode.home.inviteSubtitle`). The invite link, its share and the count stay | `invite/invite-screen.tsx`, `home-screen.tsx` | A promise about a paid plan (the "Pro" rule, decision 8) |
   | The not-found and error pages: the ways to the website ("Zur Startseite", "Vorlagen ansehen", `data-app-hide`); a dashboard 404 shows only "Zum Dashboard", a page outside the dashboard shows "Zum Dashboard" instead (added by `useAppMode()` once the page knows it is in the app), and its sentence names the dashboard instead of the home page (`appMode.errors.notFoundBody`; the website's sentence carries `data-app-hide`). The root layout's own error page puts `data-app` back and offers only "Noch einmal versuchen" and "Zum Dashboard" (`/<l>/app`); its link to the home page carries `data-app-hide` | `errors/error-screen.tsx`, `app/global-error.tsx`, `errors/global-error-screen.tsx` | The website shows the prices; inside the app's web view a link to it would carry the web view there |
   | Ctrl/⌘ K on help and legal pages (an iPad keyboard): the people search does not open | `search/people-search.tsx` (`inAppMode()`) | Its header button is hidden with the header; its results lead to the website's pages |
   | "View my page": the floating Fertig/Bearbeiten bar and the room kept for it; the page's "Made with Linkyo" credit | `own-page-screen.tsx`; `data-credit` on the link in `directions/shared/creator-kit.tsx`, hidden by `:root[data-app="ios"]:has([data-console]) [data-credit]`, so only inside the dashboard's previews | The app's toolbar (Done, Edit, Share) stands over the page; the credit leads to the website and its prices. Public creator pages keep it |
   | The website's header and footer around help and legal pages, and the help page's link to the homepage's questions | `marketing/header.tsx`, `marketing/footer.tsx`, `marketing/pages/help-page.tsx` | They lead to the prices; the app draws its own bar |
   | Help: the articles' links on to the website (Funktionen, Portfolio, Vorlagen); the links to Sicherheit and Kontakt stay | `help/help-center.tsx`, `marketing/pages/help-page.tsx` (`inApp` per related page) | They lead on to sign-up and the homepage with its prices. They are the router's links (`pushState`), which the app's navigation policy is never asked about, so only the web can keep the web view on the app's pages |
   | The sign-in and sign-up frame: the logo's link to the homepage and the legal foot (AGB, and Widerruf and Kündigen in a payments build) | `account/auth/auth-shell.tsx` | The app signs in natively; the web shows these pages only for a moment, when the web view's session has ended (plan §1.2 step 5) |
   | Settings: "Abmelden" | `settings-screen.tsx` | Signing out is the app's own row (plan §1.1, §1.2 step 7): it ends the web view's session with the app's and wipes the device. A web-only sign-out would land on `/login`, which the app answers with a new hand-off, so the row would seem to do nothing (2.1) |
   | "Linkyo als App" in Settings and Home's install hint (the hint is not used up in the app) | `install/install-row.tsx`, `install/install-hint.tsx` | The app is the app (ADR 0086) |

   Where a link may lead inside the app's web view: the dashboard (`/<l>/app/**`), help, contact, the legal
   pages, Sicherheit, and the sign-in pages; `e2e/app-mode-app.spec.ts` walks every link a person can reach
   from help, contact, the legal and the sign-in pages, and from every dashboard screen (Home, Seite, Design,
   Arbeiten, Statistik, Settings and its panes, Einladen, the AI builder, "View my page") and a dashboard 404,
   in German and Arabic, two levels deep, every `<details>` opened first, and fails on any other page, a "€",
   or (on a dashboard screen) the word "Pro" outside the creator's own content.
   A link that opens a new window (the sign-up form's AGB and Datenschutz words, `target="_blank"`) and a
   link to another host are real navigations, which the app's policy sees: the app opens them outside its
   web view (in Safari), never a purchase page.

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
   | `ready` | `bridge` (the web's contract version, `BRIDGE_VERSION` = 1), `signedIn`, `accountId` (or null) | the island: the first message each time the dashboard mounts (a page load of a dashboard page, a return to the dashboard from a page outside it, a change of language), each time the browser restores a dashboard page from its back/forward cache (the app's `goBack()` after a page it loaded itself: nothing mounts again, so the island listens for `pageshow` with `persisted`), once the session is known, and again whenever the session changes. All five methods (`navigate`, `back`, `flush`, `reload`, `signOut`) are installed before it |
   | `route` | `path` (with the language, `/de/app/settings/plan`), `title` (the screen's name in the page's language, from `features/app/routes.ts`; null for screens outside that table: the welcome flow, "View my page", the AI builder, an order, a proposal), `back` (the path back leads to, or null) | the island: right after each `ready`, then on every screen change |
   | `share` | `title?`, `text?`, `url?`, `file?` `{name, mime, base64}` | Home's link (`share-tools.tsx`), the QR sheet (`share-qr.tsx`), the story picture (`share-image-sheet.tsx`), the invite link (`invite/invite-link-card.tsx`), and the creator page's own share button in "View my page" (`directions/poster/share-island.tsx`: the page's public address, `pageUrl(username)`, which the dashboard names on `data-share-url` around the page; never `/<l>/app/preview`, in a browser too) |
   | `download` | `name`, `mime`, `base64` | the data export (`settings-screen.tsx`), the statistics CSV (`analytics-screen.tsx`), the story picture, the QR code as PNG and as SVG, the Premium kit's story pictures (`proposals/proposal-screen.tsx`: fetched from their signed Storage address by `appDownloadFrom`, as Storage is another host the web view does not open; a failed fetch says so in a toast), and a planned live's reminder in "View my page" (`directions/poster/live-time.ts` `remind()`: `live.ics`, `text/calendar`, UTF-8) |
   | `haptic` | `style: "light"` | `lib/haptics.ts` (every `haptic()` of a user's tap) |
   | `editClosed` | `id`, `missing?` (`true`) | the editor, when the sheet `?edit=<id>` opened closes (saved, cancelled, the block deleted, or replaced by a later `?edit=` for another block); with `missing: true` at once when the page has no block of that id (deleted on another device, a stale list): no sheet opens, so the app pops back to its list instead of waiting. An empty id (`?edit=`) posts nothing (decision 5) |
   | `openExternal` | `url` (absolute, this site only) | the AGB row |
   | `saveState`, `signedOut` | the store's ([0088](0088-app-sync.md)) | `features/app-mode/store-bridge.ts` |

   **The order of the messages.** `ready` is always the first message after the dashboard mounts; `route` (the
   screen shown) follows it, then the store's `saveState` (`store-bridge.ts` holds an account's save state until
   the `ready` that names that account: `announceReady` in `app-object.ts`). Each mount, and each restore from the
   back/forward cache, sends all three again, `saveState` too when it has not changed (a page left for that cache
   sends nothing until it is back): the app takes every `ready` as "the web view has (re)installed its methods and
   says where it is", and re-reads the state from the messages after it. When the session ends: `signedOut`, then `ready` (`signedIn: false`) and
   `route`. Pages outside the dashboard send no `ready`; their few messages (`haptic`, a creator page's `share`)
   need none. `e2e/app-sync-app.spec.ts` (real accounts) and `e2e/app-mode-app.spec.ts` (the demo) check the
   order on a cold load, after a sign-out, on a return to the dashboard and on a restore from the back/forward cache
   (a Chromium with that cache on: help loaded as a page of its own, then `goBack()`).

   App → web on `window.linkyoApp` (created by the web if the app's script has not made it):
   - `navigate(path)`: a dashboard path, `/<locale>/app` or below, with or without the language
     (`/de/app/editor?edit=b1`, `/app/design`); the client router, so no reload and nothing the store holds is
     lost. Answers false for anything else: a page of this site outside the dashboard (the homepage, help, a
     legal page, checkout), which the app loads itself so that its navigation policy sees it (a `pushState`
     never asks `WKNavigationDelegate`), another host, `//…`, a backslash, a non-string, more than 2048
     characters.
   - `back()`: goes where the current screen's `route.back` leads; false where there is none.
   - `flush()`, `reload()`, `signOut()`: the store's half ([0088](0088-app-sync.md), `store-bridge.ts`).
   - **All five exist only while a dashboard page (`/<locale>/app/…`) is shown.** They are installed by the
     dashboard's layout (`app-mode-island.tsx`, `store-bridge.ts`) and taken off when the web view leaves it:
     the router's links from the dashboard to a legal page or help (Settings' Impressum and Datenschutz rows)
     keep the same document but leave `window.linkyoApp` without methods. Before it calls `flush()`, `reload()`
     or `signOut()` (a native write, sign-out, deletion: plan §1.2, §1.3), the app checks that the web view is
     on the dashboard by `WKWebView.url`, which it observes with KVO (it changes on `pushState` too): a path at
     or below `/<locale>/app`. Never by its last `route`: leaving the dashboard by such a router link sends
     nothing, so the last `route` still names Settings while the web view shows Datenschutz. Off the dashboard
     the app draws its own title from `WKWebView.title` and goes back with `goBack()`; `navigate` and `back` are
     not there (calling one throws a `TypeError`). If it is not on the dashboard, the app brings it back
     (`goBack()`, or loads `/<locale>/app`) and waits for the `ready` that follows. A native write made while the web view was away is
     followed by `reload()` after that `ready`: the store does not read the row again by itself when the
     dashboard mounts again, so without it the next edit would be refused with the conflict toast.

5. **The editor's deep link.** `/<locale>/app/editor?edit=<blockId>` opens that block's sheet once; an unknown id
   opens nothing. The address loses the parameter first (`replaceState`), so a reload or Back does not reopen
   it. The sheet opens a task after the screen's effects, because the shell closes every sheet when the screen
   changes (`navigate()` from Home). It works in a browser too. In the app, closing that sheet posts
   `editClosed {id}`; an unknown id posts `editClosed {id, missing: true}` at once (`editLinkOutcome` in
   `features/app/edit-link.ts`); a sheet opened from the list posts nothing. An empty id (`?edit=`) asks for no
   block: it opens nothing and posts nothing. A second `?edit=` while the sheet an earlier one opened is still open
   replaces that sheet and posts `editClosed {id}` for the earlier block before the second opens
   (`editLinkReplaces`): every link the app sends gets its own `editClosed`.

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

9. **The lead's decisions on the last review (integration, 2026-11-26).**
   - **The plan pane names the plan and its state, nothing else.** The account's own plan, "Linkyo Pro"
     (bought on the web, given by the team, or the invite reward), is named: App Store 3.1.3(b) lets an app
     show what an account has bought elsewhere, and hiding it would make the pane say less than the truth.
     Its states that ask for nothing stay (Aktiv, Gekündigt, Reserviert) with its dates; everything else on
     the pane is hidden in the app: the source line (a price, Stripe, the team, "Pro für immer"), the feature
     list, the past-due badge and note (a past-due account shows no badge rather than a false "Aktiv"), and
     the payment group (decision 2). A past-due account shows the plan's name only: no badge, and no "Verlängert
     sich am …" either, which without its state would read as a healthy plan that renews. The "Pro" rule allows
     the word only inside the plan's name there: Settings' plan row shows no plan name in the app (it reads
     "Plan" and leads to the pane) (`plan-app-mode.test.ts`; `e2e/plan-app.spec.ts` in the stub build, for a
     reward, team, Stripe, canceled and past-due account, and Settings for a Stripe account).
   - **No hint at an unlock:** the AI's app words say the drafts are not available for this account
     ("nicht verfügbar"), never "nicht freigeschaltet" (decision 2).
   - **The privacy policy stays as it is in the app.** Its text (`features/legal/texts.ts`) names Linkyo Pro
     and Stripe in running text, as the processor of paid services, with no link to a purchase: a legal text,
     not an offer. A note for the lawyer (plan W8): whether the policy should say that the app shows the
     dashboard in a web view, and that views from the app are not counted (decision 6).
   - **One predicate, one sender:** the store's half (`store-bridge.ts`, [0088](0088-app-sync.md)) now asks
     `inAppMode()` and the main frame and posts `saveState` and `signedOut` through `post()`; both halves put
     their methods on `window.linkyoApp` through `installOnApp`, which never replaces the object or the
     other half's methods, whichever mounts first (`store-bridge.test.ts`).
   - **The signal everywhere React renders a document anew:** the dashboard's island restores `data-app`
     once, and the root layout's own error page restores it and leads only back to the dashboard
     (decisions 1 and 2).
   - **The contract review (integration, 2026-11-26):** `ready` comes first (decision 4); `navigate` takes
     dashboard paths only; the five methods exist only on dashboard pages, and the app brings the web view
     back before it calls the store's three (decision 4); a frozen or sealed app object never breaks the
     dashboard (decision 1); `ready` carries the web's contract version; and the plan pane of a past-due
     account shows only the plan's name (no renewal date, which would read as a healthy plan without its
     state), while Settings' plan row names no plan in the app at all (decision 2; the name stands only on the
     pane).

10. **The lead's decisions on the third review (integration, 2026-11-26).**
    - **A 401 is not a wipe** ([0088](0088-app-sync.md) §1): only Supabase Auth's own error codes make the app's
      routes answer 401; the app answers a 401 with one refresh and wipes only when that refresh is refused ("For
      the native shell" item 10).
    - **The AI sheet's way to the plan** reads "Zu deinem Plan" in the app (`appMode.ai.plan`): the pane shows no
      feature list there, so "Was dein Plan enthält" would promise what it hides (decision 2).
    - **The used-up draft names no "free":** `appMode.ai.quotaFree` says "Deinen KI-Entwurf hast du genutzt.
      Weitere Entwürfe gibt es für dieses Konto nicht." A free draft set against paid ones points at a plan to buy
      (3.1.3(f)); `app-mode-wording.test.ts` holds it free of "kostenlos", "free" and "مجاني".
    - **Settings' legal group is "Rechtliches"** in the app (`appMode.settings.legal`): it holds no contract
      there, only the Impressum, the privacy policy and the AGB (decision 2).
    - **`?edit=`:** an empty id posts nothing; a second link replaces the sheet an earlier one opened and posts
      `editClosed` for the earlier block first (decision 5).
    - **The proposal screen's refund line stays** in the app (`proposals/proposal-screen.tsx`, `data-refund-line`:
      "Gefällt er dir nicht? Schreib uns bis 14 Tage nach der Übergabe …, und du bekommst den vollen Preis
      zurück."), accepted: consumer information about a service bought on the web, with no price, no link and no
      way to buy.
    - **A rejection's reason is read through the app's own wrapper**, never from WebKit's error ("For the native
      shell" item 1), and `ready.accountId` is a lowercase UUID string the app compares case-insensitively (item 3).

**For the native shell.** What the app has to do to use this contract (and [0088](0088-app-sync.md)'s
operations), in one place:

1. **One content world.** The document-start script, the message handler and every call run in
   `WKContentWorld.page`: each world has its own `window`, so a `window.linkyoApp` made in another world has none
   of the web's methods, and a handler in another world hears nothing. The script is a `WKUserScript` with
   `injectionTime: .atDocumentStart` and `forMainFrameOnly: true`; the handler is added with
   `add(_:contentWorld:name:)` as `linkyo` in `.page`. The app calls the methods with
   `callAsyncJavaScript(_:arguments:in:in:)` in `.page`, through a wrapper of its own that always resolves, so
   the reason never has to come out of WebKit's error:

   ```js
   try { return {ok:true, value: await window.linkyoApp.flush()} } catch (e) { return {ok:false, reason: String(e && e.message || e)} }
   ```

   (the same for `reload()` and `signOut()`). `value` is `{ updatedAt }` for `flush()`; `reason` is the bare reason
   (`saveFailed`, `storeLoading`, …, [0088](0088-app-sync.md) §4: the web rejects with a `BridgeRejection` from
   `store-bridge.ts`, whose message and string form are both the reason), or a `TypeError`'s message off the
   dashboard. WebKit's own `userInfo[WKJavaScriptExceptionMessage]` is not part of the contract: a private key whose
   text may change. `return window.linkyoApp.navigate(path)` with `arguments: ["path": path]`, and `back()`,
   answer a boolean at once.
2. **After `ready`, all five methods are there** (`flush`, `reload` and `signOut` too, not only `navigate` and
   `back`), while the web view shows a dashboard page (decision 4).
3. **`ready.accountId` is checked.** The app compares it with its own user id: another account (the cookies of
   an earlier account in the web view) means a new hand-off; `signedIn: false` too (as on `/<locale>/login`,
   [0088](0088-app-sync.md) §1). `accountId` is the account's UUID as a **lowercase** string (Supabase's
   `user.id`); the app compares it case-insensitively (`UUID(uuidString:)` on both sides, or both lowercased),
   since Swift's `UUID.uuidString` is upper case.
4. **`ready` may never come** (a script chunk that fails to load, an error page): after a load or a hand-off the
   app waits at most about 15 s, then shows its own error view with "Try again" (a reload, or a new hand-off).
5. **Versions.** `ready.bridge` is the web's contract version (`BRIDGE_VERSION`, 1); the app's object carries the
   app's (`bridge: 1`). The web deploys continuously and installed apps lag behind, so the contract only grows:
   messages, fields and methods are added, never renamed or removed, and the app ignores what it does not know.
   A change an older app could not follow raises the version, and the web then reads `window.linkyoApp.bridge`
   and keeps the old way for a lower one (nothing in version 1 depends on it yet).
6. **`saveState` after a refused save.** `conflict` stays the last state until the next change (the newer page
   is shown and saved; no `saved` follows). `saving` carries the version the save builds on (the old one); the
   new version comes with the `saved` after it.
7. **`download.mime` may carry parameters** (`text/csv;charset=utf-8` for the statistics CSV): the app takes the
   type before `;` for the file type and the `charset` for text.
8. **`?edit=` and `?tab=` after the hand-off.** The hand-off's `next` is a dashboard path without a query
   ([0088](0088-app-sync.md) §1), so the app opens a block's sheet or a tab with `navigate()` after the first
   `ready`.
9. **Where the web view is: `WKWebView.url`.** The app observes `url` and `title` with KVO; both change on a
   `pushState` too. A path at or below `/<locale>/app` is the dashboard: its native title and back button come
   from the last `route`. Any other path (help, contact, a legal page, the sign-in pages, reached by a router link
   that sends no message, or loaded by the app) is a page outside it: the app shows `WKWebView.title` and goes
   back with `goBack()`, and calls none of the five methods there (they are not there: a `TypeError`). The last
   `route` never decides where the web view is (decision 4).
10. **A 401 is answered with one refresh, never a wipe by itself** ([0088](0088-app-sync.md) §1). On a 401 from
    `/api/auth/handoff`, `/api/app/page` or any other Bearer route, the app refreshes its session once and repeats
    the call. It signs out and wipes the device only when that refresh fails with `invalid_grant`,
    `refresh_token_not_found`, `session_not_found` or `user_not_found` (plan §1.2 step 9); a 401 right after a
    successful refresh is treated like a 503 (try again later, never wipe). The routes answer 401 only for
    Supabase Auth's own codes about the token; a gateway's "Invalid API key" or a firewall's 403 is a 503.

**Consequences.**

- Weight: the dashboard's first load grows by 1.4 KB with the first round (321.9 → 323.3 KB of 350) and is
  323.1 KB after the second; creator pages carry the bridge's core (it reaches them through `lib/haptics.ts`;
  the file helpers stay in the dashboard's chunks) and, since the second round, the share button's and the
  reminder's use of it (+0.16 to +0.21 KB): page code `/u/<name>` 30.2 → 30.4 KB, `/u/<name>/<project>`
  23.3 → 23.5 KB, `/<l>/p/<slug>` 32.0 → 32.2 KB, `/<l>/p/<slug>/<project>` 26.4 → 26.5 KB (budget 35 KB);
  the website's pages +0.18 KB (the signal's restore, the theme script's platform list, the people search's
  check); `/de`'s HTML 54.2 → 54.3 KB of 60. The integration (decision 9) adds 0.4 KB to every page: the root
  layout's error page, whose code every page carries, restores the signal and knows the dashboard's way out
  (its chunk 2.27 → 2.68 KB); `linkyoApp()` and `installOnApp` live in `app-object.ts`, which only the
  dashboard loads, so the bridge's core on creator pages did not grow. Page code `/u/<name>` 30.4 → 30.8 KB,
  `/u/<name>/<project>` 23.5 → 23.9 KB, `/<l>/p/<slug>` 32.2 → 32.6 KB, `/<l>/p/<slug>/<project>` 26.5 →
  26.9 KB (budget 35 KB); the dashboard's first load 324.1 → 324.5 KB of 350; `/de`'s HTML stays 54.3 KB.
  The contract review (decision 9) adds 0.4 KB to the dashboard's first load (324.5 → 324.9 KB of 350, demo
  and real builds alike: the order of the first messages, the copy of a frozen object, the dashboard-only
  `navigate`); creator pages and the website stay as they were, apart from `/<l>/p/<slug>/<project>`
  26.9 → 27.0 KB in the demo build; `/de`'s HTML stays 54.3 KB (demo) and 55.3 KB (real).
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
  The contract review added: `store-bridge.test.ts` (the save state held until the `ready` that names its
  account, again after a remount and after every new `ready`, also unchanged; a frozen, sealed or non-extensible app object, a read-only
  `window.linkyoApp` and a fixed property never throw), `route.test.ts` (`navigate` refuses every page outside
  the dashboard), `adr-contract.test.ts` (both ADRs name what the code answers), and in
  `e2e/app-mode-app.spec.ts` and `e2e/app-sync-app.spec.ts` the order `ready`, `route`, `saveState` on a cold
  load, after a sign-out and on a return from Datenschutz, where the five methods are gone, and on a restore
  from the back/forward cache after help was loaded as a page of its own.
- Open for the app (native): the navigation policy still has to send `/checkout`, `/service`, `/kuendigen`,
  `/widerruf`, the team area and every other host to Safari (plan §1.6); the web no longer links them from the
  dashboard in app mode, and `navigate()` takes dashboard paths only, so every other page reaches the web view
  as a real navigation the policy sees; the policy is the guarantee.
- Closed by the lead (decision 9): the store's half asks `inAppMode()` and the main frame like the rest, and
  the plan pane names the plan, "Linkyo Pro", with its state only.
- Not covered here: the privacy policy's wording for the app (W8, a note for the lawyer, decision 9).
