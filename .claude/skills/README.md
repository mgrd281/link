# Project skills

Claude Code loads these skills automatically in this repository. They come in two groups. Linkyo's own skills take precedence.

## Linkyo skills (written for this repo)

| Skill | Use it for |
|---|---|
| `linkyo-design-tokens` | Any UI work: token-only values, creator colors, swatches, lint rule |
| `linkyo-example-page` | New or improved fictional example pages in /templates (photos, clips, buttons) |
| `linkyo-concept-page` | Pages for well-known people: sources, licenses, one language per page |
| `linkyo-page-kind` | New page kinds in the welcome flow ("What describes you best?") |
| `linkyo-qa-release` | Verify, commit, push and check a change live |
| `linkyo-ux-audit` | Screenshot the whole journey on phone and desktop, review against known pitfalls, fix, re-check |
| `linkyo-share-images` | Link preview cards (Satori) and story/post pictures (canvas): fonts, Arabic, build rules |
| `linkyo-link-metadata` | Real titles and pictures for pasted links: oEmbed route, image proxy, adding a platform |
| `linkyo-poster-template` | New Poster templates and layout options (hero, headings, social icons), from a reference |
| `linkyo-media-assets` | Licensed photos and clips, original cover art with bundled OFL fonts, CREDITS.md and media.ts |

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
