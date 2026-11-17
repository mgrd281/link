import SwiftUI

/// 44 pt icon button (brand §7). The label is required: VoiceOver reads it.
public struct LinkyoIconButton: View {
    let systemImage: String
    let label: LocalizedStringKey
    let action: () -> Void

    public init(_ label: LocalizedStringKey, systemImage: String, action: @escaping () -> Void) {
        self.label = label
        self.systemImage = systemImage
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .symbolRenderingMode(.hierarchical)
                .imageScale(.medium)
                .frame(width: LinkyoTokens.Size.touchTarget, height: LinkyoTokens.Size.touchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color.Linkyo.fg)
        .accessibilityLabel(Text(label))
    }
}
