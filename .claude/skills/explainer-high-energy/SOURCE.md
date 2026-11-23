# Source

- Repository: https://github.com/Barty-Bart/motion-graphics
- Path: `skills/explainer-high-energy` (SKILL.md)
- Commit read: `3d83d987d658601d8a1269eb691622bdcd427335` (committed 2026-10-13)
- Vendored: 2026-11-23
- Licence: MIT (`LICENSE`, copied from the repository root, © 2026 Bart). Its last lines name the Geist fonts (OFL) and Lucide icon paths (ISC) of the `motion-broll` skill, which was not copied

## What was checked

- SKILL.md was read in full, including the `render.mjs` script it embeds: Playwright screenshots of a local HTML file, piped into ffmpeg, with audio rendered in the page. It reads `HTTPS_PROXY` only to hand it to Chromium. There is no other network use, no telemetry and no write outside the output paths it is given.
- Scanned for invisible or control Unicode characters and HTML comments: none.
- Nothing from the repository was run during vetting. The edited `render.mjs` was only syntax-checked (`node --check`).
- `README.md` was left out: it only points to demo GIFs that were not copied.
- The other skills in the repository were not installed: `motion-broll` (talking-head B-roll; its `setup.sh` pip-installs numpy with `--break-system-packages` and npm-installs Playwright), `object-separation` (installs torch and downloads SAM 2 models) and `sound-effects` (downloads Mixkit audio with curl at run time, bundles 2.7 MB of audio).
- Not a duplicate: see `explainer-default`; this one is a 12 to 20 second beat-locked promo.

## Linkyo changes

Each change is marked in the file: a "Linkyo note" quote at the top, `Linkyo change` comments where text was changed or removed.

- A Linkyo note at the top: brand from tokens, flat (no shadows, glows, halos or underlines), self-hosted fonts, facts and copy from this repo in de/en/ar, no installs, build outside the app, pause control and reduced motion for video on a page, third-party logos only with permission.
- Step 3 no longer runs `npm i playwright` or `npx playwright install chromium`.
- `render.mjs` loads `@playwright/test` from `$LINKYO_ROOT/apps/web/package.json` with `createRequire`, instead of `import ... from 'playwright'`.
- The fonts rule points to the app's self-hosted fonts instead of downloading them.
