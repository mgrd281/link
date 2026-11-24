# 0074 — Dead ends: real 404s behind the gates, Linkyo's own error pages, and a launch gate for the legal texts

**Context.** The audit (L-03, W-03, W-13, L-02) found that every unknown address showed Next's bare English 404
without a language or a way back, that `/de/app/orders/x1` and `/de/admin/orders` answered 200 although their pages
call `notFound()`, that sign-up and log-in offered a "Weiter mit Google" button that only said "kommt zum Start", and
that nothing stopped a launch with the legal drafts still marked "Entwurf" and full of "[vom Anwalt zu prüfen]".

**Why the gated pages answered 200.** `/app` and `/admin` sit behind a gate in the browser (`AppGate`, `AdminGate`):
the session is read there (demo accounts live in local storage), and until it is read the gate renders its splash,
not its children. The server therefore never renders the page while it streams the response, never meets the page's
`notFound()`, and the status stays 200; the browser shows the not-found UI only later. A `loading.tsx` or a Suspense
boundary was not involved.

**Decision.**

- **Statically impossible addresses are answered next to the gate.** `features/errors/gated-routes.ts` holds the rule
  (orders and proposals need payments and an order id). The `/app` and `/admin` layouts render `GatedRouteCheck`
  beside the gate: it reads the route's segments (`useSelectedLayoutSegments`) and calls `notFound()` while the
  server renders, so the status is a real 404, signed in or not. The pages keep their own check as the second line
  and share the rule.
- **One catch-all per language.** `app/[locale]/[...rest]` calls `notFound()`, so every unknown address under a
  language (including `/de/app/xyz` and `/de/admin/xyz`) is answered by `app/[locale]/not-found.tsx` inside the
  language's layout: `lang` and `dir` are right, the h1 is in that language, and the page takes the colours of the
  part the address belongs to (the dashboard's black and grey through `data-console`, teal elsewhere) with that
  part's way back (Dashboard, Teambereich, or Startseite and Vorlagen). There are no catch-alls inside the shells:
  behind the gate they would have turned today's 404 into a 200.
- **Error pages.** `app/[locale]/error.tsx`, `admin/(shell)/error.tsx`, `app/welcome/error.tsx`,
  `app/build/error.tsx` and `app/global-error.tsx` show Linkyo's page with "try again" and the way back. The global
  error page carries its few words itself (the message provider is gone when it shows, and its code is sent with every
  page); a unit test keeps them equal to `errors.*` in the message files.
- **`app/global-not-found.tsx`** (with `experimental.globalNotFound`) answers addresses no route matches at all,
  German by default with the three languages. It reads no request, so it stays static. Today every address matches
  `[locale]` (the proxy adds a language, and the rest fall into `[locale]/[...rest]`), so it is a safety net.
- **A static title on the not-found page.** `app/[locale]/not-found.tsx` is titled "404 · Linkyo" in every language:
  it also answers the locale layout's own `notFound()`, where no language is set for the request, and a translated
  title would read the request headers and turn a statically rendered route into a 500.
- **No fake buttons.** The Google button and the "oder" divider are gone from sign-up and log-in until Google sign-in
  exists. An empty email field now says what is missing; only a typed address that is not one "looks incomplete".
- **Launch gate.** `assertLiveReady` also takes `LAUNCH` (passed by `next.config.ts`). With `LAUNCH=1` a build fails
  while a bracketed marker is left in the legal texts, the company data is missing or `LEGAL_REVIEWED` is not `1`: the
  same three conditions that show the "Entwurf" banner on the legal pages. Preview builds pass. English and Arabic
  pages say the German text is the binding one.

**Consequences.**

- Next 16 answers a page-level `notFound()` with an empty error shell that the browser fills: the status and the
  `noindex` are in the response, the localized page appears once the script runs.
- Addresses whose first segment is no language (`/u/a/b/c`, `/x.php`) still reach `app/[locale]/layout.tsx` with
  an unknown language; its `notFound()` has no boundary above it and shows Next's built-in page (status 404). Fixing
  that needs the locale layout or the proxy (not in this change).
- Data-dependent misses inside the shells (an unknown customer id in the demo) still show the screen's own message
  with status 200: the data lives in the browser. A rule that can be decided from the address alone belongs in
  `gated-routes.ts`. The shells' own `not-found.tsx` files catch a future screen's `notFound()` inside the frame.

**Status.** Accepted (Stage 1, WP1.2, 2026-11-24).
