# 0004 — iOS project structure

**Context.** Phase 0 runs on Linux (no Xcode). Hand-written `.pbxproj` files are fragile and merge-hostile.

**Decision.** `apps/ios/project.yml` (XcodeGen) generates `Linkyo.xcodeproj` (git-ignored): app, Share Extension and
Widgets targets, App Group, Sign in with Apple entitlement, SwiftLint build phase. Shared UI lives in the local SPM
package `Packages/LinkyoDesignSystem` (generated tokens + components + debug Design Gallery + Swift Testing tests).
Swift 6 language mode, strict concurrency, iOS 17 minimum (Observation, SwiftData).
CI: `ios.yml` on `macos-15` (path-filtered, macOS minutes cost ~10×); release builds move to Xcode Cloud (25 h/month
included) in Phase 2.

**Status of verification.** All Swift files parse with Swift 6.4.2 on Linux and `DesignTokens.swift` type-checks;
SwiftUI code compiles only on macOS → first full build happens in `ios.yml` / on the founder's Mac.
