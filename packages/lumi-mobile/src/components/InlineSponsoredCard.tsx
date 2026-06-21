// @boostbossai/lumi-mobile — InlineSponsoredCard
//
// Opt-in rich card for in-feed placement. RICHER counterpart to
// InlineNativeBanner: image + headline + body + pink CTA button.
// ~240px tall, 16:9 image at top (optional), disclosure pill, headline,
// body, pink CTA button.

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

export interface InlineSponsoredCardProps {
  contextHint?: string | null;
}

export function InlineSponsoredCard({
  contextHint = null,
}: InlineSponsoredCardProps): React.ReactElement | null {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!publisherId) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.INLINE_SPONSORED_CARD,
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
    <View style={styles.card}>
      {ad.image_url ? (
        <Image
          source={{ uri: ad.image_url as string }}
          style={styles.hero}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.content}>
        <View style={styles.disclosure}>
          <Text style={styles.disclosureText}>Sponsored</Text>
        </View>
        <Text style={styles.headline} numberOfLines={2}>
          {(ad.headline as string) || (ad.brand as string) || 'Sponsored'}
        </Text>
        {ad.body ? (
          <Text style={styles.body} numberOfLines={3}>
            {ad.body as string}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={styles.ctaBtn}
        >
          <Text style={styles.ctaText}>
            {(ad.cta as string) || 'Learn more'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F2F2F2',
  },
  content: {
    padding: 12,
  },
  disclosure: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#F2F2F2',
    marginBottom: 8,
  },
  disclosureText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
    lineHeight: 18,
  },
  ctaBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#FF2E8E',
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
