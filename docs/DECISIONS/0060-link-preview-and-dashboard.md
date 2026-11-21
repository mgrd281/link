# 0060 — Real link previews and a dashboard that feels like an app

**Context.** The founder sent an iPhone screenshot of the home tile "Teilen wie ein Profi":
- its "Link-Vorschau" card was a phone screenshot cropped at the eyes;
- the "Story" beside it was the same screenshot, tilted and clipped, with an English badge.

They asked for a full pass on the link preview "from every angle", and on the dashboard: ease of
use, icons, the experience and adding things to a page.

**How it was done.**
- **Audit.** Six agents each audited one area against the running build and the code:
  - the preview cards and metadata;
  - the home tile;
  - the app shell;
  - adding and the page list;
  - sheets and forms;
  - Home, Design and sharing.
- **Plan.** A seventh agent turned the audits into one plan with strict file ownership. It also
  listed the end-to-end tests whose names and locators must not change.
- **Build.** Six implementers built the six work packages in separate git worktrees, which were then
  merged one by one.
- **Review.** Independent reviewers checked the merged change, and a skeptic re-checked each finding.
  One finding was rejected; the confirmed ones were fixed.

**Decision.**

- **Link previews (Open Graph).**
  - A creator page's preview now says who it is:
    - `og:title` / `twitter:title` are the person's name with the page kind, for example
      "Lea Hartmann · Beispielseite für Journalist:in";
    - the description is the tagline or bio (at most 160 characters), with the site description as
      the fallback.
  - The card is a `summary_large_image` with `og:type` profile and the locale (de_DE, en_US, ar_AR).
  - The photo on the card is fetched only from allowlisted hosts:
    - no redirects;
    - a 5 s timeout;
    - JPEG or PNG only;
    - at most 1.5 MB.
  - A page without a photo gets a monogram circle in its accent colour instead of an empty column.
  - Arabic names are measured with their joined letter forms, so they no longer overflow or wrap
    early.
- **The home tile shows the real thing.**
  - "Link-Vorschau" is now a chat: a message bubble with the real preview card of an example page,
    as a messenger would show it (title, description, `linkyo.app`). It loads lazily, below the
    fold, through the image optimizer. Locally that makes about 9 KB of AVIF, but on Vercel
    generated images pass through unchanged, so live it is still the 620 KB PNG (see "Left for
    later").
  - "Story" is the real story picture, drawn on a canvas the way the dashboard draws it. It stands
    upright, uncropped, in the visitor's language.
  - Faces stay in view (focal points).
- **The story picture.**
  - Text and links stay above the zone that Instagram's and WhatsApp's reply bars cover.
  - Initials follow the Arabic one-letter rule.
  - Sharing sends the picture with the page address as its caption wherever files can be shared;
    otherwise the picture is downloaded.
- **The app shell on phones.**
  - The top bar is three columns:
    - the avatar at the start opens the account menu;
    - in the middle, the screen's title appears once its heading scrolls under the bar;
    - at the end, a compact save state, "View page" (eye) and Settings.
  - The tab bar's "+" is flat and labelled like the other tabs, a teal pill instead of a raised disc.
  - The active tab is marked by colour alone.
  - Screens use the grouped look of iOS: a tinted canvas with white grouped lists (`data-grouped`).
  - The loading skeleton draws the same bars, so nothing jumps when the dashboard appears.
- **Adding to the page.**
  - The Add sheet starts with "Paste" and an upload for photos. "Paste" reads the clipboard in one
    tap where the browser allows it; otherwise the field takes focus. A pasted list of links becomes
    several blocks in one undo step.
  - The types follow in short groups: "For you" (by page kind) or "Popular" first, then "Links &
    contact", "Photos, video & music", "Sell & events" and "Text & layout". Each type appears once.
  - Each row of the page list has "Add below". A new row is highlighted and scrolled into view.
  - Undo after a delete puts the block back once, before the block that followed it.
- **The page list.**
  - Blocks form one grouped list with a reorder mode; drag texts and keyboard instructions are
    localized.
  - After a delete, focus moves to the neighbouring row.
  - Titles keep their own text direction (`dir=auto`) but line up with the page's start.
- **Sheets and forms.**
  - Closing a sheet returns focus to the control that opened it.
  - On phones, sheets that confirm get an iOS-style top row: cancel, title, confirm. Titles may wrap
    to two lines rather than being cut.
  - Fields are filled, 48 px tall, by default.
  - A link form asks for the URL first and fills in the title by itself (600 ms after typing stops).
    It ignores late answers after the sheet closes. Rarely used fields sit under "More options".
  - On wide screens the live preview follows the block being edited and outlines it.
- **Home.**
  - Home opens with the checklist; finished items fold away behind "N done".
  - Next comes the link panel: copy, share, and the QR code and story picture as rows.
  - The separate shortcuts are gone, because each one is now in its place.
- **Design.**
  - On phones a small live preview stays in sight under the bar (30 % of the small viewport height).
  - Focus always scrolls clear of the preview (WCAG 2.4.11).
  - Colours are 12 named swatches plus "Template colour".
- **Icons.**
  - One share glyph everywhere.
  - An eye for "View page".
  - Settings as a gear in the bar.
- **Shadows and underlines stay forbidden** (ADR 0037, ADR 0041): depth comes from fills and
  hairlines.

**Left for later.**
- **Preview card format.** The cards are still PNG (about 620 KB), and Vercel does not shrink
  generated images, so the home tile loads that PNG too. JPEG would need `sharp` as a direct
  dependency, so it waits for the founder's approval of a new dependency.
- **The slug `rihana-store`.** It reads like a real artist's name. Changing it needs a redirect, so
  it gets its own change.
- **More layouts and screens:**
  - a square preview layout for messengers that crop to 1:1;
  - Settings as a native grouped list;
  - search inside the Add sheet.
- **Carried over from ADR 0059:**
  - home template cards that open the preview sheet;
  - equal chip heights;
  - the phone header at 320 px.

**Status.** Applied.
