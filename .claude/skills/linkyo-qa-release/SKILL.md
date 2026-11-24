---
name: linkyo-qa-release
description: How to verify, commit, push and check a Linkyo change end to end (lint, types, unit, Playwright e2e and axe, commit rules, branch, live check). Use before saying any change in this repo is done, when tests fail, or when committing and deploying.
---

# Linkyo QA and release

Nothing is done until it is verified, committed, pushed and live. Report the real numbers (for
example "344 passed"), never "should work".

## Verify (apps/web)

From the repo root, then in `apps/web`:

```bash
export PORT=3100 MOCK_ANTHROPIC_PORT=54399 MOCK_STRIPE_PORT=54398   # one set per worktree (below)
unset PW_REUSE_SERVER ANTHROPIC_BASE_URL                             # container notes (below)
pnpm lint && pnpm typecheck && pnpm test                             # lint includes the token guard
pnpm --filter @linkyo/blocks test && pnpm --filter @linkyo/tokens test
cd apps/web
fuser -k "$PORT/tcp"; npx next build                                 # stop only your own server
grep -rE "sk-ant-|api\.anthropic\.com|sk_test_|whsec_" .next/static && echo "SECRET IN BUNDLE"
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --project desktop --project mobile --trace off --reporter=line
```

- **Ports per worktree.** `PORT` (the app, default 3100), `MOCK_ANTHROPIC_PORT` (default 54399) and
  `MOCK_STRIPE_PORT` (default 54398) are read by `playwright.config.ts` and the mocks; nothing else
  hard-codes a port. When several worktrees test at once, give each its own set (for example work
  package N: `3100+N`, `55100+N`, `55200+N`).
- **Never test someone else's server.** `reuseExistingServer` is true only with `PW_REUSE_SERVER=1`;
  leave it unset in every gate and in CI (a developer may set it by hand while iterating).

### Container notes

- **Stop servers by port, not by name:** `fuser -k "$PORT/tcp"` (or `lsof -ti tcp:$PORT | xargs -r
  kill`). Never `pkill -f next-server` or `pkill -f "next start"`: it kills other worktrees' servers.
- **`unset ANTHROPIC_BASE_URL`** before building, starting or testing: agent containers set it for
  their own use, and the app refuses any base URL that is not Anthropic's host or a local mock
  (`features/ai/server/config.ts`). Real-mode runs set it to the mock explicitly.
- Clean up afterwards: `rm -rf apps/web/.next apps/web/test-results apps/web/.mail`.

- **Packages:**
  - `pnpm --filter @linkyo/blocks test`;
  - `pnpm --filter @linkyo/tokens test`;
  - lint inside `packages/blocks` with `npx eslint src test`.
- **Long e2e runs:** run them in the background and wait. The full suite takes about 11 minutes.
- **axe:** `e2e/a11y.spec.ts` and the specs assert zero axe violations. Fix the cause (contrast,
  names, a focusable scroller) and never weaken the test.
- **Look at it:** take Playwright screenshots at 390 × 844 for the changed pages, in each language
  that changed. Check RTL on Arabic pages.

## Picture baselines (existing pages never change)

`e2e/portfolio-baseline.review.spec.ts` compares full-page captures byte for byte with a stored set
(same machine, same browser). Two sets, chosen with `BASELINE_SET`:

| Set | Folder | Captures |
|---|---|---|
| unset or `v8` (the default) | `/root/linkyo-v8-baseline` | 50: eleven templates, de and ar, three `/p` pages; 390 and 1440 wide |
| `s2` | `/root/linkyo-s2-baseline` | 78: all fourteen templates, de and ar; the four portfolio templates also on the portfolio sample; the same three `/p` pages; 390 and 1440 wide |

Run on the demo build (no Supabase variables), from `apps/web`, on your own port. Compare against a
copy: a difference writes `<name>.actual.png` into the folder.

```bash
unset ANTHROPIC_BASE_URL ANTHROPIC_API_KEY PW_REUSE_SERVER
cp -r /root/linkyo-s2-baseline "$SCRATCH/s2-copy"
PORT=$PORT BASELINE_SET=s2 V8_BASELINE_DIR="$SCRATCH/s2-copy" PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  npx playwright test e2e/portfolio-baseline.review.spec.ts --project review --trace off --reporter=line
```

- Look at both pictures of every difference (`<name>.png` and `<name>.actual.png`) and name the change
  that intends it; anything else is a defect.
- `V8_BASELINE=write` stores a set. Write only into a new folder, from an integrated tree, never over a
  stored baseline; then add a `README.md` (tree, commit, runs) and `SHA256SUMS` next to the pictures.
- Without `V8_BASELINE_DIR` every capture is skipped, so `pnpm review` is unaffected.
- The `s2` set holds IntersectionObserver callbacks once a page is at rest at the top: a full-page
  capture itself made Laufbahn's app bar appear in one of two captures. The `v8` set is captured as it
  was written.

## Lighthouse (mobile)

On the demo build, with your own `next start -p $PORT` running (Lighthouse is not a dependency; npx
fetches a pinned version into its cache):

```bash
CHROME_PATH=/opt/pw-browsers/chromium npx -y lighthouse@13.6.0 "http://localhost:$PORT/de/p/ronja-feldkamp" \
  --only-categories=performance,accessibility --output=json --output-path=lh-de.json \
  --chrome-flags="--headless=new --no-sandbox" --quiet
```

Report performance, accessibility, `total-byte-weight` and the font requests from `network-requests`
(resource type Font). A German page must request no Arabic face. `/ar/p/<german example>` answers 308
to the German page, so measure an Arabic example (for example `/ar/p/naya-aldabbas`) for Arabic fonts.

## Database changes (supabase/)

When migrations, the account store, the console's data layer, AI, payments, e-mail or public pages
changed, also run the database and the real-mode suites (only one worktree at a time may use the
local stack):

```bash
pnpm db:start && pnpm db:reset && pnpm db:test && pnpm db:lint
cd apps/web && fuser -k "$PORT/tcp"
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local> \
  NEXT_PUBLIC_PAYMENTS=test npx next build              # keep NEXT_PUBLIC_CREATOR_DOMAIN unset
mkdir -p .mail

# 1. sign-up and sign-in by e-mail code, AI off (Mailpit)
E2E_SUPABASE=1 SUPABASE_SECRET_KEY=<local> npx playwright test supabase.spec.ts --project desktop

# 2. and 3. need every real-mode variable and start the mocks (E2E_MOCKS=1)
REAL="E2E_SUPABASE=1 E2E_MOCKS=1 SUPABASE_SECRET_KEY=<local> AI_ENABLED=1 ANTHROPIC_API_KEY=sk-ant-local-test \
  ANTHROPIC_BASE_URL=http://127.0.0.1:$MOCK_ANTHROPIC_PORT AI_IP_SALT_SECRET=local-test AI_ENRICH_OFF=1 \
  STRIPE_SECRET_KEY=sk_test_local STRIPE_WEBHOOK_SECRET=whsec_local_test STRIPE_API_HOST=127.0.0.1 \
  STRIPE_API_PORT=$MOCK_STRIPE_PORT STRIPE_API_PROTOCOL=http EMAIL_TRANSPORT=capture EMAIL_CAPTURE_DIR=$PWD/.mail \
  MAINTENANCE_SECRET=local-maint LINKYO_ADMIN_CODE_SHA256=<sha256 of a local-only team code>"
env $REAL npx playwright test --grep @real --grep-invert @global --project desktop --project mobile
env $REAL npx playwright test --grep @global --workers=1 --project desktop   # global state: the AI switch
```

- `<local>` keys come from `db:start` (or `npx supabase status -o env`); they are the CLI's fixed
  development keys. The team-code hash is of a local-only code (CI uses `linkyo-team-local-e2e`),
  never the demo code's: with real accounts the demo code must fail.
- `@real` specs import `test` from `e2e/real.ts` (a per-test `x-forwarded-for` and mock tag);
  `@global` tests change shared state and run alone with one worker. Use `--workers=2` if the machine
  swaps.
- All test values above are dummies: the app only ever talks to the local mocks, and no e-mail leaves
  the machine (`EMAIL_TRANSPORT=capture` writes JSON files to `.mail`).
- Then stop your server, rebuild **without** the Supabase variables and run the regular suite: the
  demo must keep working too. CI runs the same three invocations in the `real-e2e` job.

## Product rules to keep

- **Privacy:**
  - no third-party requests before consent;
  - players are click-to-load (YouTube privacy mode);
  - our own media is self-hosted (Storage pictures through `/_next/image`);
  - Stripe.js only on `/checkout/*`; no secret in `.next/static` (the grep above);
  - the AI provider gets no photos, and e-mail addresses and phone numbers are removed first.
- **No real outbound call in tests:** no request to `api.anthropic.com`, `api.stripe.com`,
  `js.stripe.com`, `api.scaleway.com` or a platform oEmbed host (e2e stubs `**/api/link-metadata**`,
  `AI_ENRICH_OFF=1`).
- **Languages:** de, en and ar for every user-facing text, in `src/messages/*.json`.
- **Accessibility:** WCAG 2.2 AA. Moving content can be paused, and reduced motion is respected.
- **Decisions:** big decisions get an ADR in `docs/DECISIONS/` plus a row in its `README.md`.

## Commit and push

- **Commitlint:** `type(scope): subject`, header at most 100 characters.
  - Scopes: web, ios, tokens, ui, blocks, api-client, config, supabase, docs, ci, deps, repo.
- **Message file:** write the message to a file and run `git commit -F <file>`.
- **Trailers:** end the message with the session's attribution trailers. No model names in commits.
- **Push:** `git push -u origin <branch>` on the session's branch. Retry network errors with
  backoff. No pull request unless asked.

## Live check

Production is https://link-web-one.vercel.app. Vercel deploys each push in about a minute. Poll with
curl until the new content appears, then check the changed URLs return 200.

- **Launch:** the launch build sets `LAUNCH=1` (with `LEGAL_REVIEWED=1` once the lawyer has
  reviewed the texts); it fails while the legal texts are drafts (ADR 0074).
- **Build-time variables** (`LAUNCH`, `LEGAL_REVIEWED`, `EMAIL_TRANSPORT`) must be listed under
  `tasks.build.env` in `turbo.json`, or Turborepo's strict env mode hides them from `next build`.
