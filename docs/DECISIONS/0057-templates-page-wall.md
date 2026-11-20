# 0057 — The templates page shows the sign-in screen's wall, standing still

**Context.** The founder asked for the cards on the templates page (`/templates`) to "stand still and
be the same as on the sign-in page", and for the whole section to be improved, phone first, with the
feel of a native iPhone app.

Until now:

- **The sign-in and sign-up screens** showed a tilted wall of real page captures beside the form. It
  drifts once, then rests.
- **The templates page** had its own wall:
  - small portrait tiles (photo and name only) in three drifting columns;
  - on phones, a row of large tiles to swipe, which pushed the gallery a screen further down.

**Decision.**

- **One wall for both.**
  - `marketing/page-wall.tsx` (`PageWall`) is the sign-in wall, extracted unchanged.
  - The sign-in screens use it `moving`, so they look and behave as before.
  - The templates page uses it **standing still**:
    - on wide screens, a framed panel beside the intro;
    - on phones, a full-bleed band (16:9) of the same small tilted cards.
  - The old `gallery-showcase.tsx` is gone.
  - The wall shows whole pages (photo, name, numbers, buttons), so it says what a template is better
    than a portrait.
- **Phone hero.** The three numbers (examples, designs, languages) sit in one compact row, icon beside
  number. The gallery starts sooner.
- **Gallery cards.** A press dips the card on the iOS spring (ADR 0056), a tap gives a haptic tick
  where supported, and hovering still lifts it.
- **Preview on phones.** It slides up like an iOS full-screen sheet on the spring and slides away
  when closed. Pulling its top bar down closes it, the same gesture as every sheet. Wide screens keep
  the centred preview.

**Kept as is:** search, language and category filters, the sticky filter band flush under the header,
"show 12 more", the preview with "Use this template".

**Not done:**

- No shadows: the brief named "subtle shadows", but Linkyo is flat (ADR 0037).
- No glass bars: bars stay on a solid background.
- No new animation library: CSS spring tokens cover the motion.

**Consequences.** The e2e test of the old drifting showcase now checks that the templates page shows
the sign-in screen's wall, standing still, with no horizontal overflow.

**Follow-up (the same day): search and filters, a preview that reads itself.** The founder found the
search area busy: frames inside a frame. It also lacked a way to see a whole page without scrolling.

- **One framed field, calm chips.**
  - The bordered capsule around the search field and the chips is gone.
  - The search field is the one framed element, with the strong field border as fields have.
  - The category chips are a step in the fill: the chosen one is dark, each dips on the spring when
    pressed.
  - The sticky band stays solid and flush under the header.
- **The preview reads itself.** Once a previewed page has loaded, it scrolls down by itself, top to
  bottom, once, at a calm pace (about half a minute for a long page). It is the page's own scroll, so
  its sections rise in as they would for a visitor.
  - **The visitor takes over:** a wheel turn, a touch, a click or a key in the page stops it for good,
    and the mouse resting on the page holds it.
  - **Reduced motion:** it never starts. This meets WCAG 2.2.2: a single pass, stopped by any
    interaction.
  - **Nothing on top inside the preview frame** (`data-linkyo-preview`):
    - The page's privacy notice stays away there. Nothing external loads in the preview, and each
      video still asks when tapped.
    - The visitor sign-up bar stays away too; the panel beside the frame already offers "Use this
      template".
    - On the page itself both show as always.

