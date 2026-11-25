# 0083 — The team console polish after Stage 3: content-sized columns, a wide column at 2xl, 44 px targets, neutral editor words

**Status.** Accepted (polish pass after Stage 3, 2026-11-25). It amends
[ADR 0028](0028-admin-console.md) in the places named below and keeps the team area teal
([ADR 0062](0062-black-and-grey-dashboard.md)); everything else stands.

**Context.** A fresh scorer walked the Stage 3 console and listed five defects; their numbers were
reproduced before anything changed. The Security sign-in log gave each row fixed shares of the width,
so at 1440 and 1920 the "Fehlgeschlagen" chip ran 6 px into the time, "Viele Fehlversuche" 12 px under
the block button, and device names were cut without an ellipsis ("Windows · Chron"; in Arabic at their
start). The customers list cut every e-mail address and long countries while numbers had 120 px each,
and stopped at 1056 px with 300 px unused on each side at 1920. "Kunden" and "Creator" were the same
glyph at 16 px; the red block glyph repeated on every sign-in row of a phone; opening a sheet popped
its close button's tooltip up. On a phone a customer's header put the first card at 443 of 844 px,
tile labels and the search hint were cut, and segments (36 px), framed buttons (42 px), fields (38 px)
and the log's names (20 px) were small to a finger. The editor of a page the team prepares for
someone else said "Deine Seite wartet".

**Decision.**

1. **Columns sized by their values.** The sign-in log is one grid from `xl`, its header and rows
   subgrids: result, time, address, notes and action are as wide as their widest value; customer,
   place and device share the rest (at least `spacing-16`) and end in an ellipsis with a title; Latin
   names truncate inside their own `<bdi>`. Below `xl` a sign-in keeps the phone's two lines (eight
   columns do not fit a tablet or a small laptop). `DataList` gets `sizing="content"` (the customers
   list): from `xl` each column is as wide as its values, a truncating value counts its whole width
   (`minmax(min-content, 1fr)` inside the cell; a grid counts a clipping item as 0 wide), the rest is
   shared out evenly, a `wrap` field takes a second line instead of an ellipsis, and values that fit
   no laptop scroll the list sideways rather than being cut off. The default keeps the shares.
2. **A wide column at 2xl.** New token `layout.content-wide` (1600 px): the team area's wide screens
   grow to it from `2xl`, so the customers list is 1536 px wide at 1920 and starts where it starts at
   1440. Vorlagen adds a card a row there.
3. **Glyphs from the registry, one per meaning.** `creators` is a person with a star (`UserStar`), no
   longer a second framed person beside the customers' contact card. The console shell imports no
   lucide glyph: new meanings `overview`, `switchArea` (one glyph for the way to the dashboard, which
   had two) and `block`.
4. **Actions say what they do; sheets open quietly.** `BlockButton` shows its word (glyph over word,
   44 × 44 px below `xl`; compact with a tooltip on a customer's sign-in cards). `FilterSheet`, like the
   dashboard's `Sheet`, focuses itself when it opens, never its close button.
5. **44 px to a finger, measured.** Every console control reaches 44 × 44 px on a touch screen:
   `touchSegmented` at each `Segmented`, `TextField size="auto"` for searches, a framed `Button` md
   reaches 46 px (its extension starts inside its frame), small links grow with a touch-only
   `before:`; a sign-in's name link covers its row on a phone. The guard measures a pseudo-element in
   its containing block and counts only the part a finger reaches.
6. **A compact pushed screen.** The team area's `Screen` takes `back` ("‹ Alle Kunden" above the
   title); a customer's chips and actions share one row; the avatar that repeated the name went. KPI
   tile labels take two lines and tiles of a row share their label and figure rows (a subgrid).
7. **The team's editor speaks about the page.** The team area's shell hands down the editor's empty
   state in `admin.editor` words ("Diese Seite hat noch keinen Link") through a nested
   `NextIntlClientProvider` (`othersPageMessages`); a screen may still say more (the proposal editor).

**Consequences.**

- `e2e/admin-polish-app.spec.ts` guards K1 to K5 by geometry (1440 and 1920 in de, en and ar; 390 and
  360 in de and ar); unit tests in `packages/ui/test/{icons,kit}.test.ts(x)`, `console-controls.test.ts`,
  `editor-words.test.ts`. `admin-phone-app.spec.ts` expects the new creators glyph; Security stays under
  its 2,500 px on a phone (the rows are tighter, a warning chip takes a third line).
- Kit changes reach other surfaces without changing how they look with a mouse: the framed `Button`'s
  touch extension, `KpiTile` (two-line labels, shared rows), `FilterSheet`'s first focus.
- Reversible: `sizing`, `wrap`, the token, `back`, `BlockButton compact` and the registry entries are
  the switches; the 768–1279 px range of the sign-in log and the customers list keeps the shares.
