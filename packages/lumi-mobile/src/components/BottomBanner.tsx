// @boostbossai/lumi-mobile — BottomBanner
//
// The simplest mobile placement. Auto-mounted by LumiProvider. Renders fixed
// at the bottom of the screen: 60px tall, full width, white, with image +
// headline + CTA + dismiss `×`.
//
// For v0 we fire the impression on mount (no IntersectionObserver in RN).

import * as React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';

import { useLumi } from '../LumiProvider';
import { fetchAd, fireImpression } from '../api';
import { PLACEMENTS, type Ad } from '../types';

export interface BottomBannerProps {
  contextHint?: string | null;
  /** Override the placement key — defaults to "bottom-banner". */
  placement?: string;
}

export function BottomBanner({
  contextHint = null,
  placement = PLACEMENTS.BOTTOM_BANNER,
}: BottomBannerProps): React.ReactElement | null {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!publisherId) return;
    fetchAd({ publisherId, placement, sessionId, contextHint })
      .then((next) => {
        if (!alive) return;
        setAd(next);
        if (next) fireImpression(next, { sessionId });
      })
      .catch(() => {
        // swallow
      });
    return () => {
      alive = false;
    };
  }, [publisherId, placement, sessionId, contextHint]);

  if (!ad || dismissed) return null;

  const onPress = () => {
    if (ad.click_url) {
      Linking.openURL(ad.click_url).catch(() => {});
    }
  };

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={onPress}
      >
        {ad.image_url ? (
          <Image
            source={{ uri: ad.image_url as string }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]} />
        )}
        <View style={styles.textCol}>
          <Text style={styles.headline} numberOfLines={1}>
            {(ad.headline as string) || (ad.brand as string) || 'Sponsored'}
          </Text>
          {ad.body ? (
            <Text style={styles.body} numberOfLines={1}>
              {ad.body as string}
            </Text>
          ) : null}
        </View>
        {ad.cta ? (
          <View style={styles.ctaPill}>
            <Text style={styles.ctaText}>{ad.cta as string}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        style={styles.dismiss}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Text style={styles.dismissText}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#F2F2F2',
  },
  thumbFallback: {
    backgroundColor: '#EFEFEF',
  },
  textCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  body: {
    fontSize: 12,
    color: '#555555',
    marginTop: 2,
  },
  ctaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#111111',
    marginLeft: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dismiss: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  dismissText: {
    color: '#888888',
    fontSize: 20,
    lineHeight: 20,
  },
});
