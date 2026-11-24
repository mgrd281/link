# draft — Creator pages open calm: a one-line privacy bar, the owner's preview without it, solid social glyphs, names that fit in Arabic

**Status.** Draft (Stage 2, WP2.5, 2026-11-24). The integrator numbers it. The privacy bar's wording goes
to the founder and the lawyer (F2) for confirmation; it is reversible and reuses the existing strings.

**Context.** The audit (plan §2.5, §2.3) found four things that make a creator page look unfinished on a
phone. The privacy notice covered 35–40 % of the first screen on every page with a player, although
players already load only on a tap (C-05). The same visitor notice covered the owner's own preview in
the dashboard (D-17). Social rows mixed filled brand logos with an outline globe and envelope (C-07).
A long Latin name ran past the column in the Arabic Nocturne hero ("Ardmwtzzmol", C-04), and the
Werkbogen bar cut both the name and the action short on a phone ("Shooting anfr…", C-08).

**Decision.**

1. **A one-line privacy bar (C-05).** The notice is one control row (`h-control-lg`) across the bottom,
   on the creator's surface with a hairline on top, in their colours. The choices are the same as
   before and at the same level: "Externe Inhalte erlauben" (filled with the accent), "Nur notwendige"
   (outlined) and "Einstellungen". On phones "Einstellungen" is the shield icon, named by the word;
   from 640 px the word shows, and from 840 px the title "Keine Tracking-Cookies" opens the row.
   The full sentence ("Diese Seite speichert nichts über dich. Videos von {providers} laden erst, wenn
   du es erlaubst.") moved behind "Einstellungen", together with the switch per category; screen
   readers hear it with the main choice (its description). No string was added or changed. A label
   that does not fit (a narrow phone, a wide face) wraps inside its button; the bar never grows. A
   spacer after the footer keeps the page's last line clear of the bar, and while the Linkyo bar of
   an example page is shown the privacy bar sits right above it. Players stay click-to-load, the
   choice is stored as before (`linkyo.privacy.v1`), the footer link still reopens the notice, and
   focus follows a keyboard user into the settings and back.
   - **For F2:** on phones the first layer no longer names the companies (YouTube, TikTok …) visibly;
     they are named one tap away and in the main button's description. Reject stays as easy as
     accept (one tap, same row). If F2 wants the companies visible on the first layer, the sentence
     has to become shorter, which is new wording.
2. **The owner's preview without the visitor notice (D-17).** `OwnerPreview` (a context in
   `shared/privacy.tsx`) wraps the renderer in the dashboard's phone preview and on "View my page".
   Inside it the notice does not appear by itself; the footer's "Cookie-Einstellungen" still opens it
   (no dead button), and the owner's floating bar steps aside only while it is really on screen
   (`usePrivacyNoticeOpen` now counts notices on screen). On "View my page" (`<OwnerPreview bar>`) the
   page ends with room for the owner's floating bar, so the footer (and that link) can be scrolled
   clear of it even on a short page. Visitors see it exactly as before. The team console's creator
   preview uses the same phone preview, so it is free of the notice too.
3. **Solid globe and envelope (C-07).** `GLOBE_GLYPH` and `MAIL_GLYPH`, drawn for Linkyo on the 24 × 24
   grid next to `LINKEDIN_GLYPH`, are the `website` and `email` platform glyphs and the fallback for
   anything unknown. Every platform glyph is now one filled path; the names ("Website", "Email") are
   unchanged. This reaches every surface that draws platform glyphs (creator pages including
   Laufbahn's social row, the editor, the welcome flow, the AI input).
4. **Names that fit in Arabic (C-04).** On Arabic pages the name's size estimate counts Latin letters
   by class (narrow, slim, wide, capitals, the rest), measured on bold system sans faces and rounded
   up, because the Arabic face has no Latin letters and the fallback is wider than the Arabic
   average. Arabic letters keep the Arabic average, so Arabic names keep their size; Latin pages are
   unchanged. As a last resort the heading breaks a word that cannot fit at its smallest size
   (`overflow-wrap: anywhere`) instead of running past the column. Tested with 14-letter Latin and
   Arabic names in all 14 templates in `/ar/app/preview` at 360 px and the project's width.
5. **The compact bar keeps the name and the action (C-08).** Below 640 px (container width) the bar's
   action is the action's icon (the owner's choice, else what its address says) in a filled 44 px
   target, named by its whole label; from 640 px it is the label. Laufbahn's solid bar is unchanged.

**Consequences.**
- WP2.3's Arabic companion faces put the template's Latin face first in the Arabic stack; Latin names
  then render narrower than the estimate assumes (smaller, never clipped). The name-fit test is re-run
  at S2.Z; `LATIN_ON_ARABIC` and `GLYPH_WIDTH.arabic` in `poster/hero.tsx` are the knobs.
- `e2e/app.spec.ts` "View my page …" now opens the notice from the footer first (D-17 changed what
  it guards on purpose).
