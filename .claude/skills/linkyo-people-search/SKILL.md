---
name: linkyo-people-search
description: Work on Linkyo's people search (the magnifier in the marketing header, Ctrl/⌘ K): who can be found, how matching and ranking work, the dialog, and the privacy rules. Use when asked to change the search, add a kind of page or person to it, fix a missing or wrong result, or bring real accounts into it.
---

# Linkyo people search

Decision records: [ADR 0047](../../../docs/DECISIONS/0047-people-search.md) (what it finds, privacy) and
[ADR 0048](../../../docs/DECISIONS/0048-search-like-an-app.md) (how it behaves on phones and computers). Read both first.

## Files (`apps/web/src`)

| File | What it holds |
|---|---|
| `features/search/search.ts` | Pure matching and ranking: `fold`, `prepare`, `searchPeople`, `highlights`. No React, no fetch. |
| `features/search/people-index.ts` | Server: who can be found, one list per language (`buildPeople`). |
| `app/api/people/[locale]/route.ts` | The list as a static file per language. |
| `features/search/people-store.ts` | Browser: fetches the list once per visit. |
| `features/search/people-history.ts` | Open and closed live in the browser's history: back closes the search and returns to it. |
| `features/search/people-search.tsx` | The button in the header and the shortcut; loads the dialog on first use. |
| `features/search/people-search-panel.tsx` | The dialog: field, chips, results, empty, loading and error states. |
| `components/scroll-row.tsx` | The chip row (shared with the gallery). |
| `messages/{de,en,ar}.json` → `search` | Every text. |

## Rules

- **Only listed pages.** The search finds what the gallery lists (`LOOKS`, `PEOPLE_LOOKS`). A page becomes findable
  by being added there, never by a special case in the search.
- **Every result is labelled** "Example", "Concept" or "Preview" (quiet text at the end of the row). The dialog has
  no small print any more (ADR 0048), so this label is what keeps the search honest: never drop it.
- **Nothing typed leaves the browser.** Do not add a request per keystroke, analytics of queries, or storage of
  recent searches (storage needs consent). The e2e test "what is typed stays in the browser" guards this.
- **Pictures come from Linkyo.** `ownPicture` only lets our own files and re-served platform pictures through
  (`PROXIED_IMAGE_HOSTS`); anything else shows initials.
- **Real accounts join only by their own choice.** When public pages of real people exist: a setting that is off by
  default, a column, row-level security and a search function on the server (skill `linkyo-supabase`), and a new ADR.
  Never list a real account that did not switch it on.

## Changing how it matches

1. Write the case as a test in `features/search/search.test.ts` first (a query and the slugs it must return).
2. Change the scores in `nameScore` / `topicScore`, or `fold` for a new spelling rule.
3. `cd apps/web && npx vitest run src/features/search`.

Names beat topics, starts beat middles, and mistakes are only forgiven when nothing fits as typed. Keep that order:
it is why a near miss never crowds out a real hit.

## Changing the dialog

- Tokens only (skill `linkyo-design-tokens`); rows are `h-16`, because the gliding highlight (`mk-search-list` in
  `globals.css`) moves by that height.
- Check it in de, en and ar, on a phone (full screen) and on a desktop (panel), light and dark.
- Phones and computers differ on purpose (ADR 0048): no marked row and no Enter-to-open on touch, the keyboard up at
  once, the screen sized to what is visible. Test a change on a real phone, with the keyboard open.
- Open and close only through `openSearch()` / `closeSearch()`: they keep the history step in order.
- `cd apps/web && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/search.spec.ts --trace off`
  (runs on desktop and phone, with axe).
