import SwiftUI

/// Product UI text uses SF Pro with Dynamic Type (brand §5). Sizes come from the token scale and
/// scale relative to the matching system text style, so AX5 still works.
public enum LinkyoTextStyle: CaseIterable, Sendable {
    case display, h1, h2, h3, bodyLarge, body, small, caption

    var token: LinkyoTokens.TextStyle {
        switch self {
        case .display: LinkyoTokens.Typography.display
        case .h1: LinkyoTokens.Typography.h1
        case .h2: LinkyoTokens.Typography.h2
        case .h3: LinkyoTokens.Typography.h3
        case .bodyLarge: LinkyoTokens.Typography.bodyLg
        case .body: LinkyoTokens.Typography.body
        case .small: LinkyoTokens.Typography.small
        case .caption: LinkyoTokens.Typography.caption
        }
    }

    var relativeTo: Font.TextStyle {
        switch self {
        case .display: .largeTitle
        case .h1: .title
        case .h2: .title2
        case .h3: .title3
        case .bodyLarge, .body: .body
        case .small: .subheadline
        case .caption: .caption
        }
    }

    var weight: Font.Weight {
        switch token.weight {
        case ..<450: .regular
        case ..<550: .medium
        case ..<650: .semibold
        case ..<750: .bold
        default: .heavy
        }
    }
}

public extension Font {
    /// SF Pro at a Linkyo token size, scaling with Dynamic Type.
    static func linkyo(_ style: LinkyoTextStyle) -> Font {
        .system(style.relativeTo, design: .default, weight: style.weight)
    }
}

public extension View {
    /// Applies font, tracking and line spacing from the token scale.
    func linkyoText(_ style: LinkyoTextStyle) -> some View {
        modifier(LinkyoTextModifier(style: style))
    }
}

struct LinkyoTextModifier: ViewModifier {
    let style: LinkyoTextStyle
    @ScaledMetric private var size: CGFloat

    init(style: LinkyoTextStyle) {
        self.style = style
        _size = ScaledMetric(wrappedValue: style.token.size, relativeTo: style.relativeTo)
    }

    func body(content: Content) -> some View {
        content
            .font(.system(size: size, weight: style.weight))
            .tracking(style.token.tracking * size)
            .lineSpacing(max(0, (style.token.lineHeight - 1.2) * size))
    }
}
