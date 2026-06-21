// @boostbossai/lumi-mobile — LoadingStateAd
//
// Opt-in placement shown during AI generation. Pink-bordered card with shimmer
// animation rows + sponsor headline. Detects loading via `isLoading` prop OR
// when mounted (e.g. inside a Suspense fallback) — if `isLoading` is omitted,
// the component assumes it's a fallback child and renders the loading state
// for as long as it remains mounted.

import * as React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';

import { useLumi } from '../LumiProvider';
import { fetchAd, fireImpression } from '../api';
import { PLACEMENTS, type Ad } from '../types';

export interface LoadingStateAdProps {
  /** Pass false to hide the placement. Omit (or pass true) for Suspense
   *  fallback use — render assumes "loading" as long as mounted. */
  isLoading?: boolean;
  contextHint?: string | null;
}

export function LoadingStateAd({
  isLoading = true,
  contextHint = null,
}: LoadingStateAdProps): React.ReactElement | null {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    let alive = true;
    if (!publisherId || !isLoading) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.LOADING_STATE,
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
  }, [publisherId, sessionId, contextHint, isLoading]);

  React.useEffect(() => {
    if (!isLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading, shimmer]);

  if (!isLoading) return null;

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.9],
  });

  const onPress = () => {
    if (ad && ad.click_url) {
      Linking.openURL(ad.click_url as string).catch(() => {});
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={ad ? 0.85 : 1}
      onPress={onPress}
      disabled={!ad}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>BB</Text>
        </View>
        <Text style={styles.sponsor} numberOfLines={1}>
          {ad
            ? (ad.headline as string) ||
              (ad.brand as string) ||
              'Sponsored while you wait'
            : 'Sponsored while you wait'}
        </Text>
      </View>
      <Animated.View style={[styles.shimmerRow, { opacity, width: '90%' }]} />
      <Animated.View style={[styles.shimmerRow, { opacity, width: '75%' }]} />
      <Animated.View style={[styles.shimmerRow, { opacity, width: '60%' }]} />
      {ad && ad.body ? (
        <Text style={styles.body} numberOfLines={2}>
          {ad.body as string}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#FF2E8E',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
  sponsor: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
  },
  shimmerRow: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD1E8',
    marginVertical: 4,
  },
  body: {
    marginTop: 8,
    fontSize: 12,
    color: '#555',
  },
});
