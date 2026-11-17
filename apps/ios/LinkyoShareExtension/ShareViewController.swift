import LinkyoDesignSystem
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Share Extension: "Add to Linkyo" from Safari, YouTube, Spotify, Photos… (Phase 2 completes the
/// upload + position picker). Phase 0 wires the target, activation rules and brand UI.
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let root = ShareRootView { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        }
        let host = UIHostingController(rootView: root)
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
    }
}

private struct ShareRootView: View {
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: LinkyoTokens.Spacing.s6) {
            LoopSymbol()
                .foregroundStyle(Color.Linkyo.primary)
                .frame(width: LinkyoTokens.Size.avatarLg, height: LinkyoTokens.Size.avatarLg)
            Text("Add to Linkyo").linkyoText(.h2)
            Button("Add link", action: onDone)
                .buttonStyle(.linkyo(.primary, size: .xl))
        }
        .padding(LinkyoTokens.Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.Linkyo.canvas)
    }
}
