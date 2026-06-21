// @boostbossai/lumi-mobile — SponsoredCitation
//
// Opt-in inline placement. Short citation line that sits under an AI response
// in a chat-style mobile app. ~40px tall horizontal row: pink BB badge +
// sponsor brand + tagline + arrow.
//
// Tap row → Linking.openURL(ad.click_url). Impression fires on first render.

import * as React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';

import { useLumi } from '../LumiProvider';
import { fetchAd, fireImpression } from '../api';
import { PLACEMENTS, type Ad } from '../types';

export interface SponsoredCitationProps {
  contextHint?: string | null;
}

export function SponsoredCitation({
  contextHint = null,
}: SponsoredCitationProps): React.ReactElement | null {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!publisherId) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.SPONSORED_CITATION,
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

  const brand = (ad.brand as string) || (ad.headline as string) || 'Sponsored';
  const tagline =
    (ad.body as string) || (ad.cta as string) || 'Learn more';

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>BB</Text>
      </View>
      <Text style={styles.brand} numberOfLines={1}>
        {brand}
      </Text>
      <Text style={styles.dot}>·</Text>
      <Text style={styles.tagline} numberOfLines={1}>
        {tagline}
      </Text>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FF2E8E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  brand: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    maxWidth: 120,
  },
  dot: {
    color: '#999999',
    marginHorizontal: 6,
    fontSize: 13,
  },
  tagline: {
    flex: 1,
    fontSize: 12,
    color: '#555555',
  },
  arrow: {
    color: '#888888',
    fontSize: 18,
    marginLeft: 6,
  },
});
