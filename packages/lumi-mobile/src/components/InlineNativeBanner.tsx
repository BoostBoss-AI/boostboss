// @boostbossai/lumi-mobile — InlineNativeBanner
//
// Minimal stub for v0. Publisher drops <InlineNativeBanner /> wherever a
// list/feed natural-break is appropriate. Renders a card-shaped sponsored
// row that visually echoes the host content style.

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

export interface InlineNativeBannerProps {
  contextHint?: string | null;
}

export function InlineNativeBanner({
  contextHint = null,
}: InlineNativeBannerProps): React.ReactElement | null {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!publisherId) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.INLINE_NATIVE_BANNER,
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

  if (!ad) return null;

  const onPress = () => {
    if (ad.click_url) Linking.openURL(ad.click_url as string).catch(() => {});
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.card}>
      <View style={styles.tag}>
        <Text style={styles.tagText}>Sponsored</Text>
      </View>
      <View style={styles.row}>
        {ad.image_url ? (
          <Image
            source={{ uri: ad.image_url as string }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.textCol}>
          <Text style={styles.headline} numberOfLines={2}>
            {(ad.headline as string) || (ad.brand as string) || 'Sponsored'}
          </Text>
          {ad.body ? (
            <Text style={styles.body} numberOfLines={2}>
              {ad.body as string}
            </Text>
          ) : null}
          {ad.cta ? <Text style={styles.cta}>{ad.cta as string} →</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EFEFEF',
    marginBottom: 6,
  },
  tagText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#EEE',
  },
  textCol: {
    flex: 1,
  },
  headline: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  body: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
  cta: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#0066CC',
  },
});
