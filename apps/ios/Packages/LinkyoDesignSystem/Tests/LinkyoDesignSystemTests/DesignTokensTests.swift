import Testing
@testable import LinkyoDesignSystem

@Suite("Design tokens mirror the web tokens")
struct DesignTokensTests {
    @Test func spacingFollowsTheFourPointGrid() {
        let steps = [LinkyoTokens.Spacing.s0_5, LinkyoTokens.Spacing.s1, LinkyoTokens.Spacing.s2, LinkyoTokens.Spacing.s4, LinkyoTokens.Spacing.s32]
        #expect(steps == [2, 4, 8, 16, 128])
    }

    @Test func touchTargetsAreAtLeast44Points() {
        #expect(LinkyoTokens.Size.touchTarget == 44)
        #expect(LinkyoTokens.Size.controlLg >= LinkyoTokens.Size.touchTarget)
    }

    @Test func motionMatchesTheBrand() {
        #expect(LinkyoTokens.Motion.springResponse == 0.35)
        #expect(LinkyoTokens.Motion.springDamping == 0.85)
        #expect(LinkyoTokens.Motion.pressedScale == 0.98)
    }

    @Test func radiiMatchTheBrand() {
        #expect([LinkyoTokens.Radius.xs, LinkyoTokens.Radius.sm, LinkyoTokens.Radius.md, LinkyoTokens.Radius.lg, LinkyoTokens.Radius.xl] == [6, 10, 14, 20, 28])
    }
}
