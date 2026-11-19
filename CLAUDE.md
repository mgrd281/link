# Linkyo — rules for every change

Linkyo is a link-in-bio product. Code lives in:
- `apps/web`: Next.js, next-intl in German (default), English and Arabic (RTL);
- `packages/ui`: shared components;
- `packages/tokens`: design tokens;
- `apps/ios`: SwiftUI design system.

The project skills in `.claude/skills/linkyo-*` hold the detailed how-tos.

## Design: always

- **No shadows. Ever.** Linkyo is flat ([ADR 0037](docs/DECISIONS/0037-no-shadows.md)).
  - That means no `shadow-*`, `drop-shadow-*`, `inset-shadow-*` or `text-shadow-*` classes, no `box-shadow` /
    `boxShadow`, no `drop-shadow()` filters and no canvas shadows. This holds on every screen, creator page, share
    picture and iOS view.
  - A surface stands apart with one of three things:
    - a hairline border (`border border-line`);
    - a stronger border for fields and secondary buttons (`border-line-strong`);
    - a step in the fill (a `bg-surface` tile on `bg-canvas-muted`).
  - Lint fails on any shadow.
- **Tokens only.** No raw colors, sizes, fonts, z-index or durations in app code. Every value comes from
  `packages/tokens/tokens.json` (skill `linkyo-design-tokens`).
- **Brand:** Linkyo Teal (`primary`, #00454C) on white pages and cards; teal 50 for soft fills.
- **No underlines. Ever.** Links never get a line under them: not by default, not on hover, not on focus
  ([ADR 0041](docs/DECISIONS/0041-no-underlines.md)). A link is marked by color (`text-link`) and weight
  (`font-semibold`), and changes color on hover (`hover:text-fg`; creator pages `hover:text-creator-fg`).
  Keyboard focus shows the focus ring. Lint fails on `underline`, `underline-offset-*` and `decoration-*`.
  A struck-through old price (`line-through`) is fine.
- **Sticky bars sit flush under the header** (`top-16`; the header is `h-16`) on a solid background. No gap for content
  to show through.
- **Every screen:**
  - works in de, en and ar (Arabic mirrored);
  - is designed phone first;
  - meets WCAG 2.2 AA;
  - honors `prefers-reduced-motion`.
- **Original work only:** no code, text, images, logos or trademarks copied from competitors.

## Privacy

- Creator pages set no cookies and load nothing from third parties by default (GDPR).
- Secrets never reach the client.

## Before saying a change is done

Follow the `linkyo-qa-release` skill:
- lint: `pnpm lint`, which includes the token guard;
- types: `pnpm typecheck`;
- unit tests: `pnpm test`;
- a production build;
- Playwright e2e with axe;
- screenshots on phone and desktop.

Then commit with a conventional message and push.
