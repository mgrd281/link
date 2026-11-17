// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "LinkyoDesignSystem",
    defaultLocalization: "en",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "LinkyoDesignSystem", targets: ["LinkyoDesignSystem"]),
    ],
    targets: [
        .target(
            name: "LinkyoDesignSystem",
            resources: [.process("Generated/Colors.xcassets")]
        ),
        .testTarget(
            name: "LinkyoDesignSystemTests",
            dependencies: ["LinkyoDesignSystem"]
        ),
    ]
)
