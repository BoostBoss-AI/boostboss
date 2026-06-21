//
//  BottomBanner.swift
//  BoostBossLumi
//
//  Auto-mounted at app launch. Attaches a sponsored card to the key
//  window's bottom safe area. Tap → click URL. Dismiss → removes the
//  view but keeps the slot (next ad request reattaches).
//

import Foundation
import UIKit

internal final class BottomBanner: UIView {

    static let placement = "bottom_banner"

    private let publisherId: String
    private let sessionId: String
    private weak var hostWindow: UIWindow?

    private let cardView      = UIView()
    private let imageView     = UIImageView()
    private let headlineLabel = UILabel()
    private let bodyLabel     = UILabel()
    private let ctaButton     = UIButton(type: .system)
    private let dismissButton = UIButton(type: .system)
    private let sponsoredLabel = UILabel()

    private var currentAd: Ad?
    private var impressionFired = false

    init(publisherId: String, sessionId: String) {
        self.publisherId = publisherId
        self.sessionId   = sessionId
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear
        buildLayout()
    }

    required init?(coder: NSCoder) { fatalError("BottomBanner is code-only") }

    // MARK: - Mount

    /// Attach to the application's key window pinned to the bottom safe
    /// area. Idempotent — calling twice is a no-op.
    func attach(to window: UIWindow) {
        guard self.superview == nil else { return }
        self.hostWindow = window
        window.addSubview(self)
        NSLayoutConstraint.activate([
            self.leadingAnchor.constraint(equalTo: window.leadingAnchor, constant: 12),
            self.trailingAnchor.constraint(equalTo: window.trailingAnchor, constant: -12),
            self.bottomAnchor.constraint(equalTo: window.safeAreaLayoutGuide.bottomAnchor, constant: -8),
            self.heightAnchor.constraint(equalToConstant: 84),
        ])
        loadAd()
    }

    func detach() {
        removeFromSuperview()
        hostWindow = nil
    }

    // MARK: - Network

    private func loadAd() {
        Networking.fetchAd(
            publisherId: publisherId,
            placement:   BottomBanner.placement,
            contextHint: nil,
            sessionId:   sessionId
        ) { [weak self] ad in
            guard let self = self else { return }
            guard let ad = ad else {
                self.isHidden = true
                return
            }
            self.currentAd = ad
            self.render(ad)
        }
    }

    private func render(_ ad: Ad) {
        headlineLabel.text = ad.headline ?? ad.brand ?? ""
        bodyLabel.text     = ad.body ?? ""
        ctaButton.setTitle((ad.ctaLabel ?? "Learn more").uppercased(), for: .normal)
        if let urlStr = ad.imageUrl {
            Networking.fetchImage(urlString: urlStr) { [weak self] img in
                self?.imageView.image = img
            }
        }
        self.isHidden = false
        // Fire impression once on first render. SDK doesn't gate on
        // viewability — the banner is always pinned to the safe area.
        if !impressionFired {
            impressionFired = true
            Networking.fireImpression(ad)
        }
    }

    // MARK: - Layout

    private func buildLayout() {
        // Card background
        cardView.translatesAutoresizingMaskIntoConstraints = false
        cardView.backgroundColor = .white
        cardView.layer.cornerRadius = 12
        cardView.layer.borderColor  = UIColor(white: 0, alpha: 0.08).cgColor
        cardView.layer.borderWidth  = 1
        cardView.layer.shadowColor  = UIColor.black.cgColor
        cardView.layer.shadowOpacity = 0.06
        cardView.layer.shadowRadius  = 8
        cardView.layer.shadowOffset  = CGSize(width: 0, height: 2)
        addSubview(cardView)

        // Image
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 8
        imageView.backgroundColor = UIColor(white: 0.94, alpha: 1)
        cardView.addSubview(imageView)

        // Sponsored micro-label
        sponsoredLabel.translatesAutoresizingMaskIntoConstraints = false
        sponsoredLabel.text = "SPONSORED"
        sponsoredLabel.font = .systemFont(ofSize: 9, weight: .bold)
        sponsoredLabel.textColor = UIColor(white: 0.55, alpha: 1)
        cardView.addSubview(sponsoredLabel)

        // Headline
        headlineLabel.translatesAutoresizingMaskIntoConstraints = false
        headlineLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        headlineLabel.textColor = UIColor(red: 0.07, green: 0.07, blue: 0.13, alpha: 1)
        headlineLabel.numberOfLines = 1
        cardView.addSubview(headlineLabel)

        // Body
        bodyLabel.translatesAutoresizingMaskIntoConstraints = false
        bodyLabel.font = .systemFont(ofSize: 12)
        bodyLabel.textColor = UIColor(white: 0.4, alpha: 1)
        bodyLabel.numberOfLines = 1
        cardView.addSubview(bodyLabel)

        // CTA button
        ctaButton.translatesAutoresizingMaskIntoConstraints = false
        ctaButton.titleLabel?.font = .systemFont(ofSize: 11, weight: .bold)
        ctaButton.setTitleColor(.white, for: .normal)
        ctaButton.backgroundColor = UIColor(red: 1.0, green: 0.176, blue: 0.471, alpha: 1) // BB pink
        ctaButton.layer.cornerRadius = 6
        ctaButton.contentEdgeInsets = UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)
        ctaButton.addTarget(self, action: #selector(ctaTapped), for: .touchUpInside)
        cardView.addSubview(ctaButton)

        // Dismiss
        dismissButton.translatesAutoresizingMaskIntoConstraints = false
        dismissButton.setTitle("✕", for: .normal)
        dismissButton.titleLabel?.font = .systemFont(ofSize: 14)
        dismissButton.setTitleColor(UIColor(white: 0.55, alpha: 1), for: .normal)
        dismissButton.addTarget(self, action: #selector(dismissTapped), for: .touchUpInside)
        cardView.addSubview(dismissButton)

        NSLayoutConstraint.activate([
            cardView.topAnchor.constraint(equalTo: self.topAnchor),
            cardView.bottomAnchor.constraint(equalTo: self.bottomAnchor),
            cardView.leadingAnchor.constraint(equalTo: self.leadingAnchor),
            cardView.trailingAnchor.constraint(equalTo: self.trailingAnchor),

            imageView.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 10),
            imageView.centerYAnchor.constraint(equalTo: cardView.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: 64),
            imageView.heightAnchor.constraint(equalToConstant: 64),

            sponsoredLabel.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 10),
            sponsoredLabel.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 10),

            headlineLabel.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 10),
            headlineLabel.topAnchor.constraint(equalTo: sponsoredLabel.bottomAnchor, constant: 2),
            headlineLabel.trailingAnchor.constraint(lessThanOrEqualTo: dismissButton.leadingAnchor, constant: -8),

            bodyLabel.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 10),
            bodyLabel.topAnchor.constraint(equalTo: headlineLabel.bottomAnchor, constant: 2),
            bodyLabel.trailingAnchor.constraint(lessThanOrEqualTo: ctaButton.leadingAnchor, constant: -8),

            ctaButton.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -12),
            ctaButton.bottomAnchor.constraint(equalTo: cardView.bottomAnchor, constant: -10),

            dismissButton.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -8),
            dismissButton.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 4),
            dismissButton.widthAnchor.constraint(equalToConstant: 28),
            dismissButton.heightAnchor.constraint(equalToConstant: 28),
        ])

        // Make the whole card tappable as a fallback click target.
        let tap = UITapGestureRecognizer(target: self, action: #selector(ctaTapped))
        cardView.addGestureRecognizer(tap)
        cardView.isUserInteractionEnabled = true
    }

    // MARK: - Actions

    @objc private func ctaTapped() {
        guard let ad = currentAd, let urlStr = ad.clickUrl, let url = URL(string: urlStr) else { return }
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }

    @objc private func dismissTapped() {
        UIView.animate(withDuration: 0.2, animations: {
            self.alpha = 0
        }) { _ in
            self.isHidden = true
        }
    }
}
