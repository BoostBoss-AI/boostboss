#
# BoostBossLumi.podspec
# Lumi for Mobile App — native iOS SDK by Boost Boss.
#
# Publish flow (post-implementation):
#   $ pod lib lint --allow-warnings
#   $ pod trunk push BoostBossLumi.podspec --allow-warnings
#

Pod::Spec.new do |s|
  s.name             = 'BoostBossLumi'
  s.version          = '0.1.0-alpha.1'
  s.summary          = 'Lumi for Mobile App — native iOS SDK.'

  s.description      = <<-DESC
    Native iOS SDK for the Boost Boss ad network. Auto-mounts the BottomBanner
    placement in your app's key window, fires the publisher handshake on launch
    so your verify badge flips to Connected, and integrates SKAdNetwork for
    install attribution. The React Native package (@boostbossai/lumi-mobile)
    links this SDK at build time — RN publishers get the same attribution stack
    as native publishers.
  DESC

  s.homepage         = 'https://boostboss.ai/publish/mobile'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'Boost Boss' => 'support@boostboss.ai' }
  s.source           = {
    :git => 'https://github.com/BoostBoss-AI/boostboss.git',
    :tag => "ios-#{s.version}"
  }
  s.documentation_url = 'https://boostboss.ai/docs/mobile'

  s.ios.deployment_target = '14.0'
  s.swift_versions        = ['5.5', '5.6', '5.7', '5.8', '5.9']

  s.source_files = 'Sources/BoostBossLumi/**/*.{swift,h,m}'
  s.frameworks   = 'UIKit', 'Foundation', 'StoreKit'  # StoreKit for SKAdNetwork

  s.weak_frameworks = 'AdServices'  # iOS 14.3+ install-referrer-style API

  # SKAdNetwork ID — placeholder until BB registers with Apple and gets one.
  # Apple's SKAdNetwork IDs are 16-character hex strings ending in
  # ".skadnetwork", e.g. "su67r6k2v3.skadnetwork". After registration,
  # publishers also need to add this entry to their Info.plist via the
  # install CLI's auto-patch.
  s.info_plist = {
    'NSUserTrackingUsageDescription' =>
      'Boost Boss uses your advertising identifier to deliver more relevant ads. ' \
      'You can decline and still see ads.',
  }
end
