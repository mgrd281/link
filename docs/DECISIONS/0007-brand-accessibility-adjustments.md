# 0007 — Brand color roles adjusted for WCAG 2.2 AA (needs founder sign-off)

The brand file is followed exactly for all anchors (`ink`, `paper`, `blue-500/600/100`, `lime-400`, success/warning/danger,
dark surfaces). Measured contrast forced these **role** decisions:

| Brand says | Measured | Decision |
|---|---|---|
| Dark mode: "Linkyo Blue shifts to #4D6BFF" | white on #4D6BFF = **4.32:1** (fails AA for button labels) | Filled primary buttons stay **#3355FF** in dark mode (5.41:1). #4D6BFF is used for focus rings and icons on dark. |
| (implied) blue links on dark surfaces | #4D6BFF on #1C1C1F = 3.94:1 | New step **`blue-350` #5F80FF** for link text in dark mode (≥ 4.87:1 on all dark surfaces). |
| success #12B76A, warning #F79009 | white on them = 2.6 / 2.4:1 | Used for dots/icons/fills with **ink** labels; text uses generated `*-strong` steps (≥ 5:1). |
| danger #F04438 "fill in confirmation dialog" | white on #F04438 = 3.76:1 | Destructive fill uses **danger-600 #D6332A** (4.81:1). |
| inputs: "1px border" | ink 9 % border = 1.2:1 | Form controls use `line-input` (≥ 3:1, WCAG 1.4.11); decorative borders keep 9 %. |
| secondary text 64 % | 5.7–7.7:1 ✓ | Kept. Placeholders use 58 % (≥ 4.6:1). |

Also derived (no brand value given): gray 25/75 steps, a cool `night` scale matching §4.2's dark surfaces, dark-mode
shadows, `selected-fg`, `hover-inverse`. All verified in `packages/tokens/test/tokens.test.ts`.
