# 0075 — The Portfolio section of the website

**Status.** Accepted (Stage 1, WP1.4, 2026-11-24).

**Context.** Linkyo has two portfolio templates from Portfolio v1 (Werkbogen and Tiefdruck) and project pages with figures, a story, pictures and an address of their own. The
website did not show any of it: no gallery category, no `/portfolio`, no menu entry and no homepage
text; Ronja Feldkamp's chip said "Beispiel · Läden & Praxen". The footer's "Ressourcen" led to Phase-0
prototypes, a signed-in visitor still saw "Anmelden / Registrieren", and "Vorlage" meant both the 14
designs and the 91 example pages.

**Decision.**

1. **A gallery category, not a list of categories.** `CATEGORIES` gains `"portfolio"` (second, after
   creators; icon FolderKanban, the project block's glyph). Ronja Feldkamp, Tobin Achterberg, Elena
   Novak, Jorinde Ahlfeld, Jonas Ek and Arjun Mehta move into it. All six show their own work:
   four with project pages, Jonas Ek as a gallery of architecture photographs, Arjun Mehta as his
   open-source repositories. `category` stays a single value, so the readers (preview chip, OG card,
   gallery, search, team console) needed no change beyond the new label and icon. A page that should
   also stay in its old category is a later decision (`categories: Category[]`).
2. **`/[locale]/portfolio`, read from code.** The page lists what the code holds: the pages of the
   Portfolio category, the templates they use (most used first; names from the tokens, lines from
   `templates.<id>.description`) and the captures in `features/marketing/portfolio/shots.ts`. A new
   portfolio template or example appears without a copy change. Sections: an opening with Ronja's
   real page on a laptop and a phone (captures, so the page stays light), the fields as tabs
   (Fotografie · Design & Architektur · Entwicklung & Handwerk, each a list of kinds; a field without
   an example is left out), what a project page can do, the templates with "Mit dieser Vorlage
   starten", a short FAQ and a last call. Every claim on it is a feature that exists today (figures,
   story, pictures with captions, a picture opening at full size, its own address with redirects,
   confidential clients, GitHub facts, a CV link, the Laufbahn template). It is static, in the
   sitemap and in `e2e/routes.ts`, and has its own link preview with the Arabic lines placed word by
   word.
3. **"Mit dieser Vorlage starten"** leads to `/signup?kind=<kind>&look=<example>`: the sign-up form
   already reads both and starts the account with that look.
4. **Navigation.** "Portfolio" sits between Vorlagen and Preise in the header and the phone menu,
   and is marked on its own page (`aria-current`). Funktionen takes the Blocks glyph, so the menu no
   longer shows two grids side by side.
5. **Signed-in visitors.** The header reads the session after the first paint: in a demo build from
   the browser's store; with real accounts only when the Supabase session cookie exists, so visitors
   without an account download none of the account code. Signed in, the header shows the avatar and
   "Zum Dashboard"; the phone menu offers "Meine Seite bearbeiten" and the dashboard instead of
   sign-up. The server and the first paint stay the signed-out header.
6. **Footer.** Product: Funktionen, Vorlagen, Portfolio, Preise (and Seitenservice when payments are
   on). Resources: Editor ausprobieren (`#try`), Analytics, FAQ. The design system and the
   prototypes stay reachable by their address only.
7. **One vocabulary for counts.** "Designs" are the templates in the tokens, "Beispielseiten" every
   page the gallery lists. `SITE_COUNTS` in `features/examples/looks.ts` holds both; copy takes them
   as placeholders, and a unit test checks them against `TEMPLATE_IDS` and the registry. Sentences
   that are read without arguments (the layout's default description, the app manifest) name no
   number at all.
8. **The homepage band** shows the first two portfolio pages with a phone capture (Ronja, Tobin),
   taken by `scripts/capture-example-shots.mjs` on the work package's own build, and leads to
   `/portfolio`. The script now also takes laptop (`laptop:<slug>`, 1440 × 810) and project
   (`project:<slug>/<project>`) pictures.

**Consequences.** Later portfolio templates (Leuchttisch, Grundriss, Logbuch) and their example
people join the category and appear on `/portfolio`, in its tabs and its template row by data alone;
a new field (for example architecture on its own) is one line in `PROFESSIONS` and three message
keys. The captures must be retaken when a portfolio page's first screen changes. The celebrity hero
and search defaults are unchanged (L-05 is a founder decision).
