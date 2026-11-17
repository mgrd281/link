import LinkyoDesignSystem
import SwiftUI

/// Phase 0 shell: the tab structure from the spec (Page · Add · Analytics · Profile).
/// Real screens arrive in Phase 2; the debug Design Gallery is reachable from Profile.
struct RootView: View {
    enum Tab: Hashable { case page, add, analytics, profile }
    @State private var tab: Tab = .page
    @State private var showsDesignGallery = false

    var body: some View {
        TabView(selection: $tab) {
            placeholder("Your page", systemImage: "iphone")
                .tabItem { Label("Page", systemImage: "iphone") }
                .tag(Tab.page)
            placeholder("Paste a link, pick photos or scan…", systemImage: "plus.circle.fill")
                .tabItem { Label("Add", systemImage: "plus.circle.fill") }
                .tag(Tab.add)
            placeholder("Views, clicks, top links", systemImage: "chart.bar")
                .tabItem { Label("Analytics", systemImage: "chart.bar") }
                .tag(Tab.analytics)
            profile
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                .tag(Tab.profile)
        }
        .onOpenURL { url in
            #if DEBUG
            if url.host() == "design" { showsDesignGallery = true }
            #endif
        }
        #if DEBUG
        .sheet(isPresented: $showsDesignGallery) { DesignGallery() }
        #endif
    }

    private func placeholder(_ title: LocalizedStringKey, systemImage: String) -> some View {
        ContentUnavailableView {
            Label {
                Text(title).linkyoText(.h3)
            } icon: {
                Image(systemName: systemImage).symbolRenderingMode(.hierarchical)
            }
        } description: {
            Text("Coming in Phase 2.").linkyoText(.small)
        }
        .background(Color.Linkyo.canvas)
    }

    private var profile: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: LinkyoTokens.Spacing.s3) {
                        LoopSymbol()
                            .foregroundStyle(Color.Linkyo.primary)
                            .frame(width: LinkyoTokens.Size.avatarMd, height: LinkyoTokens.Size.avatarMd)
                        Text("Linkyo").linkyoText(.h3)
                    }
                }
                #if DEBUG
                Section("Developer") {
                    Button("Design Gallery") { showsDesignGallery = true }
                }
                #endif
            }
            .navigationTitle("Profile")
        }
    }
}

#Preview { RootView() }
