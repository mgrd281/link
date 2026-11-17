# 0003 — Token guard (no raw design values)

**Decision.** The build fails if a raw hex color, color function, px/pt length, font family, Tailwind arbitrary value
(`w-[13px]`, `bg-[#fff]`), bare numeric utility (`z-50`, `opacity-40`, `duration-300`, `border-2`), color-opacity
modifier (`bg-white/10`), numeric style value, or motion duration/easing literal appears outside `@linkyo/tokens`.
- **TS/TSX:** ESLint rule `linkyo/no-raw-design-values` (AST-based; knows `href="#id"`, SVG geometry inside a viewBox,
  motion configs vs. data like `video.duration`). `better-tailwindcss/no-unknown-classes` rejects classes the token theme
  doesn't generate.
- **CSS:** Stylelint config (`color-no-hex`, px ban, `font-family` must be `var(--…)`, sized properties must use tokens).
- **Swift:** SwiftLint custom rules in `apps/ios/.swiftlint.yml` (raw `Color(red:)`, `.font(.system(size:))`, numeric
  `.padding`/`spacing:`/`.frame`/`cornerRadius`). The repo CLI (`pnpm check:tokens`) applies the same regexes on Linux CI.
- **Coverage:** the CLI fails if any package with TS/CSS doesn't run ESLint/Stylelint in `lint`.
Tests (62) prove each violation fails. Escape hatch: `eslint-disable-next-line … -- reason` (unused disables are errors).
