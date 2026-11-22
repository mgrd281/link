# 0065 — AI page builder: one structured call, a streamed plan, limits in Postgres

**Status.** Accepted (v7 phase 1). Built and tested against a local mock only: no request has reached
the real Claude API yet. Phase 2's first real calls (pilot, cache-hit check, evaluation) are the
acceptance for the real API.

**Context.** The founder asked for a page builder that turns a creator's links and a sentence about
them into a finished Linkyo page, and decided:

- the **first AI draft is free for every account**; more drafts are part of **Pro (8 € a month)**,
  with a monthly cap (5 drafts a month);
- `@anthropic-ai/sdk` is approved as a **server-side** dependency, pinned in the pnpm catalog at
  `1.12.0` (the only other new package of v7 is `stripe` 23.2.0, [ADR 0066](0066-selling-in-germany.md));
- everything is built first in **test mode**: no real AI call, no real money, no accounts yet.

The builder must never cost more than it earns, never publish anything by itself, send no photos and
no contact details to the AI provider, be honest about which parts of a page an AI wrote, and keep
working when the browser tab closes.

**Decision.**

### 1. One structured-output call per draft (PagePlan v1)

- The model answers with one JSON document, the **PagePlan v1** (`packages/blocks/src/ai-plan.ts`,
  `PAGE_PLAN_VERSION = "plan-v1"`): `kind`, `theme`, `profile`, up to 30 `blocks` in six variants,
  and `notes` ("why this look, this order, this copy").
- `PAGE_PLAN_JSON_SCHEMA` is generated from the Zod schema and adapted to what structured outputs
  accept: every `oneOf` becomes `anyOf`, length limits move into `description` text, every property
  is required and every object has `additionalProperties: false`. A snapshot test pins it (0 optional
  properties, exactly one `anyOf`, no length keys); the enums are read from the tokens (template ids,
  pairings without `arabic`, button styles and shapes, swatches) and from `KINDS`, so a new template
  cannot be forgotten.
- The request (`features/ai/server/claude.ts`, the only file that may import the SDK as a value; the
  static guard enforces it) is fixed: model `claude-opus-5-5`, streamed, `output_config.effort`
  (`medium` for the creator, `high` for a team run) and `output_config.format` with the schema;
  adaptive thinking is always on for this model, so there is no `thinking` field; no `temperature`,
  no tools, no `tool_choice`; the refusal fallback beta (`server-side-fallback-2026-07-01`,
  `fallbacks: "default"`). The system prompt is two blocks: the core rules, then the catalogue and a
  fictional example, cached. Prompts are versioned constants (`PROMPT_VERSION = "core-v1"`).
- The model never sees a URL it could invent: links are numbered `L1…L40` in the bundle, and a plan
  can only point at those ids. `plan-to-page.ts` resolves them, builds blocks with the editor's own
  `detectLink`/`blockFromLink`, validates every block and the page with the editor's validators,
  applies deterministic fixes (trim, cut at a grapheme boundary, case-insensitive enums, at most 2
  highlights, at most 30 blocks) and the content rules (free text loses URLs, e-mails and phone numbers
  not in the sources; a number that appears nowhere in the sources clears the field). Newsletter
  blocks are always dropped in phase 1 (the form is not real yet).
- **Repair:** an unparseable plan, zero blocks while links exist, or more than 30 % dropped gets
  **one** follow-up call (effort `low`, 8,000 tokens); a `max_tokens` cut gets one follow-up with the
  route's own effort and cap. A run never makes more than 2 calls; still failing → `invalid`.
- **Errors** are mapped from the SDK's typed classes, never from messages: 429/529/5xx/connection →
  `busy`; Anthropic's spend limit → `budget` and the AI switch turns itself off; deadline → `timeout`;
  `stop_reason: "refusal"` → `refused` (the partial text is discarded). None of them counts.

### 2. Sources, read safely

- Readable sources are a website, an allowed link-in-bio host and a TikTok profile (oEmbed). Instagram,
  X, YouTube and other social profiles are linked as given ("We link your channel"), nothing is
  fetched. Linktree is **paste your links** (robots.txt does not allow us); the fixed importer
  (`/api/import-links`) now refuses it with a "paste" hint.
- Websites go through the Node fetcher `features/ai/server/safe-fetch.ts`: https on port 443 only,
  every resolved address must be public unicast (IPv6 as an allow-list, Teredo and 6to4 decoded),
  **connect-time pinning** (the socket's `lookup` answers only the validated address), redirects
  re-validated hop by hop (at most 3), robots.txt for `LinkyoImport` checked for every host, body
  streamed and cut at 1 MB, 3 s connect and 8 s total. No picture is downloaded. It is a Node route,
  not an Edge Function.
- **Contact redaction:** before anything is serialised for the model, `redactContacts()` replaces
  every e-mail address with `[E-Mail]` and every phone-like run of 7+ digits with `[Telefon]`, in the
  owner's text, the name, bios, titles and a team briefing's wishes. **No photo goes to the AI
  provider:** the browser computes two colours from the photo (a 64 × 64 canvas) and sends only those.

### 3. The run as server-sent events

- `POST /api/ai/runs` (Node runtime, `maxDuration` 300) answers 404 unless `aiConfigured()` (real
  accounts, `AI_ENABLED=1` and a key), 401 without a session, 400 for a bad request; otherwise 200
  `text/event-stream`. Every refusal of the run itself arrives as an SSE `error` event.
- The events (`features/ai/events.ts`) are `run`, `step` (seven visible steps: read, details,
  colors, plan, look, write, check), `source`, `look`, `profile`, `block`, `drop`, `notes`, and one
  terminal event: `done`, `stopped` or `error`. An incremental scanner (`features/ai/scanner.ts`)
  emits each block as soon as its JSON closes, so the phone fills while the model writes.
- **Delivery never decides the run:** the stream's `cancel()` only stops sending; the run is
  registered with `after()`, uses its own deadline and stop flag (never the request's signal), records
  content-free progress in `ai_runs.progress` and saves its result. A client that lost the stream
  polls `GET /api/ai/runs/:id`. Stop is a database flag (`ai_request_stop`), checked every 2 s, so it
  works across instances.

### 4. Limits in Postgres, one reservation per run

- `ai_reserve_run` is called **exactly once per run, by the pipeline**, in one transaction: the AI
  switch, the account's state, the daily budget (row locked), concurrency (1 per account, 10 global),
  the quota (Free: 1 counted draft for life; Pro: 5 per Berlin calendar month; "Pro für immer" counts
  as Pro), 5 runs a day per IP hash (daily-salted HMAC, `AI_IP_SALT_SECRET`), and at most 3 uncounted
  failures a day per account. A refusal names its reason (`disabled`, `budget`, `busy`, `quota`,
  `ip` → `limit`, `failures`).
- **The reservation is derived, not guessed** (`features/ai/limits.ts`): `MAX_CALLS × (MAX_TOKENS[route] ×
  worst output price + 20,000 input tokens × worst input-side price)`, which is 1.05 $ for a creator
  run and 1.85 $ for a team run. A test fails if a price in `cost.ts` rises above the worst case.
  `ai_settle_run` replaces the reservation with the real cost. The global budget is 10 $ a day.
- **When a run counts:** once a draft is delivered, or when the owner stops it after at least one block
  arrived (the stopped draft keeps those blocks). A stop with no block, `nothing`, failures, refusals
  and timeouts never count.
- The numbers live once in `ai_settings` and are mirrored in `limits.ts`; `limits.test.ts` reads the
  migration and compares.
- **Retention:** drafts 7 days, the run log 30 days (`ai_cleanup`, every 5 minutes, also fails runs
  stuck for 10 minutes), budget days 90 days. `ai_usage` keeps content-free monthly counters for the
  quota. Fetched content is never stored.

### 5. Provenance of blocks and profile text

- Blocks carry `origin` (`ai`, `ai-edited`, `human`; absent = human, so every existing page stays
  valid); editing an `ai` block makes it `ai-edited`. The profile carries `aiFields` (the display name,
  tagline and bio taken from an AI plan); a field stays listed after the owner edits it, and only a new
  applied draft or proposal replaces the list. `hasAiContent(page)` reads both.
- Public pages mark AI content for machines: the page gets `<meta name="ai-generated"
  content="partial">` and each AI element `data-ai-generated="true"`. There is no visible "made with
  AI" label in phase 1 (the creator toggle is not built).
- **The AI never publishes.** A draft is shown in the review; only the owner's **Apply** writes the
  page, as one undoable step. Applying never sets `onboarded`: a new account still confirms its name
  and address in the welcome's "you" step.

### 6. Team runs belong to the team member

For the paid Start package ([ADR 0066](0066-selling-in-germany.md)) the team can run the same
pipeline for an order (`route = 'team'`). Such a run is owned by the team member
(`ai_runs.profile_id` = the actor, `order_id` = the order): the customer never sees, stops or waits
for it, it never makes the customer `busy`, and it uses no customer quota or IP limit. Its result is
saved as a proposal, never to the customer's page.

### 7. Kill switch

`ai_settings.enabled` is the kill switch: the team console shows it to `security.view` and lets
`security.manage` change it (audited); a spend-limit answer from Anthropic turns it off by itself.
Without `AI_ENABLED=1` and a key every AI route answers 404, which is the state of the live demo
deployment.

### 8. Mock only in tests

- `ANTHROPIC_BASE_URL` may point only at `api.anthropic.com`, or at a loopback address while `VERCEL`
  is unset; anything else throws before a client exists, so a deployment can never reach a mock.
- Tests talk to a local mock of the Messages API (`apps/web/e2e/mocks/anthropic.handler.mjs`): it
  answers 400 unless the request has exactly the fields above, and streams recorded fixtures
  (`de-music`, `ar-coach`, `en-sparse`, `refusal`, `invalid-then-repair`, `max-tokens`, `fallback`,
  `slow`) in 13-byte chunks. Each test tags its calls, so parallel tests never see each other's.
- `AI_ENRICH_OFF=1` skips the link-metadata step, so an e2e run never calls a real platform.

**Consequences.**

- Cost is bounded per run (the reservation) and per day (the budget), and the quota keeps Free at one
  draft; a workspace spend limit at Anthropic is set in phase 2.
- Passing tests prove the plumbing, not the API's acceptance of the schema or the quality of the
  pages. The real API is checked in phase 2 before any visitor sees the builder.
- The privacy policy draft names Anthropic (USA) as a processor, what is sent and what is not, and
  our retention ([ADR 0067](0067-going-live.md)).
- Adding a source or changing the prompt follows the `linkyo-ai-builder` skill (new prompt version,
  new fixtures, re-recorded runs).
