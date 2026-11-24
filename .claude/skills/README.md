# Project skills

Claude Code loads these skills automatically in this repository. They come in two groups. Linkyo's own skills take precedence.

## Linkyo skills (written for this repo)

| Skill | Use it for |
|---|---|
| `linkyo-design-tokens` | Any UI work: token-only values, creator colors, swatches, lint rule |
| `linkyo-example-page` | New or improved fictional example pages in /templates (photos, clips, buttons) |
| `linkyo-concept-page` | Pages for well-known people: sources, licenses, one language per page |
| `linkyo-page-kind` | New page kinds in the welcome flow ("What describes you best?") |
| `linkyo-qa-release` | Verify, commit, push and check a change live; per-worktree ports, the three real-mode e2e invocations, container notes |
| `linkyo-ux-audit` | Screenshot the whole journey on phone and desktop, review against known pitfalls, fix, re-check |
| `linkyo-share-images` | Link preview cards (Satori) and story/post pictures (canvas): fonts, Arabic, build rules |
| `linkyo-link-metadata` | Real titles and pictures for pasted links: oEmbed route, image proxy, adding a platform; websites only through the Node safe fetcher |
| `linkyo-poster-template` | New Poster templates and layout options (hero, headings, social icons), from a reference |
| `linkyo-media-assets` | Licensed photos and clips, original cover art with bundled OFL fonts, CREDITS.md and media.ts |
| `linkyo-supabase` | Real accounts and the database: migrations with RLS, team functions, pgTAP, generated types, the local stack (with Storage), files deleted only through the Storage API, real-account e2e |
| `linkyo-ai-builder` | The AI page builder: run pipeline, SSE events, PagePlan v1, limits and quota, the Claude call, provenance, the local mock; adding a source, changing the prompt, re-recording |
| `linkyo-payments` | Selling under German law: service packages and Pro, the § 312j checkout, statutory labels, webhook, `/widerruf`, `/kuendigen`, contract e-mails; testing without any Stripe account |
| `linkyo-team-console` | The team console (`/admin`): roles and permissions, demo vs real-account actions, the activity log, money only through Stripe server routes, safe CSV export, honest numbers, phone layouts |
| `linkyo-creator-dashboard` | The creator dashboard (`/app`): black-and-grey palette, screen anatomy, tab bar, rail and section panel, laptop widths, real template previews, Arbeiten, demo vs real, toasts, button shapes, a new block type's silent places |
| `linkyo-portfolio` | Portfolios: the project block, the wide and full canvas, portfolio templates and how to add the next one (engine values, tokens, picker, AI catalogue, baseline, examples, credits) |
| `linkyo-analytics` | Cookie-free page statistics: the inline counter, /api/collect, page_stats, Stats/Home/editor chip, console views30, the switch and the privacy rules |

## Vendored skills (open source, with their licenses)

| Skill | Source (commit) | License |
|---|---|---|
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) `e4bb5d9` | Apache-2.0 (LICENSE.txt) |
| `webapp-testing` | anthropics/skills `e4bb5d9` | Apache-2.0 (LICENSE.txt) |
| `vercel-react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `1a2c79d`, `skills/react-best-practices` | MIT (LICENSE) |
| `vercel-composition-patterns` | vercel-labs/agent-skills `1a2c79d`, `skills/composition-patterns` | MIT (LICENSE) |
| `vercel-react-view-transitions` | vercel-labs/agent-skills `1a2c79d`, `skills/react-view-transitions` | MIT (LICENSE) |
| `systematic-debugging` | [obra/superpowers](https://github.com/obra/superpowers) `22f0b46` | MIT (LICENSE) |
| `test-driven-development` | obra/superpowers `22f0b46` | MIT (LICENSE) |
| `verification-before-completion` | obra/superpowers `22f0b46` | MIT (LICENSE) |
| `requesting-code-review` | obra/superpowers `22f0b46` | MIT (LICENSE) |
| `receiving-code-review` | obra/superpowers `22f0b46` | MIT (LICENSE) |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) `2de1134`, `.claude/skills/ui-ux-pro-max` (tests left out) | MIT (LICENSE) |
| `web-design-guidelines` | vercel-labs/agent-skills `1a2c79d` + [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) `434b7f9` (`command.md` → `guidelines.md`) | MIT (LICENSE) |
| `agent-browser` | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) `25b5d76` (discovery stub; the CLI serves the guides) | Apache-2.0 (LICENSE) |
| `motion` | [motiondivision/ai-kit](https://github.com/motiondivision/ai-kit) `1e42494`, `plugins/motion/skills/motion` | MIT, declared in the plugin manifest (LICENSE) |
| `motion-design` | [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill) `2e1f3c0` | MIT (LICENSE) |
| `gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-plugins`, `gsap-performance`, `gsap-utils`, `gsap-frameworks` | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) `aed9cfd` | MIT (LICENSE) |
| `web-quality-audit`, `performance`, `core-web-vitals`, `accessibility`, `seo`, `best-practices` | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) `afa8da9` | MIT (LICENSE) |
| `shopify-liquid-themes`, `liquid-theme-standards`, `liquid-theme-a11y` | [Shopify/liquid-skills](https://github.com/Shopify/liquid-skills) `ae3e4cc` (only for Shopify `.liquid` themes, not this app) | MIT, declared in the plugin manifest (LICENSE) |

### Added in November 2026 (each file read in full twice: once when chosen, once by an independent check)

| Skill | Source (commit) | License | Use it for |
|---|---|---|---|
| `swiftui-pro` | [twostraws/SwiftUI-Agent-Skill](https://github.com/twostraws/SwiftUI-Agent-Skill) `f2920b6` | MIT (LICENSE, copied from the repo root) | SwiftUI review and writing in `apps/ios` |
| `swift-concurrency-pro` | [twostraws/Swift-Concurrency-Agent-Skill](https://github.com/twostraws/Swift-Concurrency-Agent-Skill) `bee3f69` | MIT (LICENSE) | Strict-concurrency correctness (actors, tasks, Sendable) |
| `swift-testing-pro` | [twostraws/Swift-Testing-Agent-Skill](https://github.com/twostraws/Swift-Testing-Agent-Skill) `2d6bba1` | MIT (LICENSE) | Swift Testing in the design-system package |
| `ios-accessibility` | [dadederk/iOS-Accessibility-Agent-Skill](https://github.com/dadederk/iOS-Accessibility-Agent-Skill) `dcc3a36` | MIT (LICENSE.txt) | VoiceOver, Dynamic Type, Voice Control on iOS |
| `app-store-preflight-skills` | [truongduy2611/app-store-preflight-skills](https://github.com/truongduy2611/app-store-preflight-skills) `cfd9c73` | MIT (LICENSE) | App Store review risks before a submission |
| `break-ui` | [emilkowalski/skills](https://github.com/emilkowalski/skills) `64eb3de`, `skills/break-ui` | MIT (LICENSE) | Worst-case data: long German words, Arabic, emoji, zero and huge counts, RTL, 320 px |
| `mobile-native` | emilkowalski/skills `64eb3de`, `skills/mobile-native` | MIT (LICENSE) | What makes a web page feel native on a phone |
| `copywriting` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) `5b2b400`, `skills/copywriting` | MIT (LICENSE) | Marketing and landing copy (never invented proof) |
| `ux-writing` | [content-designer/ux-writing-skill](https://github.com/content-designer/ux-writing-skill) `98cacde` | MIT (LICENSE) | Microcopy: buttons, errors, empty states, onboarding |
| `arabic-ready` | [jubyuhanna-create/arabic-ready](https://github.com/jubyuhanna-create/arabic-ready) `3e1ebb5` | MIT (LICENSE) | Arabic and RTL: bidi, digits, typography, natural wording; `scripts/rtl_check.py` (read-only, stdlib) |
| `next-dev-loop` | [vercel/next.js](https://github.com/vercel/next.js) `c6a5569`, `skills/next-dev-loop` | MIT (LICENSE.md, copied from `license.md`) | Checking a change in a running `next dev` (built-in `/_next/mcp` plus agent-browser) |
| `next-bundle-optimizer` | vercel/next.js `c6a5569`, `skills/next-bundle-optimizer` | MIT (LICENSE.md) | Measuring and shrinking browser JavaScript with `next analyze`; server code leaking into client bundles |
| `playwright-trace` | [microsoft/playwright](https://github.com/microsoft/playwright) `bbd9483` (v1.65.1, our version) | Apache-2.0 (LICENSE, NOTICE) | Reading a failing test's trace from the command line |
| `supabase-postgres-best-practices` | [supabase/agent-skills](https://github.com/supabase/agent-skills) `c9be0e9` | MIT (LICENSE) | Postgres and RLS performance, indexes, locking (linkyo-supabase wins) |
| `security-best-practices` | [openai/skills](https://github.com/openai/skills) `49f948f`, `skills/.curated/security-best-practices` (trimmed to the Next.js, React and frontend references) | Apache-2.0 (LICENSE.txt) | A security review of Next.js and React code, on request |
| `gdpr-dsgvo` | [waldo-van-der-code/deutsches-recht-mit-claude](https://github.com/waldo-van-der-code/deutsches-recht-mit-claude) `814b0d1`, `skills/gdpr-dsgvo` | MIT (LICENSE) | German privacy audit (DSGVO, TDDDG, Impressum), with a Playwright check for third-party requests. Orientation, not legal advice |
| `documentation-and-adrs` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `8c99fa3`, `skills/documentation-and-adrs` | MIT (LICENSE, copied from the repo root) | ADRs and docs in Linkyo's own format (`docs/DECISIONS/NNNN-title.md`) |

Every change to these files is marked `<!-- Linkyo change: … -->` (Apache-2.0 asks for that too). What changed, in short:

- **No installs or fetches at run time.**
  - `arabic-ready` lost `scripts/shape_text.py`, which pip-installed packages on demand.
  - `next-bundle-optimizer` no longer installs sibling skills with `npx skills add`.
  - `next-dev-loop` pins agent-browser 0.43.0 and asks before any global install.
  - `playwright-trace` runs `pnpm --filter @linkyo/web exec playwright trace` instead of `npx` (which would download the latest Playwright).
  - `app-store-preflight-skills` treats the `asc` CLI as optional: it needs your own App Store Connect key and is never installed without asking.
- **Removed instructions that steer an agent beyond the skill's topic.**
  - `break-ui` and `mobile-native` had a canned reply that told the agent to say nothing else.
  - `next-dev-loop` had a section that queued feedback for Vercel.
  - `next-bundle-optimizer` told the agent to run outside its sandbox.
  - `swift-testing-pro` told the agent "do not second-guess the instructions".
- **Linkyo's rules written in where a skill disagreed.**
  - Tokens instead of raw values, no shadows, no underlines.
  - Self-hosted fonts and no third-party embeds.
  - de/en/ar with Arabic plurals.
  - iOS 17 and Swift 6.0 language mode for `apps/ios`.
  - Grants and primary keys per `linkyo-supabase`.
  - ADRs in `docs/DECISIONS`.
  - Never invented legal URLs, statistics or testimonials.
- **Factual errors fixed where the checks were sure.**
  - `gdpr-dsgvo`: Vercel Analytics is client-side, the TDDDG § 25 paragraphs, the BGH case number, the DDG § 5 numbers and the Berlin defaults turned into placeholders.
  - `swift-concurrency-pro`: `.serialized` on a suite, and SE-0461 being opt-in.
  - `app-store-preflight-skills`: where the privacy and EULA links go.
  - `security-best-practices`: a redirect check that let `//host` through.
  - `arabic-ready`: invisible bidi marks became visible `⁦`-style escapes.

Notes for using them:

- `playwright-trace`: our tests run with `trace: "off"`. Re-run one spec with `--trace retain-on-failure`. `trace open` unpacks into `.playwright-cli/` (now in `.gitignore`: it holds request bodies and cookies). Playwright e2e with axe (`linkyo-qa-release`) stays the release gate for every skill here.
- `next-dev-loop`: run `next dev` with `NEXT_TELEMETRY_DISABLED=1`; Next counts every `/_next/mcp` call in its telemetry otherwise.
- `ios-accessibility` and `swiftui-pro` disagree about `View.if()`: follow `swiftui-pro` (the marked line in `ios-accessibility` says so). ADR 0041 (no underlines) is about our own styling, not about iOS "Button Shapes", which is the user's setting.
- `supabase-postgres-best-practices` has more known slips that were listed but not edited: `ALTER SYSTEM` is not available on hosted Supabase, and `SET LOCAL` is per transaction. `linkyo-supabase` wins.
- `copywriting`: sentence case for buttons (German nouns keep their capitals), real deadlines only, and other brands' names or logos only with permission.

### Motion skills added on 23 November 2026 (each file read in full once; no second independent check yet)

| Skill | Source (commit) | License | Use it for |
|---|---|---|---|
| `review-animations` | [emilkowalski/skills](https://github.com/emilkowalski/skills) `64eb3de`, `skills/review-animations` | MIT (LICENSE) | A strict review of motion code with a Block or Approve verdict; runs only when called as `/review-animations` |
| `find-animation-opportunities` | emilkowalski/skills `64eb3de` | MIT (LICENSE) | Where motion would help, and where it must not (read-only) |
| `remove-animations` | emilkowalski/skills `64eb3de` | MIT (LICENSE) | Taking out motion that slows the product down, without breaking what waited for it |
| `gestures` | emilkowalski/skills `64eb3de` | MIT (LICENSE) | Drag, swipe and sheet interactions that follow the finger |
| `animation-performance` | emilkowalski/skills `64eb3de` | MIT (LICENSE) | Finding why an animation drops frames |
| `animation-vocabulary` | emilkowalski/skills `64eb3de` | MIT (LICENSE) | The right name for a motion effect |
| `explainer-default` | [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics) `3d83d98`, `skills/explainer-default` | MIT (LICENSE) | A calm 45–90 s product demo rendered to MP4 with our Playwright and ffmpeg (set `LINKYO_ROOT` to the checkout) |
| `explainer-engaging` | Barty-Bart/motion-graphics `3d83d98` | MIT (LICENSE) | A 10–30 s one-take product story |
| `explainer-high-energy` | Barty-Bart/motion-graphics `3d83d98` | MIT (LICENSE) | A 12–20 s beat-locked promo |
| `motion-effects` | [charlie947/motion-graphics-skills](https://github.com/charlie947/motion-graphics-skills) `229022e`, `skills/motion-effects` | MIT (LICENSE) | 16 short looping UI-motion recipes for marketing clips |
| `reel-export` | charlie947/motion-graphics-skills `229022e` | MIT (LICENSE) | A 9:16 Reel or TikTok file with safe zones and an ffprobe check |

Each folder has a `SOURCE.md` (repository, commit, what was checked). Each `SKILL.md` starts with a "Linkyo note" that names where it disagrees with `CLAUDE.md`, and changed or removed text is marked `<!-- Linkyo change: … -->`. In short:

- The "Initial Response" sections that told the agent to say nothing else until asked are gone.
- Tokens instead of raw values; no shadows, glows or underlines; Radix transform origins; RTL.
- No Vaul, HyperFrames or Playwright installs. Brand, fonts and copy come from this repo.
- Emil Kowalski's skills hand off to `motion-design`, `motion` and `review-animations` here, because his `animate`, `choreograph` and `improve-animations` were left out. The earlier note that his other skills prefer shadows still holds for `apple-design` and his README.

Checked in the same round and left out:

- **From the repositories above:**
  - Emil Kowalski: `animate` and `choreograph` (duplicate `motion-design`), `improve-animations` (subagent plans in worktrees, writes `plans/`), `emil-design-eng` (repeats the installed ones), `apple-design` (translucent bars, deeper shadows, system fonts) and `animate-expo` (React Native).
  - charlie947: `brand-intake` (writes a standing rule into `CLAUDE.md`), `apple-launch-film` (rebuilds Apple's Mac interface), the prompt writers for the paid Claude Motion service, `vox-explainer`, `title-sequence-3d`, and the launch, newsletter, chart, milestone, showdown and cover skills, which the explainers cover or which are out of scope.
  - Barty-Bart: `motion-broll`, `object-separation` and `sound-effects` (run-time installs, model and audio downloads).
- **No open-source licence:** `mattypark/Motion-graphics-skill` ("All rights reserved"; its manifest names another author's repository).
- **Re-hosted bundle:** `jdjf39/video-creator-skills`. It holds copies of `cinetic`, `motion-director` and `motionmaxxing`, a `reel-editor` with a compiled macOS binary, a `watch-video` that downloads from YouTube and TikTok, and an installer that deletes skill folders and runs `npx skills add`.
- **Lists, not skills:** `charetterat/awesome-agent-motion-skills` and `frankxai/awesome-motion-design-agent-skills`. Also `claudemotion.design`, a catalogue for a paid service whose setup runs `npx claudemotion@latest`; it says it is not affiliated with Anthropic.

### Earlier vendored skills: corrections

- `vercel-labs/agent-skills` has no LICENSE file. MIT is declared in its README and in the SKILL.md front matter, so the "MIT (LICENSE)" rows above for `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions` and `web-design-guidelines` should read "MIT, declared in README and SKILL.md". The LICENSE files next to them carry the standard MIT text.
- Upstream `web-design-guidelines` (vercel-labs/agent-skills `5a37a63`) now bundles the same pinned guidelines we keep locally (same SHA-256) and no longer fetches them.

Two vendored skills differ from their source, and each change is marked in the file:

- `ui-ux-pro-max`: the search script is called by its path in this repository
  (`$(git rev-parse --show-toplevel)/.claude/skills/ui-ux-pro-max/scripts/search.py`) instead of a
  plugin variable. The script needs only Python 3 and works offline.
- `web-design-guidelines`: it reads a reviewed copy of the guidelines (`guidelines.md`) instead
  of fetching them from the internet before every review.

Where these general skills disagree with Linkyo's rules (tokens, CSS-first motion, no third-party
requests, three languages and RTL), Linkyo's rules win. See "When a general design or motion
skill says otherwise" in `linkyo-design-tokens`.

### Tools some of these skills need

- **`agent-browser`** (browser testing by command line) needs its CLI once per machine:
  `npm i -g agent-browser@0.43.0`. On a laptop, `agent-browser install` downloads a browser. In
  cloud sessions, use the Chromium that is already there:
  `export AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium`. Our Playwright tests stay the
  release gate (`linkyo-qa-release`); agent-browser is for trying things by hand.
- **`motion`**: best practices and CSS springs work offline. Documentation search, the insert
  panel and performance audits need Motion's MCP server (`https://mcp.motion.dev`), and some of
  it needs a paid Motion+ plan. It is not configured for this repo; add it for yourself with
  `claude mcp add --transport http motion https://mcp.motion.dev`.
- **`motion-design`**: Lottie export needs the LottieFiles Creator MCP. It is optional and not
  configured.

### Not added

- **Vercel plugin** ([vercel/vercel-plugin](https://github.com/vercel/vercel-plugin)): it is a
  whole Claude Code plugin, not a skill.
  - Its hooks run code on every session start and inject a large context.
  - It sends usage telemetry by default.
  - It updates from GitHub without review.

  This repo already deploys by git push, and sessions can use the Vercel connector. To use the
  plugin yourself:
  `/plugin marketplace add vercel/vercel-plugin`, then `/plugin install vercel@vercel`; set
  `VERCEL_PLUGIN_TELEMETRY=off` to turn telemetry off.
- `react-native-skills`: the app is native Swift (`apps/ios`), not React Native.
- November 2026, checked and left out:
  - **No open-source license** (source-available, CC BY-SA or none): `dpearson2699/swift-ios-skills`, `meodai/skill.color-expert`, `trailofbits/skills`, Sentry's `security-review`, anthropics `doc-coauthoring`, and the Apple HIG corpus in `HIGAgentSkills`.
  - **Hooks, binaries or downloads at run time:** `pbakaus/impeccable`, `Leonxlnx/taste-skill`, `CharlesWiltgen/Axiom`, `Perufitlife/supabase-security-skill`, and `.skill` zip bundles.
  - **Conflicts with our rules:** `make-interfaces-feel-better` and Emil Kowalski's other skills prefer shadows to borders. `tailwind-design-system` uses shadows, underlines and raw values. The style skins in `bergside/awesome-design-skills` hard-code colors and fonts. Sentry's `commit` uses capitalised subjects.
  - **Wrong facts:** `privacy-manifests` (rshankras) has swapped reason codes.
  - **Fetches instructions at run time:** the umbrella `supabase` skill. Its security checklist is worth porting into `linkyo-supabase` by hand.
  - **Duplicates of what is installed:** the AvdLee Swift skills, Dimillian skills, `playwright-cli`, and the Playwright guides (testdino, currents: too large to read in full).

Several Linkyo skills bundle scripts (`scripts/`) and, for `linkyo-media-assets`, four OFL fonts
with their license files (`fonts/`).

## How these were chosen

Every SKILL.md and bundled script was read before adding. Skills were left out when they:

- fetch their instructions from the internet at run time (`writing-guidelines`): content that
  can change without review. `web-design-guidelines` is included with a reviewed copy instead;
- run a local server (`brainstorming`);
- push workflows that clash with this repo's branch rules (git worktrees, finishing branches,
  subagent-driven plans);
- duplicate skills Claude Code already has built in (`skill-creator`, docx, pdf, pptx, xlsx);
- don't fit this product (Slack GIFs, internal comms, other companies' brand guidelines);
- need accounts or plans we don't use (`vercel-optimize` needs a logged-in Vercel CLI and
  Observability Plus; `deploy-to-vercel` and `vercel-cli-with-tokens` duplicate our git-push
  deploys).

To update a vendored skill, copy it again from its source at a newer commit, re-read the diff, and
update the commit column above.
