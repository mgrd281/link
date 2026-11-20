---
name: linkyo-poster-template
description: Add or change a Poster template (a named look like Nocturne, Daylight, Marquee, Pulse, Atelier, Mono) or a template layout option (headings, hero treatment, social icons) in Linkyo. Use when asked for a new template, a "template like this" from a screenshot or recording, or a new hero or icon style for creator pages.
---

# Linkyo Poster templates

A template is a starting look: colors, pairing, buttons and layout options. The creator's own
choices still win. See ADR 0012 (templates), ADR 0025 (Mono, a full worked example) and ADR 0054
(Studio, Aura, Folio, Signal and Bloom: new hero treatments, backdrops, section titles, a gallery grid
and motion as layout options).

## From a reference (screenshot or recording)

- Extract frames with `ffmpeg -i rec.mp4 -vf fps=2,scale=360:-1 f_%03d.jpg`, then tile them with
  `ffmpeg -i f_%03d.jpg -filter_complex tile=5x2 sheet.jpg` and look.
- Name what makes the look (photo treatment, name face, card color, title case, icons), then map
  each piece to existing tokens and blocks first. Most pages need no new block.
- Build an original composition: no copied text, pictures, names or logos from the reference.

## Files to touch

| What | Where |
|---|---|
| Template entry | `packages/tokens/tokens.json` → `creator.template.<id>` (`label`, `description`, `accent`, `neutral`, `tint`, `mode`, `pairing`, `buttonStyle`, `buttonShape`, `headings`, `hero`, `socials`) |
| Layout option types | `packages/tokens/src/creator/theme.ts` (`HeadingStyle`, `HeroStyle`, `SocialStyle`, `BackdropStyle`, `GalleryStyle`, `MotionStyle`, `CreatorLayout`, `DEFAULT_LAYOUT`) + `test/palette.test.ts` |
| Hero treatment and socials | `apps/web/src/features/directions/poster/hero.tsx` (treatments, `Socials plain`), backdrops, section titles and the gallery grid in `renderer.tsx`, motion utilities (`poster-*`) in `src/app/globals.css` |
| Picker previews | `poster/template-picker.tsx` (two rows of three on wide screens), `examples/gallery-card.tsx` (`hero` type, card face) |
| Texts | `templates.<id>.description` in de/en/ar, plus every "N templates" sentence (`grep -n "templates" src/messages/*.json`) |
| Example page | a `LOOKS` entry with `template: "<id>"` plus a page in `catalog-*.ts` (see `linkyo-example-page`) |
| Decision | `docs/DECISIONS/00NN-*.md` + a row in its README, and a row in ADR 0012's table |

## Steps

1. Add the tokens. Run `pnpm --filter @linkyo/tokens build && pnpm --filter @linkyo/tokens test`.
   Every resolved palette must pass the AA audit.
2. Implement any new layout option in the hero or renderer with token classes only.
3. Wire the picker, gallery and texts.
4. Look at the sample page in the new look: build, start, then for de and ar open
   `/<locale>/directions/poster?template=<id>&chrome=0` at 390 × 844 (Playwright screenshot). Click
   "Nur notwendige" / "الضروري فقط" first so the privacy notice is gone. The marketing site shows
   templates through the real renderer (picker, gallery, playground), so there are no phone captures
   to keep in step.
5. Build an example page in the new look, then run `linkyo-qa-release`.
