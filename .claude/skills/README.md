# Project skills

Claude Code loads these skills automatically in this repository. They come in two groups.

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

## Vendored skills (open source, copied unchanged with their licenses)

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

Several Linkyo skills bundle scripts (`scripts/`) and, for `linkyo-media-assets`, four OFL fonts
with their license files (`fonts/`).

## How these were chosen

Every SKILL.md and bundled script was read before adding. Skills were left out when they:

- fetch their instructions from the internet at run time (`web-design-guidelines`,
  `writing-guidelines`): content that can change without review;
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
