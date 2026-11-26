# Draft — Linkyo installs as an app (Windows, Mac, Linux, Android, iPhone and iPad)

**Status.** Proposed (Stage 4, PWA work package, 2026-11-26). The integrator gives it the next free number
(0086 at the time of writing). Replaces the single `app/manifest.ts` of the "native feel on phones" pass.

**Context.** The founder wants Linkyo as an app on phones and on computers. A native iPhone app follows separately
(it needs a Mac to build). Until then the existing product should install for free from the website wherever a
browser can install a site: Chrome and Edge on Windows, Mac, Linux and Android (an install button), Safari on
iPhone and iPad ("Zum Home-Bildschirm"), Safari on a Mac ("Zum Dock hinzufügen"). Opened from its icon, the
dashboard should run in its own window. There was one manifest for everyone, in German, starting at `/app`, with
one full-bleed icon used both as "any" and "maskable"; no service worker, no share target, no way in the dashboard
to install.

**Decision.**

1. **One manifest per language** (`features/pwa/manifest.ts`), served at `/<locale>/manifest.webmanifest` by a
   static route and linked by the language's root layout (`app/[locale]/layout.tsx`, `metadata.manifest`).
   - `id` `/app` in every language: one app, and the identity the first manifest implied (its `start_url` was
     `/app`), so an app installed from it is updated, not duplicated.
   - `name` "Linkyo"; `short_name`, `description`, the shortcuts' and screenshots' words under `pwa.*` (de, en,
     ar; server-only: `pwa` is left out of every client message group). `lang`, `dir` (`rtl` for Arabic).
   - `start_url` `/<locale>/app?source=app`, `scope` `/`, `display` `standalone`. No `display_override`: the
     dashboard does not draw into a title bar, so it does not ask for window-controls-overlay.
   - `theme_color` and `background_color`: the dashboard's grey ground, `semantic.canvasMuted.console.light`
     (`#F5F5F7`, ADR 0062). A manifest has one colour of each; **dark mode** is the page's own: the dashboard's two
     `theme-color` metas (one per colour scheme) take over the window's title bar as soon as it has loaded, and
     its ground is dark. Only Android's launch screen, drawn before the page, stays light in dark mode; browsers
     have no dark manifest colours yet.
   - `categories` social, productivity, business; `launch_handler` `{ client_mode: "focus-existing" }`: a start
     while the app's window is open brings that window to the front instead of opening a second one. Chrome
     and Edge then load nothing themselves: they hand the address to `window.launchQueue`. A few bytes in the
     head script of every `/<locale>` page (`lib/launch-queue-script.ts`, beside the install script) take it
     and load it in the window, so a shortcut opens its screen and a share opens the Add sheet there too. Only
     an address of this site that differs from the page shown is loaded; a plain start from the icon (the
     start address with `source=app`) only brings the window to the front, so the owner stays on the screen
     they were on; the launch that opened the window (its parameters arrive while the page is still loading)
     is not loaded twice. A full page load: whatever was typed in an open sheet is gone, as with any address
     opened in that window. Creator pages under `/u` do not carry the script: a window that shows one only
     comes to the front.
   - `icons` (`scripts/generate-app-icons.mjs`, drawn by Chromium from the brand files `logo.mjs` writes; no new
     drawing): 192 and 512 "any" = `public/favicon.svg`, the rounded teal tile on a clear ground; 512
     "maskable" = `brand/svg/app-icon-light.svg` (the iOS app icon), teal to the edges with the y at 56 % of the
     height, farthest pixel 175 px from the centre against the 204.8 px safe circle (measured in
     `features/pwa/icons.test.ts`; the old full-bleed icon reached 202.6 px); 512 "monochrome" = the y alone,
     its brightness from `app-icon-tinted.svg` as the alpha.
   - `shortcuts`: Seite bearbeiten (`/app/editor`), Block hinzufügen (`/app?add=1`, Home opens the Add sheet),
     Statistik (`/app/analytics`), Teilen (`/app#home-link`, Home's link card with copy, share and QR code).
   - `screenshots` (`scripts/capture-app-screenshots.mjs`, from the demo build): the dashboard and the Poster
     prototype's page, phone (780 × 1688, narrow) and laptop (1440 × 900, wide), JPEG, each under 300 KB. One set
     per language under `public/screenshots/<locale>/`, so the install dialog shows the dashboard and the sample
     page in the reader's language (Arabic mirrored); each manifest names its own set. They show the fictional
     sample creator, Mila Aurel (in Arabic Nour Haddad; the language's sample page imported into a fresh demo
     account named after her), never a real person, with the privacy choice already made, so no notice
     covers the page; the dashboard's week numbers carry their sample-data badge.
   - `share_target` GET `/<locale>/app/share` with `title`, `text`, `url` (and `enctype`, which Chrome reports
     as missing otherwise).
2. **Share into Linkyo.** `app/[locale]/app/share/route.ts` finds the first http(s) address in url, then text,
   then title (`features/pwa/share-target.ts`: without the sentence's closing marks, keeping a bracket that
   belongs to the address, at most 2048 characters) and answers 303 to `/<locale>/app?shared=<link>`; Home
   (`features/app/install/home-intents.tsx`) removes the parameter from the address and opens the Add sheet
   holding the link, as if pasted, with its platform recognised: the owner taps Hinzufügen (or "as a project",
   "to the social icons", exactly as after a paste). Nothing usable: the sheet opens empty with "Im Geteilten war
   kein Link. Füg ihn hier ein." The link is checked again on Home, since anyone can type such an address.
   Signed out, the dashboard's gate sends `next=/app?shared=…` to sign-in, and `safeNext` lets exactly that
   form (`INTENT_RETURN`: `/app?add=1` or `/app?shared=<encoded>`) through; every other query is still dropped.
   **Android and desktop Chrome and Edge support share targets; iPhone and iPad do not** (Safari has no web share
   target); the native app will cover them.
3. **A service worker that only serves the dashboard** (`features/pwa/service-worker.ts`), plain JavaScript, no
   dependency, one per language at `/<locale>/app/sw.js` (static route), registered for the scope
   `/<locale>/app` (the script answers `Service-Worker-Allowed: /<locale>/app`, one step above its folder; no
   change to `next.config.ts`).
   - **Scope.** Creator pages (`/u/…`, `/<name>`, `/<locale>/p/…`), the website, sign-in and the team area lie
     outside it and are never controlled; the fetch handler checks the path again (a scope is a prefix:
     `/de/app` also matches `/de/apple`).
   - **Registration.** Only the dashboard's layout renders the island (`service-worker-island.tsx`), after the
     page's `load` event. Nothing else on the site registers a worker.
   - **What it does.** Page loads of the dashboard go to the network (navigation preload, so the worker costs no
     waiting); when the connection fails it answers with the offline page of its language
     (`features/pwa/offline-page.ts`): the console palette in light and dark (and the stored theme), the symbol
     from `public/favicon.svg` recoloured to the mono tone, "Keine Verbindung", one sentence and "Erneut
     versuchen", which reloads (as does the `online` event). An answer from the server (404, 500) is shown as it
     is. The page lives in the worker's own script, so **nothing is cached**: no Cache Storage, no API
     responses, no account data, no Supabase calls, no pictures. Every request that is not a page load goes
     straight to the network: Chrome 123+ routes it there without waking the worker (static routing, `or` of
     the request modes), elsewhere the handler leaves it alone. This also keeps test stubs (`page.route`)
     working.
   - **Updates.** The script carries its build's time as its version (static route: written once per build), the
     dashboard registers it with `updateViaCache: "none"`, and a window coming back to the front asks for an
     update at most hourly (`features/pwa/register.ts`, unit-tested with a stand-in browser). A new worker takes
     over at once (`skipWaiting`, `clients.claim`): it holds no cache and no state, so there is nothing to hand
     over. The worker never serves the dashboard's code, so what an open window runs is decided by Next, not by
     the worker: **a deploy does not change a window that is already open at once**. The window keeps the old
     code until its next navigation; there Next notices the new build (its build id differs) and loads the page
     in full from the network, with the new code. A window that stays on one screen changes when it is
     reloaded or next navigates.
4. **Install in the dashboard.** Settings › App gets "Linkyo als App" (`icons.install`, a new registry meaning:
   `MonitorSmartphone`), "Installiert" as its value inside the app. Its sheet shows only what works on the device
   (`features/app/install/device.ts`): Chrome, Edge, Samsung Internet (Windows, Mac, Linux, Android) one
   "Installieren" button that opens the browser's own dialog; declined, where the browser's menu still offers it;
   iPhone and iPad (any browser there, since iOS 16.4) three steps with the share glyph; Safari 17+ on a Mac
   "Ablage › Zum Dock hinzufügen"; inside the app (display mode standalone or `navigator.standalone`) "Linkyo ist
   installiert"; Chrome, Edge, Samsung Internet or Opera without an offer (Chrome never offers an app that is
   already installed, nor in a private window, and the offer can come after the page) "if Linkyo is installed,
   open it from its icon; if not, the browser's menu installs it, except in a private window"; anything else
   (Firefox on a computer, an older Safari) a plain sentence that Chrome, Edge and Safari can install it. The
   Arabic texts keep Linkyo, Safari, Mac, Dock, Chrome and Edge in `<bdi>` (rendered with `t.rich`; the sheet's
   title takes rich text). The X of Home's hint is 32 px to look at and a 48 px target on touch screens. Home
   shows a small
   hint with the same button where the browser offers to install, once per browser (`localStorage`
   `linkyo.installHint`, written when it shows; blocked storage shows none), dismissible. No word about
   notifications or the App Store.
   - **The browser's offer is kept from the first page.** Chrome fires `beforeinstallprompt` once per page load,
     usually on the page where the visit began (the website or sign-in), before the dashboard exists. A few
     bytes in the head script of every `/<locale>` page (`lib/install-prompt-script.ts`, beside the theme
     script) keep the event for the dashboard and hold back the browser's own banner, so nobody is asked to
     install a dashboard before they have one; the address bar's install button stays. Creator pages under `/u`
     have their own root layout and do not carry it.
5. **Head tags.** `mobile-web-app-capable` (Next writes it for `appleWebApp.capable`) and
   `apple-mobile-web-app-capable` (iOS before 16.4 reads only this one), `apple-mobile-web-app-title`, the
   status bar style `default` (the dashboard's top bar does not reach under the status bar) and a `theme-color`
   per scheme stay. **iOS start:** the server's first paint of `/<locale>/app?source=app` is the dashboard's grey
   ground (the splash frame, `body:has([data-grouped])`), the manifest's background colour, so a start from the
   icon shows no white (tested with scripts off).

**Consequences.**

- `app/manifest.ts` is gone; `/manifest.webmanifest` answers 404. Creator pages under `/u` no longer link a
  manifest, so a visitor of a creator's page is never offered to install Linkyo's dashboard; the example pages
  under `/<locale>/p` link their language's manifest like every website page (as before).
- The dashboard's files: the island in `app/[locale]/app/layout.tsx`, the row in `settings-screen.tsx`, the hint
  and the intents on Home, a few lines in `add-sheet.tsx` (the shared link in the field, the note) and in
  `gate.tsx` (the way back after sign-in), and the `INTENT_RETURN` form in `features/account/auth/shared.tsx`.
- Tests: `features/pwa/*.test.ts` (each manifest field per language, icon sizes and the measured safe zone, the
  worker run in a stand-in worker scope, the offline page, the shared link and the way through sign-in),
  `features/app/install/device.test.ts`, `features/app/install/install-messages.test.ts` (the Arabic `<bdi>`),
  `lib/launch-queue-script.test.ts`, and `e2e/pwa-app.spec.ts` (Chrome's `Page.getInstallabilityErrors`
  empty for `/de/app`, `/en/app`, `/ar/app` in a normal profile; the worker controls the dashboard and not
  `/u/<demo user>`, `/de/p/ronja-feldkamp`, the website or sign-in; no page outside the dashboard registers
  one, checked after hydration and for two seconds more, and a real page under `/u` with the Supabase
  stand-in (`E2E_STUB=1`, its own build) registers none and is never controlled; offline pages in de, en
  and ar; sharing, also through sign-in and into an open window through a stand-in launch queue; the sheet's
  variant per device; axe in three languages, light and dark; the hint once, and its X measured as a touch
  target).
- Not done, on purpose: window-controls-overlay, push notifications, offline editing, a listing in an app store.
  A dark launch screen waits for a dark manifest colour in browsers.
- Open: the example pages under `/<locale>/p` use the website's layout, so they link the manifest and Chrome's
  address bar offers to install Linkyo's dashboard there too (as with the single manifest before; no cookie,
  no request elsewhere, never controlled by the worker). A share made by a signed-in account that has not
  finished the welcome flow is dropped when the gate sends it to the welcome; carrying it through is a
  follow-up.
