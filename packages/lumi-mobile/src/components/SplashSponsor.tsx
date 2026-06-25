// @boostbossai/lumi-mobile — SplashSponsor
//
// Auto-mounted by LumiProvider on cold start per Publisher Agreement §4.1.
// Brief full-screen sponsor card shown on app launch.
// Auto-dismisses after 3 seconds OR on tap. Full-screen Modal with a
// BB-pink gradient-like background, sponsor logo placeholder + tagline +
// tiny "Powered by Boost Boss" footer + tap-to-skip hint.

import * as React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  Linking,
  StyleSheet,
} from 'react-native';

import { useLumi } from '../LumiProvider';
import { fetchAd, fireImpression } from '../api';
import { PLACEMENTS, type Ad } from '../types';
import { BrandLine } from './BrandLine';

export interface SplashSponsorProps {
  onDismiss: () => void;
  contextHint?: string | null;
  /** Auto-dismiss timeout in ms. Defaults to 3000. */
  dismissAfterMs?: number;
}

export function SplashSponsor({
  onDismiss,
  contextHint = null,
  dismissAfterMs = 3000,
}: SplashSponsorProps): React.ReactElement {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [visible, setVisible] = React.useState(true);
  const dismissedRef = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    if (!publisherId) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.SPLASH,
      sessionId,
      contextHint,
    })
      .then((next) => {
        if (!alive) return;
        setAd(next);
        if (next) fireImpression(next, { sessionId });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [publisherId, sessionId, contextHint]);

  const dismiss = React.useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
    onDismiss();
  }, [onDismiss]);

  // Auto-dismiss after configured ms.
  React.useEffect(() => {
    const t = setTimeout(() => dismiss(), dismissAfterMs);
    return () => clearTimeout(t);
  }, [dismiss, dismissAfterMs]);

  const onTapCard = () => {
    if (ad && ad.click_url) {
      Linking.openURL(ad.click_url as string).catch(() => {});
    }
    dismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={dismiss}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        style={styles.root}
        onPress={onTapCard}
      >
        {/* Layered pink bands approximate a gradient without a 3rd-party dep. */}
        <View style={styles.bandTop} pointerEvents="none" />
        <View style={styles.bandMid} pointerEvents="none" />
        <View style={styles.bandBot} pointerEvents="none" />

        <View style={styles.content}>
          {ad && ad.image_url ? (
            <Image
              source={{ uri: ad.image_url as string }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoFallbackText}>
                {(ad && (ad.brand as string)) || 'BB'}
              </Text>
            </View>
          )}
          <Text style={styles.brand} numberOfLines={1}>
            {(ad && ((ad.brand as string) || (ad.headline as string))) ||
              'Sponsored'}
          </Text>
          <Text style={styles.tagline} numberOfLines={2}>
            {(ad && ((ad.body as string) || (ad.cta as string))) ||
              'Brought to you by our sponsors'}
          </Text>
        </View>

        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.tapHint}>Tap anywhere to continue</Text>
          <Text style={styles.poweredBy}>Powered by Boost Boss</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FF2E8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stacked translucent bands approximate a vertical gradient — no LinearGradient dep.
  bandTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '33%',
    backgroundColor: '#FF5BA7',
  },
  bandMid: {
    position: 'absolute',
    top: '33%',
    left: 0,
    right: 0,
    height: '34%',
    backgroundColor: '#FF2E8E',
  },
  bandBot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '33%',
    backgroundColor: '#E61E78',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 20,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 15,
    opacity: 0.9,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapHint: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 12,
    marginBottom: 6,
  },
  poweredBy: {
    color: '#FFFFFF',
    opacity: 0.6,
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
