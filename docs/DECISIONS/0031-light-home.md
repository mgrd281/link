# 0031 — A light marketing home, from the founder's reference recording

**Context.** The founder sent a screen recording of another creator platform's homepage and
asked for "the same design, colors and animation". Our home was a dark studio hero with violet
glow (ADR 0013). The product rules still apply: it must be original, with no copied code, text,
images, logos or trademarks.

**Decision.** We adopt the design language, not the content:

- **Hero.**
  - On light canvas: a two-line headline with the second line in Linkyo Violet.
  - Plain pills, the lead, and the address field: grey field, black button.
  - Beside it, three of **our own example pages** take turns in front (`mk-stack`):
    - each shows its address above and one number from its page below;
    - pausable (WCAG 2.2.2) and paused on hover;
    - the resting fan is the still layout for reduced motion.
- **Trust cards.** Three soft grey cards with an icon: hosted in Frankfurt, no cookies, free
  for good.
- **Example strip.**
  - Captures of 14 example pages (`src/assets/marketing/examples`, taken from our product)
    drift by and grow to full size as the strip scrolls in (`mk-zoom`).
  - Each opens the real example page; pausable.
- **Features.** "Everything you need. On one page." is set as four rows with tinted panels
  (new tokens `tint-rose`, `tint-lavender`, `tint-mint`, `tint-lime`, each with a dark-mode
  value and contrast-tested):
  - fanned page cards that spread as the panel scrolls in (`mk-panel` + `mk-fan`);
  - the live paste demo;
  - cookie-free analytics with growing bars;
  - the share kit (story picture and link preview popping in, `mk-pop`).
- **Pricing and FAQ** in the same light style. The Pro card sits on lavender.
- **Final card.** "Get started. It's free." with the address field and the Pro features as
  chips.
- **Header and footer.**
  - The header is a flat bar with a quiet "log in" and one black action.
  - The theme switch moved to the footer.

**Colors.**

- From the reference we take white/warm paper, black type and actions, and pastel panels.
- We keep **Linkyo Violet** as the accent where the reference uses its own brand pink.
  Copying a competitor's signature color and layout together would read as their brand, not
  ours. Changing the accent would be one class on the headline.

**Consequences.**

- All motion is CSS with motion tokens:
  - scroll-driven where supported, the final state where not;
  - nothing moves for reduced motion.
- No third-party requests and no cookies on the home (E2E-tested).
- The dark-studio home (ADR 0013) is retired. Its scroll story and pricing texts remain in the
  messages for reuse.
