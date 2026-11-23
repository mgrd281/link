# Source

- Repository: https://github.com/emilkowalski/skills
- Path: `skills/gestures` (SKILL.md)
- Commit read: `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c` (committed 2026-11-15)
- Vendored: 2026-11-23
- Licence: MIT (`LICENSE`, copied from the repository root, © 2026 Emil Kowalski)

## What was checked

- Every vendored file was read in full. They are Markdown only: no scripts, hooks or binaries.
- Scanned for invisible or control Unicode characters and HTML comments: none.
- No instructions to install, fetch at run time, push, call external services or change agent settings. The only links are reading material (emilkowal.ski articles, easing.dev, easings.co), never loaded by a page.
- Upstream has no "Initial Response" section here.
- Not a duplicate: `motion` and `mobile-native` mention drag only in passing.
- Emil Kowalski's `animate`, `choreograph`, `improve-animations`, `animate-expo`, `apple-design`, `emil-design-eng` and `pick-ui-library` were not installed: `animate` and `choreograph` duplicate `motion-design`; `improve-animations` runs subagent plans in worktrees and writes a `plans/` folder; `emil-design-eng` repeats the installed ones; `apple-design` is general design with translucent bars, shadows and system fonts; `animate-expo` is React Native. References to them in the text are redirected by the Linkyo note.

## Linkyo changes

Each change is marked in the file: a "Linkyo note" quote at the top, `Linkyo change` comments where text was changed or removed.

- A Linkyo note at the top: the sheets from ADR 0056 already exist, no Vaul or other new dependency, motion tokens (the Vaul curve equals `ease-emphasized`), WCAG 2.2 2.5.7 single-pointer alternative, RTL, no shadows.
