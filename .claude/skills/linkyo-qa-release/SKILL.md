---
name: linkyo-qa-release
description: How to verify, commit, push and check a Linkyo change end to end (lint, types, unit, Playwright e2e and axe, commit rules, branch, live check). Use before saying any change in this repo is done, when tests fail, or when committing and deploying.
---

# Linkyo QA and release

Nothing is done until it is verified, committed, pushed and live. Report the real numbers (for
example "344 passed"), never "should work".

## Verify (apps/web)

```bash
cd apps/web
npx tsc --noEmit -p .
npx eslint src e2e
npx vitest run
pkill -f next-server; pkill -f "next start"; npx next build
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --project desktop --project mobile --trace off --reporter=line
```

- **Packages:**
  - `pnpm --filter @linkyo/blocks test`;
  - `pnpm --filter @linkyo/tokens test`;
  - lint inside `packages/blocks` with `npx eslint src test`.
- **Long e2e runs:** run them in the background and wait. The full suite takes about 11 minutes.
- **axe:** `e2e/a11y.spec.ts` and the specs assert zero axe violations. Fix the cause (contrast,
  names, a focusable scroller) and never weaken the test.
- **Look at it:** take Playwright screenshots at 390 × 844 for the changed pages, in each language
  that changed. Check RTL on Arabic pages.

## Product rules to keep

- **Privacy:**
  - no third-party requests before consent;
  - players are click-to-load (YouTube privacy mode);
  - our own media is self-hosted.
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
