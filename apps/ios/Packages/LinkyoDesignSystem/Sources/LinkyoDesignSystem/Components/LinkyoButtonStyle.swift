import SwiftUI

/// Buttons per brand §7: one primary action per screen, all states covered.
public struct LinkyoButtonStyle: ButtonStyle {
    public enum Variant: Sendable { case primary, secondary, ghost, destructive, destructiveSolid }
    public enum Size: Sendable { case sm, md, lg, xl }

    let variant: Variant
    let size: Size
    let isLoading: Bool

    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(_ variant: Variant = .secondary, size: Size = .lg, isLoading: Bool = false) {
        self.variant = variant
        self.size = size
        self.isLoading = isLoading
    }

    public func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .linkyoText(size == .xl || size == .lg ? .body : .small)
            .fontWeight(.medium)
            .opacity(isLoading ? 0 : 1)
            .overlay {
                if isLoading { ProgressView().tint(foreground) }
            }
            .padding(.horizontal, horizontalPadding)
            .frame(minHeight: height)
            .frame(minWidth: LinkyoTokens.Size.touchTarget)
            .foregroundStyle(foreground)
            .background(background(pressed: pressed), in: RoundedRectangle(cornerRadius: LinkyoTokens.Radius.md, style: .continuous))
            .overlay {
                if variant == .secondary {
                    RoundedRectangle(cornerRadius: LinkyoTokens.Radius.md, style: .continuous)
                        .strokeBorder(Color.Linkyo.lineStrong, lineWidth: LinkyoTokens.BorderWidth.hairline)
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: LinkyoTokens.Radius.md, style: .continuous))
            .scaleEffect(pressed && !reduceMotion ? LinkyoTokens.Motion.pressedScale : 1)
            .opacity(isEnabled ? 1 : LinkyoTokens.Opacity.disabled)
            .animation(.linkyoMicro, value: pressed)
            .allowsHitTesting(!isLoading)
            .accessibilityAddTraits(isLoading ? .updatesFrequently : [])
    }

    private var height: CGFloat {
        switch size {
        case .sm: LinkyoTokens.Size.controlSm
        case .md: LinkyoTokens.Size.touchTarget
        case .lg: LinkyoTokens.Size.controlLg
        case .xl: LinkyoTokens.Size.controlXl
        }
    }

    private var horizontalPadding: CGFloat {
        switch size {
        case .sm: LinkyoTokens.Spacing.s3
        case .md: LinkyoTokens.Spacing.s4
        case .lg: LinkyoTokens.Spacing.s5
        case .xl: LinkyoTokens.Spacing.s6
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary: Color.Linkyo.primaryFg
        case .secondary, .ghost: Color.Linkyo.fg
        case .destructive: Color.Linkyo.dangerStrong
        case .destructiveSolid: Color.Linkyo.dangerFillFg
        }
    }

    private func background(pressed: Bool) -> Color {
        switch variant {
        case .primary: pressed ? Color.Linkyo.primaryPressed : Color.Linkyo.primary
        case .secondary: pressed ? Color.Linkyo.pressed : Color.Linkyo.surface
        case .ghost: pressed ? Color.Linkyo.pressed : Color.clear
        case .destructive: pressed ? Color.Linkyo.dangerSubtle : Color.clear
        case .destructiveSolid: pressed ? Color.Linkyo.dangerStrong : Color.Linkyo.dangerFill
        }
    }
}

public extension ButtonStyle where Self == LinkyoButtonStyle {
    static func linkyo(_ variant: LinkyoButtonStyle.Variant = .secondary, size: LinkyoButtonStyle.Size = .lg, isLoading: Bool = false) -> LinkyoButtonStyle {
        LinkyoButtonStyle(variant, size: size, isLoading: isLoading)
    }
}
