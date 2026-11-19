---
name: linkyo-ux-audit
description: Audit and improve Linkyo's user experience end to end (marketing site, sign-up, welcome flow, dashboard, creator pages) on phone and desktop. Use when asked to make the UX, design, buttons, layout or ease of use "10/10", to review the product as a user would, or before a release that touches many screens.
---

# Linkyo UX audit

Look at the real product the way a user meets it, fix what you find, and look again. Don't guess
from code: screenshots first.

## 1. Capture the journey

Build and start the app, then run the bundled script once per viewport (German by default):

```bash
cd apps/web && pkill -f next-server; npx next build && (npx next start -p 3100 &)
node .claude/skills/linkyo-ux-audit/scripts/journey.cjs <out-dir> mobile   # 390 × 844
node .claude/skills/linkyo-ux-audit/scripts/journey.cjs <out-dir> desktop  # 1440 × 900
python3 .claude/skills/linkyo-ux-audit/scripts/sheet.py <out-dir>
```

- **Output.** The script signs up a fresh demo account, walks the welcome flow, adds a Spotify and a
  YouTube link, then visits Home, Page, the Add and Edit sheets, Design, Stats, Settings and the
  own-page preview. `sheet.py` puts the shots on contact sheets: 4 phones or 4 desktops each, so
  the review costs a few images, not 32.
- **Arabic.** Pass `ar` as a third argument for a run in Arabic (RTL).

## 2. What to look for (each item has bitten us before)

- **Overflow on phones:** two buttons side by side whose German labels don't fit. Stack them
  below `sm`.
- **Desktop-only hints on touch:** keyboard shortcuts (⌘Z, ⌥↑) on phones. Use `pointer-fine:` to
  show them only with a mouse.
- **Repeated hints:** the same sentence two or three times on one screen. Keep one line.
- **Inconsistent buttons:** one ghost or text button among outlined ones, or a button that lost its
  icon (`<Button asChild>` must render through `Slot.Slottable`).
- **Placeholder content after real input:** "Music" with a grey tile after a Spotify link means
  link metadata did not arrive (see `linkyo-link-metadata`).
- **Overlays covering content:** privacy notice, docks, the preview label. Check that taps reach
  the page (`pointer-events-none` wrappers).
- **RTL:** order of words, icons that point the wrong way (`rtl:-scale-x-100`), prices in
  `<bdi dir="ltr">`.
- **Empty states and new accounts:** a brand-new page must still look finished (monogram, starter
  blocks).

## 3. Fix, then prove it

- **Make each fix where it belongs.**
  - Shared components (`packages/ui`) fix every screen at once.
  - Texts go in de, en and ar (`src/messages/*.json`).
  - Tokens only (see `linkyo-design-tokens`).
- **Re-run the journey** and compare the before and after sheets for the screens you changed.
- **Add an e2e test** for behaviour (not looks). Stub external calls with `page.route`.
- **Finish with `linkyo-qa-release`.** That means the full suite (about 350 tests), a commit, a push,
  and a live check.
- **Report honestly:** what changed, with numbers, and what is still left.
