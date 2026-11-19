#if DEBUG
import SwiftUI

/// Hidden "Design Gallery" (debug builds only): every token, component and state on iOS.
/// Open it from Profile → long-press the version label, or the `linkyo://design` URL.
public struct DesignGallery: View {
    @State private var isLoading = false
    @State private var isVisible = true

    public init() {}

    private let semantic: [(String, Color)] = [
        ("canvas", Color.Linkyo.canvas),
        ("canvas-muted", Color.Linkyo.canvasMuted),
        ("surface", Color.Linkyo.surface),
        ("surface-elevated", Color.Linkyo.surfaceElevated),
        ("fg", Color.Linkyo.fg),
        ("fg-secondary", Color.Linkyo.fgSecondary),
        ("fg-tertiary", Color.Linkyo.fgTertiary),
        ("primary", Color.Linkyo.primary),
        ("link", Color.Linkyo.link),
        ("focus", Color.Linkyo.focus),
        ("selected", Color.Linkyo.selected),
        ("spark", Color.Linkyo.spark),
        ("success", Color.Linkyo.success),
        ("warning", Color.Linkyo.warning),
        ("danger", Color.Linkyo.danger),
        ("line-input", Color.Linkyo.lineInput),
    ]

    public var body: some View {
        NavigationStack {
            List {
                Section("Brand") {
                    HStack(spacing: LinkyoTokens.Spacing.s4) {
                        LinkyoSymbol()
                            .foregroundStyle(Color.Linkyo.primary)
                            .frame(width: LinkyoTokens.Size.avatarLg, height: LinkyoTokens.Size.avatarLg)
                        LinkyoSymbol()
                            .foregroundStyle(Color.Linkyo.fg)
                            .frame(width: LinkyoTokens.Size.iconLg, height: LinkyoTokens.Size.iconLg)
                        LinkyoSymbol()
                            .foregroundStyle(Color.Linkyo.fg)
                            .frame(width: LinkyoTokens.Size.iconSm, height: LinkyoTokens.Size.iconSm)
                    }
                }

                Section("Semantic colors") {
                    ForEach(semantic, id: \.0) { name, color in
                        HStack(spacing: LinkyoTokens.Spacing.s3) {
                            RoundedRectangle(cornerRadius: LinkyoTokens.Radius.xs, style: .continuous)
                                .fill(color)
                                .overlay {
                                    RoundedRectangle(cornerRadius: LinkyoTokens.Radius.xs, style: .continuous)
                                        .strokeBorder(Color.Linkyo.line, lineWidth: LinkyoTokens.BorderWidth.hairline)
                                }
                                .frame(width: LinkyoTokens.Size.controlMd, height: LinkyoTokens.Size.controlMd)
                            Text(name).linkyoText(.small)
                        }
                    }
                }

                Section("Typography (Dynamic Type)") {
                    ForEach(LinkyoTextStyle.allCases, id: \.self) { style in
                        Text("One link. Everything you create.")
                            .linkyoText(style)
                            .lineLimit(2)
                    }
                }

                Section("Spacing & radius") {
                    ForEach([LinkyoTokens.Spacing.s1, LinkyoTokens.Spacing.s2, LinkyoTokens.Spacing.s4, LinkyoTokens.Spacing.s8, LinkyoTokens.Spacing.s16], id: \.self) { value in
                        Capsule()
                            .fill(Color.Linkyo.primary)
                            .frame(width: value, height: LinkyoTokens.Spacing.s2)
                    }
                    HStack(spacing: LinkyoTokens.Spacing.s3) {
                        ForEach([LinkyoTokens.Radius.xs, LinkyoTokens.Radius.sm, LinkyoTokens.Radius.md, LinkyoTokens.Radius.lg, LinkyoTokens.Radius.xl], id: \.self) { radius in
                            RoundedRectangle(cornerRadius: radius, style: .continuous)
                                .strokeBorder(Color.Linkyo.lineStrong, lineWidth: LinkyoTokens.BorderWidth.hairline)
                                .frame(width: LinkyoTokens.Size.controlXl, height: LinkyoTokens.Size.controlXl)
                        }
                    }
                }

                Section("Buttons") {
                    Button("Publish") {}.buttonStyle(.linkyo(.primary))
                    Button("Copy link") {}.buttonStyle(.linkyo(.secondary))
                    Button("Add block") {}.buttonStyle(.linkyo(.ghost))
                    Button("Delete block") {}.buttonStyle(.linkyo(.destructive))
                    Button("Delete") {}.buttonStyle(.linkyo(.destructiveSolid))
                    Button("Disabled") {}.buttonStyle(.linkyo(.primary)).disabled(true)
                    Button("Publish") { isLoading.toggle() }.buttonStyle(.linkyo(.primary, isLoading: isLoading))
                    HStack {
                        LinkyoIconButton("Add block", systemImage: "plus") {}
                        LinkyoIconButton("Share", systemImage: "square.and.arrow.up") {}
                        LinkyoIconButton("More actions", systemImage: "ellipsis") {}
                    }
                }

                Section("Controls & badges") {
                    Toggle("Visible on your page", isOn: $isVisible)
                        .tint(Color.Linkyo.primary)
                    HStack {
                        LinkyoBadge("Draft")
                        LinkyoBadge("Published", tone: .success, showsDot: true)
                        LinkyoBadge("Live", tone: .spark, showsDot: true)
                    }
                    Text("Nothing here yet. Paste any link to start.")
                        .linkyoText(.body)
                        .foregroundStyle(Color.Linkyo.fgSecondary)
                        .linkyoCard()
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.Linkyo.canvas)
            .navigationTitle("Design Gallery")
        }
    }
}

#Preview("Light") { DesignGallery() }
#Preview("Dark") { DesignGallery().preferredColorScheme(.dark) }
#endif
