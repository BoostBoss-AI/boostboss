// @boostbossai/lumi-mobile — FullScreenInterstitial
//
// Minimal stub for v0. Renders an RN <Modal> with a full-screen sponsored
// card. Publishers control when to show it via the `visible` prop:
//
//   <FullScreenInterstitial visible={showInterstitial} onClose={...} />

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
import { BrandLine, Voucher } from './BrandLine';

export interface FullScreenInterstitialProps {
  visible: boolean;
  onClose: () => void;
  contextHint?: string | null;
}

export function FullScreenInterstitial({
  visible,
  onClose,
  contextHint = null,
}: FullScreenInterstitialProps): React.ReactElement {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);
  const impressionFiredRef = React.useRef(false);

  React.useEffect(() => {
    if (!visible) {
      impressionFiredRef.current = false;
      return;
    }
    let alive = true;
    if (!publisherId) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.FULL_SCREEN_INTERSTITIAL,
      sessionId,
      contextHint,
    })
      .then((next) => {
        if (!alive) return;
        setAd(next);
        if (next && !impressionFiredRef.current) {
          fireImpression(next, { sessionId });
          impressionFiredRef.current = true;
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [publisherId, sessionId, contextHint, visible]);

  const onPress = () => {
    if (ad && ad.click_url) {
      Linking.openURL(ad.click_url as string).catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>

        <View style={styles.body}>
          {ad ? (
            <>
              {ad.image_url ? (
                <Image
                  source={{ uri: ad.image_url as string }}
                  style={styles.hero}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.hero, styles.heroFallback]} />
              )}
              <BrandLine ad={ad} align="center" />
              <Text style={styles.headline}>
                {(ad.headline as string) || (ad.brand as string) || 'Sponsored'}
              </Text>
              {ad.body ? (
                <Text style={styles.bodyText}>{ad.body as string}</Text>
              ) : null}
              <Voucher ad={ad} />
              <TouchableOpacity style={styles.ctaBtn} onPress={onPress}>
                <Text style={styles.ctaText}>{(ad.cta as string) || 'Learn more'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.loading}>Loading…</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    fontSize: 28,
    color: '#666',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#F2F2F2',
    marginBottom: 20,
  },
  heroFallback: {
    backgroundColor: '#EFEFEF',
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
  },
  ctaBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    backgroundColor: '#111',
  },
  ctaText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  loading: {
    color: '#888',
  },
});
