import SwiftUI

public struct LinkyoBadge: View {
    public enum Tone: Sendable { case neutral, selected, success, warning, danger, spark }

    let text: LocalizedStringKey
    let tone: Tone
    let showsDot: Bool

    public init(_ text: LocalizedStringKey, tone: Tone = .neutral, showsDot: Bool = false) {
        self.text = text
        self.tone = tone
        self.showsDot = showsDot
    }

    public var body: some View {
        HStack(spacing: LinkyoTokens.Spacing.s1) {
            if showsDot {
                Circle()
                    .fill(foreground)
                    .frame(width: LinkyoTokens.Size.dot, height: LinkyoTokens.Size.dot)
                    .accessibilityHidden(true)
            }
            Text(text)
                .linkyoText(.caption)
        }
        .padding(.horizontal, LinkyoTokens.Spacing.s2)
        .padding(.vertical, LinkyoTokens.Spacing.s0_5)
        .foregroundStyle(foreground)
        .background(background, in: Capsule())
    }

    private var foreground: Color {
        switch tone {
        case .neutral: Color.Linkyo.fgSecondary
        case .selected: Color.Linkyo.selectedFg
        case .success: Color.Linkyo.successStrong
        case .warning: Color.Linkyo.warningStrong
        case .danger: Color.Linkyo.dangerStrong
        case .spark: Color.Linkyo.sparkFg
        }
    }

    private var background: Color {
        switch tone {
        case .neutral: Color.Linkyo.canvasMuted
        case .selected: Color.Linkyo.selected
        case .success: Color.Linkyo.successSubtle
        case .warning: Color.Linkyo.warningSubtle
        case .danger: Color.Linkyo.dangerSubtle
        case .spark: Color.Linkyo.spark
        }
    }
}

public extension View {
    /// Card surface: `surface` fill, hairline border, radius lg, e1 elevation.
    func linkyoCard() -> some View {
        padding(LinkyoTokens.Spacing.s4)
            .background(Color.Linkyo.surface, in: RoundedRectangle(cornerRadius: LinkyoTokens.Radius.lg, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: LinkyoTokens.Radius.lg, style: .continuous)
                    .strokeBorder(Color.Linkyo.line, lineWidth: LinkyoTokens.BorderWidth.hairline)
            }
            .shadow(color: Color.black.opacity(LinkyoTokens.Elevation.e1.opacityLight), radius: LinkyoTokens.Elevation.e1.radius, y: LinkyoTokens.Elevation.e1.y)
    }
}
