---
name: linkyo-ai-builder
description: How Linkyo's AI page builder works and how to change it safely (the run pipeline, SSE events, PagePlan v1, limits and quota in Postgres, the Claude call, provenance, the local Messages API mock). Use when touching apps/web/src/features/ai/**, /api/ai/*, the team's AI run, the prompt or schema, a source (website, link page, TikTok, a new platform), the AI limits, or the "Probier's aus" recordings.
---

# Linkyo AI page builder

Decision record: ADR 0065 (builder), ADR 0068 (homepage recordings). The `claude-api` skill holds the
SDK details; this skill holds Linkyo's rules. **No test or local run ever calls the real API**: tests
use the mock below, and the routes are off (404) unless `AI_ENABLED=1`, a key and real accounts are
present.

## Map

| What | Where |
|---|---|
| Plan schema (Zod → JSON schema, `PAGE_PLAN_VERSION`) | `packages/blocks/src/ai-plan.ts`, snapshot test `packages/blocks/test/ai-plan.test.ts` |
| Provenance (`origin`, `aiFields`, `hasAiContent`) | `packages/blocks/src/schema.ts` |
| Events and the browser request | `features/ai/events.ts`, `features/ai/request.ts` |
| Limits (mirrors `ai_settings`, token caps, `reserveMicros`) | `features/ai/limits.ts` (+ `limits.test.ts` reads the migration) |
| Routes | `app/api/ai/runs/route.ts` (POST, SSE), `runs/[id]` (poll), `runs/[id]/stop`, `app/api/ai/quota` |
| Pipeline (every dependency injected) | `features/ai/server/pipeline.ts` (`runPipeline`, `productionSources`) |
| SSE sink (never throws, never decides the run) | `features/ai/server/sse.ts` |
| Claude call, the only SDK value import | `features/ai/server/claude.ts` (static guard: `lib/static-guard.test.ts`) |
| Prompts (versioned constants) | `features/ai/server/prompts.ts` (`PROMPT_VERSION`) |
| Repair, cost | `features/ai/server/repair.ts`, `cost.ts` |
| Sources | `features/ai/server/sources/{classify,website,linkinbio,tiktok}.ts`, `safe-fetch.ts`, `robots.ts`, `html.ts`, `html-scan.ts` (the linear tag scanner; the importer's `extractLinks` uses it too) |
| Bundle, redaction | `features/ai/server/bundle.ts` (`redactContacts`, `L1…L40` ids, affiliate hints) |
| Plan → page (pure) | `features/ai/plan-to-page.ts`, `content-rules.ts`; scanner `features/ai/scanner.ts` |
| Reserve/settle client | `features/ai/server/limits-client.ts`; config and base-URL guard `config.ts` |
| Team input | `features/ai/server/team-input.ts` (`route: "team"`) |
| Build screen (console palette) | `features/ai/build-screen.tsx`, `run-view.tsx`, `run-reducer.ts`, `use-ai-run.ts`, `sse-client.ts`, `review.tsx`, `announce.ts` |
| Honest per-source lines | `features/ai/source-lines.ts` (uses the server's `classifySource`) |
| Recordings and replay | `features/ai/recordings/`, `features/ai/replay.ts` |
| Database | `supabase/migrations/20261123100300_ai.sql`, `supabase/tests/ai.test.sql` |
| Mock Messages API | `apps/web/e2e/mocks/anthropic.handler.mjs`, fixtures `apps/web/e2e/mocks/anthropic/*.json` |

## The run, in order

1. `ai_reserve_run` — **exactly once per run, in the pipeline** (never in the route). Refusals:
   `disabled`, `budget`, `busy`, `quota`, `ip` (shown as `limit`), `failures`. They arrive as an SSE
   `error` on a 200 response.
2. `read` — sources in parallel (≤ 12 s); one `source` event each.
3. Nothing at all (no link, no profile text, no sentence) → `error nothing` (not counted).
4. `details` — oEmbed metadata for ≤ 10 media links (`lookupLinkMetadata`); skipped with
   `AI_ENRICH_OFF=1`.
5. `colors` — done when the browser sent photo colours, else skipped. **Photos never leave the
   browser**; only two hex colours do.
6. `plan` → `look` → `write` — one streamed call; the scanner emits `look`, `profile`, each `block`
   as its JSON closes (validated first; failures → `drop`), and `notes`. The stop flag is read every
   2 s; a stop keeps the blocks that arrived and counts only if there is at least one.
7. `check` — rebuild from the final message, `planToPage`, at most one repair or follow-up call
   (never more than 2 calls in total).
8. `save` — `ai_settle_run(succeeded, counted)`; `done` with `expiresAt` = now + 7 days.

Any thrown error settles `failed` or `refused`, uncounted. `ai_record_progress` after every step
(content-free), so a client that lost the stream can poll. One log line per run, never content.

## Rules

- **The Claude request is fixed** (`planRequest` in `claude.ts`): model `claude-opus-5-5`, streamed,
  `max_tokens` from `MAX_TOKENS[route]`, `output_config: { effort, format: { type: "json_schema",
  schema: PAGE_PLAN_JSON_SCHEMA } }`, betas `server-side-fallback-2026-07-01` with
  `fallbacks: "default"`, two system blocks (the second cached), one user turn. No `thinking` field
  (adaptive thinking is always on), no `temperature`/`top_p`/`top_k`, no tools, never `tool_choice`.
  The mock rejects anything else with a 400.
- **Errors by class, not by message:** the SDK's typed errors map to `busy`, `budget` (spend limit:
  also `ai_disable`), `timeout`, `refused`, `server`. Log the class name only.
- **The signal is `AbortSignal.any([deadline, stopFlag])`**, never `request.signal`: a closed tab must
  not cancel a paid run.
- **Links by id only.** The model sees `L1…L40`, never raw URLs to copy; `planToPage` resolves ids
  and drops unknown or reused ones.
- **Redact before sending:** every free text goes through `redactContacts()` (e-mails → `[E-Mail]`,
  phone numbers → `[Telefon]`). One phone definition for sending and for checking the answer:
  `replacePhones` in `content-rules.ts` (up to three separators between digits, Arabic-Indic digits,
  real dates and year ranges set aside).
- **Someone else's HTML is never read with a backtracking pattern.** Pages are scanned with
  `html-scan.ts` (every search only forward, caps on tags and links); `robots.ts` matches rules
  without regular expressions and refuses oversized rule sets; `safeFetch` has one clock for the
  whole fetch (the robots.txt read and the name lookup included). Each has a test with a hostile
  megabyte that must finish in well under 200 ms.
- **Newsletter blocks are dropped** in phase 1; at most 2 highlights; at most 30 blocks; every block
  gets `origin: "ai"`; `aiFields` lists the AI-written display name, tagline and bio.
- **The AI never publishes.** Apply is the owner's, one undoable `replace`; it never sets `onboarded`.
- **Team runs** (`route: "team"`) belong to the team member, skip quota and IP checks, use effort
  `high` and 32,000 tokens, and save a proposal (`admin_save_proposal`), never `sites`.
- **Numbers live in one place each:** `ai_settings` in SQL, mirrored in `limits.ts` (the test
  compares). A price change goes into `cost.ts`; if it raises the worst case, `cost.test.ts` fails
  until `WORST_*_USD_PER_MTOK` (and so the reservation) is raised too. `costMicros` prices every
  attempt of a call by its own model (`usage.iterations`); a cut-off stream books what it can have
  cost by then (`cutOffCostMicros`), not the worst case.
- **Base URL guard:** `ANTHROPIC_BASE_URL` may be unset, Anthropic's host, or loopback off Vercel.
  Container shells often set `ANTHROPIC_BASE_URL` for their own use: **unset it** before building or
  running the app and tests (`unset ANTHROPIC_BASE_URL`), or set it to the mock.
- The build screen is dashboard UI: console palette through semantic classes, no palette or `tint-*`
  classes (`console-guard.test.ts` scans `features/ai/**` except `recordings/`). Screen-reader budget:
  ≤ 14 announcements per run (`announce.ts`).

## The mock

`node e2e/mocks/server.mjs` starts every `e2e/mocks/*.handler.mjs` on its own port
(`MOCK_ANTHROPIC_PORT`, default 54399; `MOCK_STRIPE_PORT`, default 54398); Playwright starts it when
`E2E_MOCKS=1`. `POST /v1/messages` checks the request shape and streams the fixture named in the user
turn by `[[fixture:<name>#<tag>]]` (default `de-music`) in 13-byte chunks with the fixture's delays.
`GET /__calls?tag=<tag>` counts calls per tag (there is no global reset: each test uses its own tag,
`test` from `e2e/real.ts` provides one). Fixtures: `de-music`, `ar-coach`, `en-sparse`, `refusal`,
`invalid-then-repair`, `max-tokens`, `fallback`, `slow`. Vitest uses the same fixture files
(`pipeline.test.ts`, `claude.test.ts`, `scanner.test.ts`, `run-reducer.test.ts`).

## Add a source

1. Classify it in `sources/classify.ts` (`classifySource`): readable (`website`, `linkinbio`,
   `tiktok`) or `handleOnly` (linked, nothing fetched) or `pasteOnly`. Add the kind to `AiSourceKind`
   in `events.ts` only if it is new.
2. Write the reader in `sources/<name>.ts` returning a `SourceResult`; wire it in
   `productionSources` (`pipeline.ts`). Any arbitrary host goes through `safeFetch` (https, 443,
   public addresses, pinned connect, robots.txt, 1 MB). A fixed platform endpoint (like TikTok's
   oEmbed) may use plain `fetch` with a timeout. Never download pictures.
3. Check robots.txt and the platform's terms first; if robots disallows `LinkyoImport`, the source is
   paste-only (as Linktree is).
4. Give it an honest line (`source-lines.ts` → `app.ai.platform.*`, in de, en and ar).
5. Tests: `classify.test.ts`, a reader test with a stubbed fetch, and a pipeline case. No real
   network in tests.

## Change the prompt or the schema

1. Edit the constants in `prompts.ts` and bump `PROMPT_VERSION` (stored on every run), or edit
   `ai-plan.ts` and bump `PAGE_PLAN_VERSION`. Never generate prompts at run time.
2. `pnpm --filter @linkyo/blocks test` — review the schema snapshot diff on purpose (still 0 optional
   properties, one `anyOf`, no length keys). The catalogue test pins the template ids, pairings,
   button styles, shapes, swatches, link icons and kinds.
3. Update the mock fixtures (`e2e/mocks/anthropic/*.json`) so their answers match the new schema, and
   the recordings' fixtures (`features/ai/recordings/fixture-*.json`).
4. **Re-record** (phase 2, real API, founder's approval and budget): run the production pipeline once
   per language with a fictional persona, save the event list as a `kind: "real"` recording with
   `recordedAt`, and check the replay on `/design`. Only the planning wait may be shortened
   (reported). Never hand-edit a real recording.
5. Run the AI unit tests and the real-mode e2e (`--grep @real`); a change to real behaviour also
   needs an evaluation against the real API (phase 2) before it reaches users.

## Verify

```bash
cd apps/web
npx vitest run src/features/ai src/app/api/ai src/lib/static-guard.test.ts
pnpm --filter @linkyo/blocks test
# real-mode e2e with the mock: see the linkyo-qa-release skill (three invocations)
```
