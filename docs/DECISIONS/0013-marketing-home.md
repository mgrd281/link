# 0013 — Marketing home (linkyo.app) and its motion system

**Context.** The founder asked for a homepage like onfyre.app/de, "but better — very modern, animation 10/10".
We studied the public page for structure only (hero with handle claim, fanned phones, three promises, creator strip,
feature rows, pricing card, footer). Nothing is copied: Linkyo copy, brand, imagery (our own product captures) and code.

**Decision.**

- **Route:** the marketing home replaces the Phase 0 hub at `/{de,en,ar}`; the design system, directions and editor
  are linked from the footer ("Resources").
- **Sections:** floating pill nav (popover menu on phones, zero JS) → dark studio hero with soft Linkyo-blue glow
  (brand §10) → three promises as big numbers → template strip → scroll story → paste-a-link demo → cookie-free
  analytics → pricing → FAQ → final claim → footer.
- **Imagery:** real Linkyo creator pages (fictional sample creators) captured from the product at 2× and shown on
  phones; Arabic visitors see the Arabic sample creator.
- **Motion, one orchestrated moment + motion that responds:**
  - Hero entrance: headline lines rise and un-blur in sequence; three phones fan in; the centre phone crossfades
    through all five templates; the stage leans toward the mouse (pointer only, never touch).
  - Scroll story: the section's view timeline scrolls a full creator page inside a sticky phone while the active
    step's number lights up — text keeps full contrast (no dimming).
  - Template strip: endless marquee with a pause button (WCAG 2.2.2), pauses on hover/focus.
  - The EU figure counts up as it enters; analytics bars grow on scroll; FAQ and paste demo animate on action.
  - All CSS (`@keyframes` + `animation-timeline`), durations from tokens (`reveal`, `ambient`, `showcase`,
    `marquee`), `prefers-reduced-motion` stops everything; browsers without scroll timelines show the final state.
- **Honesty rules:** sample analytics are labelled "Sample data"; the handle claim validates with the real username
  schema but does not pretend to reserve names before accounts exist; Pro shows features, no price; legal links are
  listed as text until the Phase 1 legal pages exist.
- **New tokens:** `text.display-2xl` (104 px, hero on ≥ 2xl), `motion.duration.{reveal, ambient, showcase, marquee}`.

**Results (this machine, Lighthouse 13):** desktop 100/100/100; mobile performance 89 (de) / 76 (ar), accessibility
100, best practices 100, CLS 0; 0 third-party requests and 0 cookies (E2E-asserted). Mobile performance is bounded by
the App Router JavaScript, same as ADR 0008.

**Status.** Proposed — waiting for the founder's review.
