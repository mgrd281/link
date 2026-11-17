import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public extension Animation {
    /// Brand spring (response 0.35, damping 0.85).
    static var linkyoSpring: Animation {
        .spring(response: LinkyoTokens.Motion.springResponse, dampingFraction: LinkyoTokens.Motion.springDamping)
    }

    /// 120 ms micro interaction.
    static var linkyoMicro: Animation { .easeOut(duration: LinkyoTokens.Motion.micro) }

    /// 320 ms sheets and pages.
    static var linkyoSlow: Animation { .easeInOut(duration: LinkyoTokens.Motion.slow) }
}

/// Haptics per brand §9: selection on reorder, success on publish, warning on destructive confirm.
/// Never on every tap.
@MainActor
public enum LinkyoHaptics {
    public static func reorder() {
        #if canImport(UIKit)
        UISelectionFeedbackGenerator().selectionChanged()
        #endif
    }

    public static func published() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }

    public static func destructiveConfirm() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        #endif
    }
}
