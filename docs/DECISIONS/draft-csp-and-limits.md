# draft — A static Content-Security-Policy (report-only first), in-route rate limits, and consent that gates

**Status.** Proposed (Stage 4, WP4.4: E-05, E-06, E-09 and housekeeping; leftover 16). The lead numbers it.
Extends [0088](0088-app-sync.md) (the iPhone app's two routes get limits, a device binding, a body cap and their own
405) and [0008](0008-creator-page-performance.md) (creator pages stay ISR: no nonce).

**Context.** Pages that render user content had no Content-Security-Policy (E-05). The routes that cost something
per request had no limit (E-06): `/api/import-links` fetches a page from another host, `/api/link-metadata` asks a
platform (and spends the shared 60-an-hour GitHub quota), `/api/admin/verify` checks the team code, `/api/auth/code`
sends an e-mail and `/api/auth/verify` checks a 6-digit code; `/api/prepared` told anyone, before any e-mail was
proven, whether the team prepared a page for an address. `/forgot` and `/reset-password` were pages that only
redirect (E-09). On creator pages the external-content choice gated nothing: a tap loaded YouTube after "Nur
notwendige" too, and TikTok, Instagram and Vimeo cards said "Der Player lädt hier" where no player ever loads
(leftover 16).

**Decision.**

1. **A static policy, sent report-only** (`src/lib/csp.ts`, `next.config.ts` headers). Static because creator pages
   are ISR (`revalidate`), and a nonce needs a render per request; `src/proxy.ts` is untouched. Report-only first
   (the lead's decision): the switch to enforcing is the one line `CSP_HEADER` after a clean week of reports.

   The policy on every page:

   ```
   default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob: [S]; font-src 'self'; connect-src 'self' [S]; media-src 'self';
   frame-src https://www.youtube-nocookie.com; worker-src 'self'; manifest-src 'self'; object-src 'none';
   base-uri 'self'; form-action 'self'; frame-ancestors 'none'; report-uri /api/csp-report; report-to csp
   ```

   `[S]` is this build's `NEXT_PUBLIC_SUPABASE_URL` origin, only when real accounts are on. Why each source:
   - `script-src 'unsafe-inline'`: Next.js streams the React payload in inline scripts (`self.__next_f.push(…)`)
     whose content differs per page and request, and the app has small inline scripts before hydration (theme,
     nav panel, launch queue, install prompt). No nonce (static) and no fixed content (no hashes) leave only
     `'unsafe-inline'`. Script files still come only from our origin. No `'unsafe-eval'`: Zod's one probe
     (`new Function("")`) is switched off in the browser (`src/instrumentation-client.ts`, `jitless`), so no
     page reports `eval`.
   - `style-src 'unsafe-inline'`: React `style` attributes (creator colours, focal points) and the creator
     routes' small `<style>` blocks.
   - `img-src data: blob:`: the QR code and inline pictures (data URLs), the share picture and a picture being
     uploaded (blob URLs). Platform and Storage pictures go through our image optimizer, so no picture host is
     listed, except `[S]` where the team area shows a Storage file itself (signed addresses of order photos).
   - `connect-src [S]`: the dashboard and the team area talk to Supabase from the browser with real accounts.
   - `frame-src https://www.youtube-nocookie.com`: the only player a creator page embeds, after a tap.
   - `frame-ancestors`: `'self'` on `/<locale>/p/…` only (the templates gallery shows example pages in a frame);
     `'none'` everywhere else (`X-Frame-Options: SAMEORIGIN` stays as the enforced rule meanwhile).
   - `Reporting-Endpoints: csp="/api/csp-report"` names the `report-to` group.

   On `/<locale>/checkout/…` only, Stripe's documented hosts for the Payment Element join: `script-src
   https://js.stripe.com https://*.js.stripe.com`, `frame-src https://js.stripe.com https://*.js.stripe.com
   https://hooks.stripe.com`, `connect-src https://api.stripe.com`, `img-src https://*.stripe.com`. No other page
   names Stripe (`e2e/security-headers-app.spec.ts`; the static guard's rule 4 allows the address only in
   `stripe-js.tsx`, the legal text and `src/lib/csp.ts`).

   **Reports** go to `POST /api/csp-report`: no storage, no cookie, a body cap of 16 KB, 60 requests per address a
   minute, one log line per violation (`csp-report <directive> blocked=<origin+path or keyword> page=<origin+path>`,
   never a query string or the reporter's address), always 204 (429 past its limit).

2. **In-route limits** (`src/lib/rate-limit.ts`): a fixed window per key, in memory per server instance. It is a
   **first layer**: every Vercel function instance counts alone and forgets on a cold start, so a client spread
   over instances gets more; the firewall rules below are the second layer. Keys are HMACs under a secret made at
   start and held only in memory (`addressKey`, `valueKey`): no address or e-mail is ever stored, and a key means
   nothing outside its instance. The address is the one the routes already derive (`requestPlace`: the first
   `x-forwarded-for` entry, which Vercel sets itself). No address, or the loopback address, is never counted
   (local development and the e2e run, where every request comes from the machine; on Vercel a visitor is never
   loopback). Past a limit: 429 with `Retry-After` (seconds, at least 1) and `Cache-Control: no-store`.

   | Route | Limit | Why this number | Body at 429 |
   |---|---|---|---|
   | `POST /api/import-links` | 10 per address / 10 min | the welcome flow fetches once per pasted address; a person corrects it a few times | `{ ok: false, error: "failed" }` (the import box's "can't read this page now") |
   | `GET /api/link-metadata` | 60 per address / min | one call per added block with a platform link; an imported list of links arrives at once; answers are cached 1 h in the browser and 1 day at the CDN | `{}` (the editor keeps its placeholder) |
   | `POST /api/admin/verify` | 5 per address / 10 min, every try | a person types the team code once, maybe again after a typo | `{ ok: false, error: "tooManyAttempts" }` |
   | `POST /api/auth/code` | 10 per address and 5 per e-mail address / 15 min | each answer sends an e-mail; a person asks again when the first is slow | `{ ok: false, error: "tooManyAttempts" }` (the sign-in screens' existing words) |
   | `POST /api/auth/verify` | 15 per address and 10 per e-mail address / 15 min | one code, maybe two or three after a typo; on top of the 8 logged failures per account | same |
   | `POST /api/auth/handoff` | 30 per address and 10 per account / 10 min | one hand-off per landing on the login page, two failures stop the app (ADR 0088) | `{ ok: false, error: "tooManyRequests" }` |
   | `POST /api/app/page` | 60 per address and 30 per account / min | a native change is one deliberate act | same |
   | `POST /api/csp-report` | 60 per address / min | one report per violation | empty |

   The address limits are counted before anything else (also before Auth is asked on the app's routes). The
   e-mail limits hold for every client, the machine itself included.

   **`/api/prepared`** answers 404 with real accounts to everyone but the team (the team token, or a signed-in
   account `admin_me()` names a team role, as `/api/admin/prepared`). The sign-up form reads any refusal as
   "none", so with real accounts it shows no preview of a prepared page; `/api/auth/code` still gives the page to
   the address it was prepared for, once the code proves the address. A demo build answers as before.

   **The iPhone app's routes** (ADR 0088 names every answer): the limits above; the hand-off only for a session
   opened on the same device (its `session_id` has a successful `sign_ins` row with the request's `deviceId`, else
   403 `deviceMismatch`); a 4 KB body cap on the hand-off (413 `tooLarge`, refused before it is read whole,
   `src/lib/server/read-body.ts`); the blocked-address check on the page route (403 `blocked`); 405 with `Allow:
   POST` and `no-store` for `GET`, `PUT`, `PATCH`, `DELETE` on both. 401 stays only for Auth's own token codes,
   503 for an outage.

   **Vercel Firewall rules (ops; the lead decides, the plan may charge for rate-limit rules).** Custom rules,
   project `link-web`, production; each "Rate limit, fixed window, key: IP, action: Too Many Requests (429)":

   ```
   1  Path equals /api/auth/code        AND Method equals POST  →  20 requests / 600 s / IP
   2  Path equals /api/auth/verify      AND Method equals POST  →  30 requests / 600 s / IP
   3  Path equals /api/admin/verify     AND Method equals POST  →  10 requests / 600 s / IP
   4  Path equals /api/import-links     AND Method equals POST  →  20 requests / 600 s / IP
   5  Path equals /api/link-metadata                            → 120 requests /  60 s / IP
   6  Path starts with /api/auth/handoff OR Path equals /api/app/page → 120 requests / 60 s / IP
   7  Path equals /api/csp-report                               → 120 requests /  60 s / IP
   ```

   Each is about twice the in-route limit, so the in-route limit answers first with its own words and the firewall
   only stops what spreads over instances.

3. **Redirects (E-09).** `/<locale>/forgot` and `/<locale>/reset-password` answer 308 to `/<locale>/login` from
   `next.config.ts`, before any route renders; the two pages are deleted. Nothing in the app links to them (the
   reserved names stay reserved).

4. **One `Location`: checked, not fixable inside the route.** `/u/[username]/[project]` (revalidate 60) answers an
   earlier project address with `redirect()` from its render. Measured on the stub build (`next start`, Next.js
   16.4.6): the cache **miss** that renders it sends `Location` **twice** (the same address), every **hit** once.
   Next's ISR path sets the header on the response while rendering (`app-render.js`, `setHeader('location')`, also
   kept in the cache entry's headers) and then appends the cache entry's headers to the same response when it
   serves it (`app-page-runtime.js`, `appendHeader`). Any redirect thrown from a cached render does this (the
   layout, `generateMetadata` and `generateViewport` render in the same pass), so the route cannot avoid it while it
   stays ISR, and the address is data (the database), so neither `next.config.ts` nor a static rule can answer it
   first. Both copies name the same address, which browsers and crawlers follow. `e2e/security-headers-app.spec.ts`
   holds the check as an expected failure (`test.fail`, so it flips when Next.js sends one) and a passing check that
   a hit sends exactly one. Options for the lead: (a) leave it; (b) `src/proxy.ts` answers moved project addresses
   (it would need the page's `was` list, one database read per project address: not proposed); (c) serve the
   project at its old address with `rel=canonical` to the new one (no redirect; changes ADR behaviour and an @real
   test); (d) report it upstream and pick up the fix with a Next.js update.

5. **Consent that gates (leftover 16).** `features/directions/shared/players.tsx` (`ClickToLoadIsland`):
   - A YouTube card (the one player a page embeds, privacy mode) says where its video comes from ("Lädt erst nach
     deinem Tippen von YouTube", and "Von YouTube" in the corner of a small card), and its button's name says
     YouTube ("Video von YouTube abspielen: …"). Before any choice, that one tap loads the player.
   - After "Externe Inhalte erlauben" a tap plays at once (the card no longer needs to say it).
   - After "Nur notwendige" a tap first asks in the card: "Dieses Video kommt von YouTube. Laden?", "Beim Laden
     verbindet sich dein Browser mit YouTube.", "Video laden" (focus moves there) and "Auf YouTube ansehen". Only
     "Video laden" loads the player.
   - A YouTube address that names no video (a channel; an example's made-up address) loads no player: the tap
     says "Diese Adresse nennt kein Video von YouTube: Hier lädt kein Player."
   - TikTok, Instagram, Vimeo and every other card are links that open the platform ("Öffnet TikTok"), or "Öffnet
     den Link" when the address is not the platform's own (an example page's). "Der Player lädt hier" is gone.
   - The privacy notice lists only YouTube (`externalProviders`), and its sentences say what happens now: "Videos
     von YouTube laden erst, wenn du auf eines tippst." and, for the switch, "Videos von YouTube spielen beim
     ersten Tippen. Ausgeschaltet fragt jedes Video vorher."
   - Latin names sit in `<bdi>` in the new words; no cookie, nothing from another origin before the tap.

**Consequences.**

- Every page carries the report-only policy; a report means a source to add with a reason, or a defect to fix.
  Enforcing later blocks inline event handlers and `javascript:` addresses (none today).
- The browser's Zod parses without compiling (`jitless`); the server is unchanged.
- The in-route limits are per instance: honest as a first layer only. A self-hosted deployment without a proxy
  that sets `x-forwarded-for` lets a client pick its own key (no worse than no limit).
- The hand-off's device binding relies on the 30-day sign-in log: an app session opened more than 30 days ago
  gets 403 `deviceMismatch` and signs in again natively (ADR 0088 tells the app). Lead: keep this, or keep the
  log's newest row per session longer (a migration, not here).
- Tests: `src/lib/rate-limit.test.ts` (window, keys, reset, bounded memory, no raw value), `src/lib/csp.test.ts`,
  `src/app/api/limits.test.ts` (429 and `Retry-After` on the five public routes), `src/app/api/prepared/route.test.ts`,
  `src/app/api/{auth/handoff,app/page}/route.test.ts`, `e2e/security-headers-app.spec.ts` (headers, zero
  violations, redirects, 405), `e2e/rate-limit.spec.ts`, `e2e/creator-consent-app.spec.ts`.
