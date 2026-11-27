# 0089 — Lebenslauf and Anschreiben as PDFs, written by our own module

**Status.** Accepted (Laufbahn round 6, 2026-11-27). Pairs with [0069](0069-laufbahn-template.md) round 6, the
page that offers these documents (the hero's Lebenslauf, the bar's pills, the Unterlagen cards, the letter's PDF
pill and the Kontakt band's rows all link to the routes below). Spec: `audit/laufbahn-v6/SPEC.md`, parts B and C.

## Context

The founder wants every application page (template Laufbahn) to hand an employer its documents:
a German tabular CV (Lebenslauf) and a cover letter (Anschreiben, DIN 5008), downloadable, generated
from the page's own data, for every Laufbahn page and not only one person's. No PDF library is
installed and none may be added.

## Decision

1. **Our own PDF writer, no dependency** (`apps/web/src/features/documents/**`). PDF 1.7, A4, about
   2,800 lines of module (offer, input, layout, writer, serve) and 900 lines of tests:
   - `font/ttf.ts` reads Geist's TrueType tables (head, hhea, maxp, hmtx, cmap 4, OS/2, post, name);
   - `layout/*` sets the text on measured advances (greedy, ragged, no hyphenation) into boxes;
   - `pdf/*` writes the boxes (`writer.ts`, `render.ts`, `jpeg.ts`);
   - `miniature-marks.ts` turns the same boxes into the page's thumbnail.
   Simple TrueType fonts with WinAnsiEncoding, `/Widths` for codes 32–255 from cmap and hmtx, a
   ToUnicode map, whole font files embedded (FontFile2, Flate). Text stays real text, selectable and
   extractable, in reading order. Vector rules and squares, link annotations for `tel:`, `mailto:`
   and `https:`. `/Info` with Title, Author, Creator and Producer, never a date. The same input gives
   the same bytes (no clock inside; `/ID` is the SHA-256 of the file's own bytes).
2. **Addresses**: `/<username>/cv`, `/letter`, `/application` (both in one file, with outline entries),
   rewritten by the proxy to `/u/<username>/…`; prepared pages at `/<locale>/p/<slug>/…`. Undotted
   (the proxy skips paths with a dot). `RESERVED_PROJECT_SLUGS` gains `letter`, `application`,
   `lebenslauf`, `anschreiben`, `bewerbung` and `unterlagen` (`cv` was there).
3. **One predicate** (`offer.ts`, `documentEligibility`) decides for the page and the routes: a de or
   en page of a signposted template (Laufbahn) with a printable name; the CV when it has a career,
   skills or an about section, the letter when it has a cover letter (as the renderer finds it); each
   only when every text that document prints can be printed. An owner's own CV file (a contact link
   of kind `cv`) replaces the generated CV.
4. **Arabic pages get no PDFs.** A hand-made simple-font PDF has no Arabic shaping (joining forms,
   ligatures) and no bidirectional ordering; a CV whose letters fall apart is worse than none. The page
   offers Share instead. A shaped Arabic CV needs a CID font with GSUB and a bidi pass: a project of
   its own.
5. **WinAnsi only, never a dropped letter.** A page whose printed texts need a letter outside WinAnsi
   ("Łukasz", "Kılıç", "Yılmaz") is not offered that document in v1. Emoji, soft hyphens, joiners and
   variation selectors are removed (decoration, not letters); thin and narrow spaces become a space or a
   no-break space. v1.1: a per-document `/Differences` encoding built from Geist's post table, so any
   Latin letter Geist has can print.
6. **Nothing invented.** Every fact comes from the page (`input.ts` is the only reader of blocks):
   - missing data (address, birth date, employer, months) simply does not appear;
   - contact lines come only from the page's contact block at request time (first `tel:`, first
     `mailto:`); for a prepared page that block comes from the server's private environment, so it
     exists only in the response;
   - a German mobile number in E.164 is grouped "+49 176 12345678" (formatting, not invention);
     everything else prints as stored.
7. **The letter (DIN 5008 Form B)**:
   - the address field is kept free: no addressee, no return line, nothing invented, but the geometry
     stays so the subject sits where a German reader expects it;
   - the subject is "Bewerbung als {position}" from the page's own fact, else the bare word, never
     the tagline, and never the word "Betreff";
   - the salutation follows the subject after two empty lines (12.69 mm, three 4.23 mm DIN lines,
     baseline to baseline; the spec's 8.46 mm left one empty line, too tight for DIN);
   - the owner's text exactly: no salutation and no closing are ever added. A closing the letter has
     gets 12.7 mm of signature space before the name; a closing with no name after it gets the
     sender's own name (form, not invention);
   - the closing is a line that is a closing and nothing else ("Mit freundlichen Grüßen", "Kind
     regards,"), searched from the end of the last paragraph and followed by at most a short signature
     (three lines of up to 60 characters), or the last line of the paragraph before a name that stands
     alone. A sentence that merely holds the words ("I am sincerely …", "beste Grüße an das Team") is
     body text. Whatever the owner wrote before the closing in the same paragraph (a letter typed with
     single line breaks is one paragraph) is set as body text: wrapped to the text column and split
     across pages like any paragraph. Only the closing line, the signature space and the name are
     kept together, and every one of their lines wraps too;
   - "Anlage: Lebenslauf" only in the combined file, where the CV really follows.
8. **Dates**: the letter's "Datum" is the request's day (Europe/Berlin); the CV's "Stand" is the
   page's last save (public pages only; prepared pages have none and print none).
9. **The photo rule.** Only a real portrait the owner uploaded: the portrait of the about block the
   page shows right now (visible and in its schedule) or the avatar, when it is a picture of the
   person (no still of a drawn clip), stored as a JPEG upload (`….jpg`, as uploads are named) in this
   deployment's media bucket, fetched within 3 s and 2 MB, and a baseline or progressive JPEG
   (DCTDecode, no recompression). Otherwise no picture, no initials, no empty frame. No illustration
   ever stands in for a person. PNG and WebP uploads (stored as WebP): not in v1. The page's miniature
   and page count ask the same candidate (`photoCandidate`), so a WebP upload gives a card without a
   photo box, as the PDF has none. The photo covers its 35 × 45 mm box at its own aspect ratio:
   scaled evenly, clipped (`re W n`), at the owner's focal point (the centre without one); never
   stretched. The fetch checks the address by origin and normalised path (no dot segment, plain or
   percent-encoded), follows no redirect and stops reading at 2 MB even without a declared length.
   Demo builds have no uploads; the tests inject bytes.
10. **Privacy and headers.**
    - Every answer carries `X-Robots-Tag: noindex, nofollow`.
    - Prepared pages (`/p`, including the private one) answer `Cache-Control: private, no-store`,
      without an ETag.
    - Public pages (`/u`) answer `Cache-Control: public, max-age=0, must-revalidate` with an ETag
      (SHA-256 of the bytes) and 304 on a match.
    - `Content-Disposition: attachment` (the task's download), with an ASCII `filename` and the
      name's own letters in `filename*`. The spec's draft said `inline`; `attachment` keeps the
      download on desktop browsers, and iOS opens it in its PDF viewer after the download prompt.
    - A document that is not offered answers an empty 404 with `no-store`, also for a name an object
      inherits (`/de/p/constructor/cv`: the registry knows its own entries only); any failure, the
      lookup included, answers an empty 500 with `noindex` and `no-store`. Nothing is logged: page
      text and contact data never reach a log.
    - The page's miniature holds numbers and tones only. Each contact row is one bar of one fixed
      width (28 mm), so the HTML holds no contact data and no exact length. What it can show is a
      coarse band of the longest address: the CV's contact block takes the last four columns, or one
      or two more (a value over 38 mm, about 23 characters), or moves under the accent rule (over
      66 mm, or when it would run into the head's words); in the letter an address over about 60
      characters still wraps at 7 pt, moving the rows under it down a line. Never the address itself.
11. **Contact values stay on one line where they fit.** They are what a recruiter copies, and an
    applicant tracking system reads an address only whole. The CV's contact block stands top right in
    the last four columns; a value too wide for them takes one or two columns more towards the start
    (on the grid, labels and values each in their own column), as long as the block stays a gutter
    clear of the head's words level with it; a value too wide for that, or a photo in the corner,
    puts the rows under the accent rule (label and value on one line, in the twelve columns, or the
    eight beside a photo). In the letter's information block (48 mm for a value) the contact values
    step down together from 8.5 to at most `info-min` (7 pt) until the widest fits. Only a value
    wider than its block at that size breaks, as a last resort. Every address is one link rectangle.
12. **Reading order.** Each section's title comes before its first row in the content stream, so
    extraction, copying and screen readers read "Profil", then the profile.
13. **Paper colours** come from the page's palette resolved in light mode (paper is white even when the
    page is dark): ink `creator-fg`, muted `creator-fg-muted`, accent `creator-accent-text`, marks
    `creator-line-strong`. Every measure is a token of the new `print` group in
    `packages/tokens/tokens.json` (mm and pt), emitted to TypeScript only (no CSS, Tailwind or Swift).
14. **Fit and pagination.** A CV that overflows by at most 37 mm (an eighth of a page) tightens (section
    and entry gaps, facts two to a row) and stays on one page; longer, it runs on with a running head,
    the section title repeated beside continued rows, no split career entry and no single line of a
    paragraph left alone. A long letter first sets its body at 10/14.5 pt, then runs onto a second page.
    Nothing is placed past the last line a page holds while a split or a new page can avoid it: a
    paragraph splits (on the first page too, and again when it is longer than a page), anything else
    moves to the next page whole; only a unit that cannot split and is taller than a whole page could
    stand past it, and no letter has one.
15. **The footer never prints over itself.** When a long name and a long public address would meet,
    the end ("Stand …", the address, "Seite x von y") moves to a line of its own: the name one line
    above the footer's baseline, the end on it, both above 285 mm.
16. **Never a broken page because of the documents.** `documentsView` answers null on any failure (a
    font file the server cannot read, a layout that throws): the page renders without documents. The
    three faces are read with literal paths, so the build's file tracer puts them into every serverless
    function that needs them; `scripts/check-route-budgets.mjs` fails the build check when one of the
    six PDF routes or the two creator page routes lacks one in its trace (`.next/server/app/**.nft.json`).
17. **In Linkyo's iPhone app** ([0087](0087-app-mode.md)) a web view performs no `<a download>`. Every
    document link of the page carries `data-app-download`; inside the app a small listener
    (`AppDownloads`, loaded with Laufbahn's pages only) hands a press on one to the app (`appDownloadFrom`,
    our own address), which offers to save or share the PDF; should that fail, the web view opens the
    PDF itself. In a browser nothing changes. No app surface shows a Laufbahn page with its documents
    today (the dashboard's previews pass none); `app-mode-guard.test.ts` keeps every `<a download>` of
    the creator page marked.

## Not in v1 (follow-ups)

- **Not tagged** (no PDF/UA structure tree). Extraction follows reading order (head, contact,
  figures, sections, footer; letterhead, information block, subject, body), so screen readers and
  applicant tracking systems read it in order. Tagging is the next accessibility step.
- **No kerning**, and **proportional digits**. Fixed digit cells were built and dropped: set with TJ
  gaps, text extractors and applicant tracking systems read "2019" as "20 1 9". Geist's tabular
  figures (tnum) need glyph access, which comes with subsetting.
- **Full font embedding** (three faces). Subsetting (glyf/loca, composite glyphs) is v1.1, with solid
  tests.
- Dashboard previews show no PDF UI.
- A real project already at one of the six new reserved slugs would be shadowed by the document
  route: check the live database once it is free and list any such project here.
- The PDF answers still carry the `Link` header with `hreflang` alternates that next-intl adds to every
  localized route (`/ar/p/<slug>/cv` among them, which is a 404). Harmless for a `noindex` attachment;
  drop it for the document routes when the proxy is next touched.

## Integration with the page (Laufbahn round 6)

- One contract module: `offer.ts` (with `input.ts` and `printable.ts`) as above; the page's own
  stand-in was dropped at the merge. The page imports `DocumentsView`, `DocumentCard`, `splitFigure`,
  `targetFacts` and `PaperMiniature`; the fact labels are matched in the page's own language.
- Every place the page offers a document (the hero's Lebenslauf, the bar's pills and round button, the
  contents sheet, the Unterlagen cards with their miniatures and real page counts, "Beides in einer
  Datei", the letter's PDF pill, the Kontakt band's rows) is one `<a download>` to the routes above.
  Checked end to end on the fictional preview (`e2e/laufbahn-dossier-app.spec.ts`): every address the
  page links to answers 200 with a PDF 1.7 of the stated page count, `private, no-store` and `noindex`,
  and a press on the hero, a card and "Beides" is the browser's own download of that file.
- On a dark page the paper of a card stays white, as printed, and its marks keep the printed tones
  (ink, two greys, the accent) instead of the page's dark palette, which drew near-white on white.

## Measured (fictional applicant Jonas Brandt, de; Node 22)

| Document | Pages | Size | Warm render |
|---|---|---|---|
| Lebenslauf | 1 | 193 KB | 22 ms |
| Anschreiben | 1 | 193 KB | 23 ms |
| Bewerbung (letter + CV) | 2 | 195 KB | 24 ms |

Almost all of each file is the three embedded faces (about 60 KB each after Flate); the text
itself is a few kilobytes. `pdfinfo`: PDF 1.7, A4 (595.28 × 841.89 pt). `pdffonts`: Geist-Regular,
Geist-SemiBold and Geist-Bold, TrueType, WinAnsi, embedded, with ToUnicode. `pdftotext -layout` gives
umlauts, ß, „“, – and € intact, in reading order.

## Consequences

- Recruiters get a clean, consistent CV and letter in one tap, set from the page they just read.
- Every new block field that should print must pass through `input.ts` and the printable check.
- The miniature and the PDF cannot drift: both come from the same layout, and both ask the same photo
  candidate.

## Review fixes (2026-11-27)

The first review of round 6 found the CV's e-mail address broken over two lines, letters whose last
paragraph ran off the paper, a closing found inside a sentence, a stretched photo, titles after their
first rows in the text, figure values such as "SAP S/4HANA" split as numbers, a miniature that could
disagree with the PDF about a photo, 500s for `/de/p/constructor/cv`, a footer that could print over
itself, fonts missing from the serverless traces, and no way to download in the app. Points 9 to 12
and 14 to 17 above say what holds now; `splitFigure` takes a number only after whole words and a
space ("seit 2019", "Top 3"), so a digit inside a word ("SAP S/4HANA", "C1", "B2B", "Win11") stays a
word, on paper and on the page. Each fix has a test that fails without it.
