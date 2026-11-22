# 0068 — "Probier's aus" with recorded real runs, and the playground fixes

**Status.** Accepted (v7 phase 1). The fixes ship visible; the AI tab is built but hidden, because no
real recording exists yet.

**Context.** The homepage playground ([ADR 0051](0051-try-it-playground.md),
[ADR 0052](0052-real-simulation.md), [ADR 0059](0059-app-feel-and-playground.md)) lets a visitor
build a page before signing up, with a guided cursor demo. The AI page builder
([ADR 0065](0065-ai-page-builder.md)) suggests showing it there. Two constraints:

- **No anonymous AI run.** A visitor without an account gets no free Claude call: it would have no
  quota, no owner and no abuse limit. The free draft starts after the e-mail code.
- **Nothing fake may pass for real.** A scripted animation labelled as the AI would mislead; a test
  fixture shown to visitors would too.

An audit of the playground also found problems worth fixing now (W-numbers from the v7 UX review).

**Decision.**

### 1. Playground fixes (visible)

| # | Change |
|---|---|
| W2 | No `aria-live` on the photo hint, link hint or look line; the visitor's own errors and additions are announced only through the existing status region, and only after they interacted. The demo writes nothing to any live region. |
| W3 | The editor column comes before the stage in the DOM (Tab order: tabs → fields → button → demo); the stage stays on top on phones. |
| W5 | At the demo's end the phone scrolls so the first shop piece is in view. |
| W6 | Until the demo or the visitor changes anything, the phone shows the persona's finished page with a quiet "example" chip outside the page; the controls stay empty. The first change shows the visitor's own draft. |
| W8 | The "On your page" chips on phones show full titles in a sideways-scrolling row. |
| W9 | Sign-up shows a small, inert thumbnail of the kept draft with a caption. |
| W11 | The demo's Play and Replay icons are not mirrored in Arabic. |
| W13 | `Sparkles` means AI only: the features section, mobile menu, templates page, poster dashboard and team screens use other icons. Creators keep `sparkles` as a link icon. |

Page addresses in the playground, features, hero deck and sign-up use `pageAddress()`, and with real
accounts the analytics section carries an "In Arbeit" badge ([ADR 0067](0067-going-live.md)).

### 2. The AI tab plays a recording of a real run

- A **recording** (`features/ai/recordings/types.ts`) is the event list of one real run with real
  offsets: `kind` (`real` or `fixture`), `locale`, `recordedAt`, `planShortenedFromMs`, `events`.
- `features/ai/replay.ts` schedules the events at their real offsets with an injectable clock; **only
  the planning wait is shortened** (to 3 s), and the shortening is shown on screen.
- The stage plays it through the dashboard's own `AiRunView` and `runReducer` (the same view a real run
  uses) with `announce: false` and no Stop button. The chip "Aufzeichnung · echter KI-Lauf mit einer
  erfundenen Beispielperson, {date}" (or "Testdaten · keine echte Aufzeichnung" for a fixture)
  **always** shows; no prop can hide it. Reduced motion shows the
  finished run with a Play button.
- The panel (`features/marketing/try-ai-panel.tsx`) asks only for a link. Its button saves the link in
  the try draft (`aiLink`) and goes to sign-up; after the code the build screen opens with the link
  filled in, and starts by itself only when the link is readable and the free draft is left.

### 3. Recording rules

- A recording is a **real run** of the production pipeline, captured as events, not edited (the only
  change is the reported planning shortcut).
- Recordings use **fictional personas** (phase 2), never a real person's page.
- Recordings live in `RECORDINGS` (per locale). **In phase 1 it is empty.** Fixtures written from the
  mock's test data (`FIXTURES`, de and ar) render only on `/design` (`noindex`), always with the
  fixture chip.

### 4. Gating

`aiTab = aiTryPublic && RECORDINGS[locale]?.kind === "real"`: it needs `NEXT_PUBLIC_AI_TRY=1` **and**
a real recording for the page's language. In phase 1 both are missing, so the tab, its eyebrow and its
"Mit KI bauen – kostenlos" call to action stay hidden, and the cursor demo stays (it is fixed by §1
until phase 2 replaces it with the recording).

**Consequences.**

- The homepage never makes an `/api/ai` request (asserted in real-mode e2e) and never spends AI budget
  on a visitor.
- Showing the AI tab later is two steps: record a real run with a fictional persona per language, then
  set `NEXT_PUBLIC_AI_TRY=1`.
- The specimen on `/design` lets designers and tests see the replay without publishing it.
