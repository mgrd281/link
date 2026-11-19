# 0041 — No underlines on links

**Context.** On the sign-up page the founder pointed at "Schon ein Konto? Anmelden": hovering the link drew a line
under it. The request: remove every line under a link, on the whole site, and write it down.

**Decision.**

- **No underline anywhere.** That covers every page:
  - the website, sign-up and sign-in, the code step;
  - the dashboard, the team console;
  - creator pages (footer links, privacy settings).

  It holds by default, on hover and on focus.
- **Links stand out by other means.**
  - Color (`text-link`, Linkyo Teal) and weight (`font-semibold`).
  - On hover the color changes: `hover:text-fg`, or `hover:text-creator-fg` on creator pages. Buttons that only had
    an underline fade slightly (`hover:opacity-secondary`).
  - Keyboard focus shows the focus ring, as everywhere.
- **Enforced.**
  - `linkyo/no-raw-design-values` rejects `underline`, `underline-offset-*` and `decoration-*` classes.
  - Stylelint allows `text-decoration` only as `none` or `line-through`. A struck-through old price stays, since
    it is not a link.

**Status.** Applied. Twelve files changed; lint tests for each form; e2e and axe on the changed screens.
