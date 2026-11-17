# Linkyo for iOS

SwiftUI · iOS 17+ · Swift 6 (strict concurrency) · zero third-party UI libraries.

```bash
brew install xcodegen swiftlint
cd apps/ios
xcodegen generate          # creates Linkyo.xcodeproj (not committed)
open Linkyo.xcodeproj
```

Set your Apple Team ID in `project.yml` (`DEVELOPMENT_TEAM`) or in Xcode → Signing.

| Target | Contents (Phase 0) |
|---|---|
| `Linkyo` | Tab shell (Page · Add · Analytics · Profile), app icon (light/dark/tinted), privacy manifest, `linkyo://design` |
| `LinkyoShareExtension` | "Add to Linkyo" from any app (URLs, images, movies, text) — upload flow in Phase 2 |
| `LinkyoWidgets` | "Today" stats widget (small + Lock Screen) — live data in Phase 2 |
| `Packages/LinkyoDesignSystem` | Generated tokens (`Generated/`, from `@linkyo/tokens`), colors with dark + Increase Contrast, native `LoopSymbol`, button styles, icon button, badge, card, motion + haptics, **Design Gallery** (debug only), Swift Testing tests |

Rules: no raw colors, fonts or sizes — SwiftLint custom rules (`.swiftlint.yml`) fail the build; the same rules run on
Linux CI via `pnpm check:tokens`. Never edit `Generated/` — run `pnpm tokens` at the repo root.
