// @boostbossai/lumi-mobile — RewardedVideo
//
// Opt-in placement. Publisher renders a button; tapping it opens a sponsored
// destination, and on close we fire onReward.
//
// v0 ships a real-link rewarded card — the publisher's app calls onReward()
// when our simple "tap-through and return" loop completes. Native video
// player wiring lands in a later version.

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

export interface RewardedVideoProps {
  buttonLabel?: string;
  onReward: () => void;
  /** Optional context hint (current screen name, query, etc.). */
  contextHint?: string | null;
  /** Show the button even before the ad loads (defaults to true). */
  showWhileLoading?: boolean;
}

export function RewardedVideo({
  buttonLabel = 'Watch ad for reward',
  onReward,
  contextHint = null,
  showWhileLoading = true,
}: RewardedVideoProps): React.ReactElement | null {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!publisherId) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.REWARDED_VIDEO,
      sessionId,
      contextHint,
    })
      .then((next) => {
        if (alive) setAd(next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [publisherId, sessionId, contextHint]);

  if (!ad && !showWhileLoading) return null;

  const onPress = async () => {
    if (!ad) return;
    fireImpression(ad, { sessionId });
    if (ad.click_url) {
      try {
        await Linking.openURL(ad.click_url as string);
      } catch (_e) {
        // ignore
      }
    }
    // v0: treat the click-through as the reward signal.
    onReward();
  };

  return (
    <TouchableOpacity
      style={[styles.btn, !ad && styles.btnLoading]}
      onPress={onPress}
      disabled={!ad}
      activeOpacity={0.85}
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>▶</Text>
      </View>
      <Text style={styles.label}>{buttonLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#111111',
    alignSelf: 'flex-start',
  },
  btnLoading: {
    opacity: 0.5,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconText: {
    color: '#111111',
    fontSize: 12,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
