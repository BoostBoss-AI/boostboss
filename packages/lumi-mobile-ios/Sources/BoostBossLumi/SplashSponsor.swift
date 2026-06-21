//
//  SplashSponsor.swift
//  BoostBossLumi
//
//  Full-screen sponsor card shown once per cold launch. Module-level
//  flag prevents re-display if LumiSDK.configure is called multiple
//  times during the same app process. Auto-dismisses after 3 seconds
//  or on tap.
//

import Foundation
import UIKit

internal final class SplashSponsor {

    static let placement = "splash_sponsor"

    /// Module-level — true after the first show. Reset only when the
    /// process is killed and relaunched (cold start).
    private static var shownThisLaunch = false

    private let publisherId: String
    private let sessionId: String
    private var overlayWindow: UIWindow?
    private var dismissTimer: Timer?
    private var currentAd: Ad?

    init(publisherId: String, sessionId: String) {
        self.publisherId = publisherId
        self.sessionId   = sessionId
    }

    /// Show once per cold launch. Returns immediately if already shown.
    func showIfFirstLaunch() {
        if SplashSponsor.shownThisLaunch { return }
        SplashSponsor.shownThisLaunch = true

        Networking.fetchAd(
            publisherId: publisherId,
            placement:   SplashSponsor.placement,
            contextHint: nil,
            sessionId:   sessionId
        ) { [weak self] ad in
            guard let self = self, let ad = ad else { return }
            self.currentAd = ad
            self.present(ad)
        }
    }

    private func present(_ ad: Ad) {
        guard let scene = activeScene() else { return }
        let window = UIWindow(windowScene: scene)
        window.windowLevel = .alert + 1
        window.backgroundColor = .clear
        window.isHidden = false
        self.overlayWindow = window

        let vc = SplashViewController(ad: ad) { [weak self] tapped in
            self?.dismiss(opened: tapped)
        }
        window.rootViewController = vc

        Networking.fireImpression(ad)

        dismissTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: false) { [weak self] _ in
            self?.dismiss(opened: false)
        }
    }

    private func dismiss(opened: Bool) {
        dismissTimer?.invalidate()
        dismissTimer = nil

        if opened, let ad = currentAd, let urlStr = ad.clickUrl, let url = URL(string: urlStr) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }

        UIView.animate(withDuration: 0.25, animations: {
            self.overlayWindow?.alpha = 0
        }) { _ in
            self.overlayWindow?.isHidden = true
            self.overlayWindow = nil
        }
    }

    private func activeScene() -> UIWindowScene? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
    }
}

// MARK: - SplashViewController

private final class SplashViewController: UIViewController {
    private let ad: Ad
    private let onDismiss: (_ openedCTA: Bool) -> Void

    init(ad: Ad, onDismiss: @escaping (Bool) -> Void) {
        self.ad = ad
        self.onDismiss = onDismiss
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
    }
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 1.0, green: 0.18, blue: 0.555, alpha: 1) // BB pink

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 14
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        let imageView = UIImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFit
        imageView.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        imageView.layer.cornerRadius = 20
        imageView.widthAnchor.constraint(equalToConstant: 120).isActive = true
        imageView.heightAnchor.constraint(equalToConstant: 120).isActive = true
        stack.addArrangedSubview(imageView)
        if let urlStr = ad.imageUrl {
            Networking.fetchImage(urlString: urlStr) { img in
                imageView.image = img
            }
        }

        let brandLabel = UILabel()
        brandLabel.text = ad.brand ?? ad.headline ?? "Sponsored"
        brandLabel.font = .systemFont(ofSize: 24, weight: .bold)
        brandLabel.textColor = .white
        brandLabel.numberOfLines = 1
        stack.addArrangedSubview(brandLabel)

        let taglineLabel = UILabel()
        taglineLabel.text = ad.body ?? ""
        taglineLabel.font = .systemFont(ofSize: 16)
        taglineLabel.textColor = .white
        taglineLabel.textAlignment = .center
        taglineLabel.numberOfLines = 2
        stack.addArrangedSubview(taglineLabel)

        let hint = UILabel()
        hint.text = "Tap anywhere to continue"
        hint.font = .systemFont(ofSize: 12)
        hint.textColor = UIColor.white.withAlphaComponent(0.75)
        view.addSubview(hint)
        hint.translatesAutoresizingMaskIntoConstraints = false

        let powered = UILabel()
        powered.text = "Powered by Boost Boss"
        powered.font = .systemFont(ofSize: 10)
        powered.textColor = UIColor.white.withAlphaComponent(0.6)
        view.addSubview(powered)
        powered.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -32),
            hint.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            hint.bottomAnchor.constraint(equalTo: powered.topAnchor, constant: -6),
            powered.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            powered.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
        ])

        let tap = UITapGestureRecognizer(target: self, action: #selector(tapped))
        view.addGestureRecognizer(tap)
    }

    @objc private func tapped() { onDismiss(true) }
}
