# 0055 — Apps and skills: app cards for app explainers, skill cards for GitHub authors

**Context.** The founder asked for two kinds of creators: people who explain apps in short videos
("the app is in the link") and people who share skills from GitHub (folders with a `SKILL.md` that
coding agents install). Both pasted plain links until now, which became a generic button: no icon,
no rating, no store for the visitor's phone, no command to copy.

**Decision.** Two new blocks, a page kind, editor forms, details from the source and two example
pages. The cards follow the stores' and GitHub's own reading order, in Linkyo's flat style. No
code, text, picture, name or logo of another product was copied.

| Piece | What it does |
|---|---|
| `app` block (`packages/blocks`) | name, maker, one line in the creator's words, icon, rating (0–5), category, pricing (`free`, `freemium`, `paid`), up to three stores (`appstore`, `googleplay`, `web`), a promo code and the ad label |
| `repo` block | title, description, `owner/repo[/path]`, `kind` (`skill` or `repo`), stars, language, license and an install command |
| Detection | `apps.apple.com/…/id123` → App Store app, `play.google.com/store/apps/details?id=…` → Google Play app, `github.com/owner/repo[/tree/branch/path]` → repository or skill (a `SKILL.md` link counts as its folder); a GitHub profile stays a profile |
| Details (`/api/link-metadata`) | the App Store's public lookup (`itunes.apple.com/lookup?id=…&country=…`: name, maker, icon, rating, category, price) and GitHub's API plus the folder's `SKILL.md` front matter (name, description). Fixed hosts only, never the pasted address; the 3 s timeout, 200 kB cap and one-day cache of ADR 0026 apply. An optional server-only `GITHUB_TOKEN` raises GitHub's rate limit. Google Play has no keyless API, so its apps keep what the creator types |
| App card | the stores' row: icon, name, maker (with the ad label right under the name), rating and category; **one** "Get" button that opens the visitor's own store (App Store on iPhone and iPad, Google Play on Android, else the first store), the price under it; the creator's line, a promo code to copy and "Also on" chips below. Consecutive apps form one list with hairlines, like a store chart; a highlighted app sits on the second surface |
| Skill card | where it lives (`owner/repo/path`, left to right in every language), the title, a "Skill" badge, the description, stars, language and license, the install command with a one-tap copy, and "View on GitHub" |
| Copy | `CopyButton`: the icon turns into a check that pops in, screen readers hear "Copied" from a live region beside the button (so the button's name stays what it shows, WCAG 2.5.3). Nothing leaves the page |
| Install command | `npx skills add owner/repo` (plus `--skill name` for a folder), the convention of the open `skills` command-line tool. The creator can write their own; ours follows the link until they do |
| Page kind | "App tips" (`apps`) in the welcome flow: Aura in sky blue, TikTok, Instagram and YouTube first; store links pasted in the links step become app cards. Developers are now told that GitHub links become cards with stars and an install command |
| Playground | a pasted App Store or GitHub link becomes the real card in the phone, with its real details |
| Examples | Merve Aksoy (German, app tips, Aura) and Arjun Mehta (English, skills author, Folio). Both people, their apps and skills are fictional; the icons and the video picture are original Linkyo designs |

- **Advertising.** An app with a partner code is usually advertising. The `affiliate` switch shows the
  "Anzeige"/"Ad" label right under the app's name (UWG § 5a, MStV § 22), as on links and products.
- **Safety of the examples.** A fictional page must never hand out a command that installs a real
  stranger's code: every store link, repository and install command on the example pages points to
  `example.com`, and `catalog.test.ts` checks it.
- **Privacy.** The page loads nothing from Apple, Google or GitHub: app icons are re-served by our
  image optimizer (`is1`–`is5-ssl.mzstatic.com` are exact entries in `PROXIED_IMAGE_HOSTS`), and the
  device check for the right store runs in the visitor's browser without sending anything.
- **Older directions.** Gallery, Stage and Mosaic show apps and skills as plain buttons or tiles to
  the store or repository; the full cards are Poster's.

**Consequences.**

- Tests: detection (41 unit tests), the route (Apple lookup, a skill with a folded `SKILL.md`
  description, a repository without one), kinds (store and GitHub links become valid blocks), the
  catalog (example.com only, install commands included), and e2e on desktop and an Android phone
  (the right store, codes and commands copied, the ad label, axe), in the editor (details filled in
  from stubbed lookups) and in the playground.
- Not here: Google Play details (no keyless API) and live star counts (they are read once, when the
  link is pasted).
