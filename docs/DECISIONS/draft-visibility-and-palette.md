# draft — Visibility and search texts, help in the dashboard, the ⌘K palette

**Status.** Proposed (Stage 4, WP4.5: D-09, D-15 palette, shortcuts and Add search, W-04 in-app entry,
LEFTOVERS 1–2). The lead numbers it.

**Context.** Creators could not pause their page, keep it out of search engines or say how search results and
link cards name it (D-09). The dashboard had no help entry (W-04), no way to jump with the keyboard, no list of
its shortcuts and no search over the Add sheet's 25 entries (D-15). At 1920 px Statistik and Einladen left about
500 px free beside a column anchored at the section panel, Settings and its form panes about 350 px
(LEFTOVERS 1); the Arabic day names under Home's week chart touched each other at 360 px (LEFTOVERS 2).

**Decision.**

1. **Visibility lives in the page document**, on the profile: `profile.visibility` (`visibilitySchema` in
   `packages/blocks/src/schema.ts`): `paused`, `search` (false = keep out of search engines), `title` (≤ 60) and
   `description` (≤ 160). No migration: `public_page()` already hands the whole page JSON to the server, and both
   stores (demo and Supabase) save the profile as it is.
   - Absent means today's default; the dashboard stores only what differs (`storedVisibility`).
   - Each field parses on its own (`.catch(undefined)`): a bad value drops that field, never the page.
   - It is a setting, not content: `siteReducer`'s `replace` (an AI draft, a proposal, an imported file) keeps the
     page's own settings, so the AI never pauses, unpauses or retitles a page (the AI never publishes). The AI plan
     does not know the field and needs no new plan or prompt version; `mapSources` is about pictures (none here).
   - **Prepared pages in the team console** reuse the editor but not Settings: a prepared draft has no
     `visibility`, so it shows and hands over the page visible, indexed and with the default texts; the creator sets
     these after taking it over. The console's view of a published page was not changed here and shows no
     pause (a follow-up for the console).
2. **The public page** (`app/u/[username]/page.tsx`, `features/creator/{public-page,visibility,paused-page}.ts*`):
   - Paused: `toPublicPage` keeps only the name, the photo and the language (`pausedPage`): no block, no line,
     no numbers, no hero. Every route reading `loadPublicPage` therefore shows nothing of the content (project
     pages answer 404, tested; the link card shows name and photo; the Lebenslauf and Anschreiben PDFs need the
     page's blocks, so `documentEligibility` offers none: read in the code, not run, as the Laufbahn specs are
     off limits here). The page renders `PausedPage`, a calm page in the creator's colours with "Diese Seite ist
     gerade pausiert." and Linkyo's privacy link, HTTP 200, `robots: noindex, nofollow`.
   - No counter: the layout (not ours to change in this step) still writes the counting script, which now returns at
     once when the page carries `data-paused` (`features/analytics/beacon-script.ts`, one line, with a test).
   - The layout keeps reading the page's language from `loadPublicPage`, so `<html lang dir>` stay right.
   - "Auf Suchmaschinen zeigen" off: `robots: noindex, nofollow`. Creator pages are in no sitemap (`app/sitemap.ts`
     lists `PUBLIC_PATHS` only), so there is nothing to leave.
   - Title and description (`searchTexts`): the owner's, else the name and the tagline or bio (≤ 160, cut by
     characters, not code units). The same texts go to Open Graph and Twitter, and onto the card
     (`opengraph-image.tsx`: `cardPage` puts them in the name's and the line's place).
   - Once a change of the settings has reached the database, the visibility pane asks
     `/api/account/revalidate` to drop the cached page and card, so visitors see it on their next visit (else within
     the minute of ISR). Search engines follow on their next crawl; the pane says so.
3. **The owner's views of a paused page:** Settings shows "Pausiert" in the Sichtbarkeit row; the pane says what
   visitors see; "View my page" shows the page with a strip "Pausiert: …" and a link to the pane; Home's link card
   no longer says the page is public. The preview beside the screens keeps showing the page.
4. **Help (W-04):** a "Hilfe" row in Settings, a "?" at the rail's foot and a help link on the screens that have an
   article (Statistik, Seitenadresse, Impressum, Konto → delete, Home's link card → teilen), all through
   `helpHref` (`routes.ts` `helpLink` drops the language for the router's `Link`). Same tab. The rail's "?" opens
   the screen's own article. Inside the iPhone app help is one of the pages the web view may open (ADR 0087), so the
   Settings row and the screen links stay; the rail is hidden there anyway.
5. **⌘K palette (D-15):** the kit's `CommandPalette` (combobox over a listbox, the result count in a polite live
   region, right to left with the page) with three kinds of result: the dashboard's screens and panes, the Add
   sheet's entries (the sheet opens at that type's form: `AddDoor` `{ pick }`) and the page's blocks by title (the
   edit sheet opens). Ctrl+K / ⌘K on every screen (also by key position, so the Arabic layout works); not over
   another open sheet or dialog. A search button in the phone's top bar and in the rail. Focus goes back where it
   was on close (`useReturnFocus`: the palette has no Radix trigger). It comes in its own chunk, loaded on first use.
6. **"?" lists the shortcuts** that exist (palette, this list, undo, redo, move a block up and down, Escape), ⌘ on
   Apple platforms and Ctrl elsewhere. Not while typing, not over a dialog; the palette offers the list only where
   there is a fine pointer.
7. **App mode (ADR 0087):** no palette, no search button, no key listener and no "?" list in the iPhone app; every
   palette screen is a dashboard path, and the palette is not mounted there at all.
8. **Add-sheet search:** a search field filters the entries by name, card line and search words
   (`app.add.keywords.*`, de, en, ar), with Arabic folded as people type it (أ/إ/آ → ا, ة → ه, ى → ي, no marks), an
   announced count and an empty state. The same menu and fold serve the palette (`features/app/add-search.ts`).
9. **Leftovers:** Settings and its form panes grow (`isGrownPath`) and stand in two columns where there is the room
   (the form, and beside it its help article); a `wide` screen beside the section panel (Statistik, Einladen) may
   take `layout.content-wide` from 2xl. Arabic day names drop their article (اثنين … أحد), as calendars write them.

**Consequences.**

- One field more in the page JSON; old pages are unchanged. The page's settings travel with "Meine Daten
  exportieren" (an import does not apply them: see 1).
- The help article "teilen" says the link preview shows the name and line; with search texts it shows those.
  `features/help/**` was read-only here: a follow-up for its owner.
- Tests: `schema-visibility.test.ts`, `public-page.test.ts`, `site-reducer.test.ts`, `beacon.test.ts`,
  `routes.test.ts`, `keys.test.ts`, `add-search.test.ts`, `weekday.test.ts`; `e2e/visibility-app.spec.ts` (with
  a stub block for the public side) and `e2e/palette-app.spec.ts`.
