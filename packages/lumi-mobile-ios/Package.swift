// swift-tools-version:5.5
// Lumi for Mobile App — native iOS SDK, Swift Package Manager manifest.
//
// Publishers using SPM add this URL in Xcode → File → Add Packages:
//   https://github.com/BoostBoss-AI/boostboss
// then select the BoostBossLumi target.

import PackageDescription

let package = Package(
    name: "BoostBossLumi",
    platforms: [
        .iOS(.v14)
    ],
    products: [
        .library(
            name: "BoostBossLumi",
            targets: ["BoostBossLumi"]
        ),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "BoostBossLumi",
            dependencies: [],
            path: "Sources/BoostBossLumi"
        ),
        .testTarget(
            name: "BoostBossLumiTests",
            dependencies: ["BoostBossLumi"],
            path: "Tests/BoostBossLumiTests"
        ),
    ]
)
