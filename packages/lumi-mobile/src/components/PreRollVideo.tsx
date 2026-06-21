// @boostbossai/lumi-mobile — PreRollVideo
//
// Opt-in placement. Pre-roll spot before a heavy action. No opt-in screen —
// auto-plays. Renders a video frame with a skip-in-5s countdown, then resolves
// `onComplete()`.
//
// v0 FALLBACK: install `expo-av` to get real <Video> playback. Without it,
// this component renders a static "[Sponsored video] Skip ⏯" card that
// resolves onComplete after a 5-second countdown. We conditionally require()
// expo-av inside a try/catch so it stays a soft dependency.

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

// Soft-detect expo-av. If installed, we'll use its <Video> component;
// otherwise fall through to the static "[Sponsored video]" card.
// v0 fallback — install expo-av for real playback.
let ExpoVideo: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expoAv = require('expo-av');
  ExpoVideo = expoAv && expoAv.Video ? expoAv.Video : null;
} catch (_e) {
  ExpoVideo = null;
}

export interface PreRollVideoProps {
  onComplete: () => void;
  contextHint?: string | null;
  /** Countdown length in seconds before skip becomes available / auto-completes. */
  skipAfterSeconds?: number;
}

export function PreRollVideo({
  onComplete,
  contextHint = null,
  skipAfterSeconds = 5,
}: PreRollVideoProps): React.ReactElement | null {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(skipAfterSeconds);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    if (!publisherId) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.PRE_ROLL,
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

  // Countdown — auto-completes when it reaches 0.
  React.useEffect(() => {
    if (secondsLeft <= 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onComplete]);

  const onPressAd = () => {
    if (ad && ad.click_url) {
      Linking.openURL(ad.click_url as string).catch(() => {});
    }
  };

  const onSkip = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  // Nothing fetched yet — render an empty placeholder card so the publisher
  // still gets the gating countdown to land on onComplete().
  return (
    <View style={styles.card}>
      {ExpoVideo && ad && (ad.video_url || ad.image_url) ? (
        // Real playback when expo-av is installed.
        <ExpoVideo
          source={{
            uri:
              (ad.video_url as string) ||
              (ad.image_url as string),
          }}
          style={styles.media}
          shouldPlay
          isLooping={false}
          resizeMode="cover"
        />
      ) : (
        // v0 fallback — static card with disclosure pill.
        <TouchableOpacity
          style={styles.fallback}
          onPress={onPressAd}
          activeOpacity={0.85}
          disabled={!ad}
        >
          {ad && ad.image_url ? (
            <Image
              source={{ uri: ad.image_url as string }}
              style={styles.fallbackImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.fallbackImage, styles.fallbackImageEmpty]} />
          )}
          <View style={styles.overlay}>
            <Text style={styles.overlayLabel}>[Sponsored video]</Text>
            {ad && ad.headline ? (
              <Text style={styles.overlayHeadline} numberOfLines={2}>
                {ad.headline as string}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.skipRow}>
        <Text style={styles.countdown}>
          {secondsLeft > 0 ? `Continuing in ${secondsLeft}s` : 'Done'}
        </Text>
        <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip ⏯</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  fallback: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
  },
  fallbackImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#222',
  },
  fallbackImageEmpty: {
    backgroundColor: '#222',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
  },
  overlayLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  overlayHeadline: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#000000',
  },
  countdown: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  skipText: {
    color: '#111',
    fontWeight: '700',
    fontSize: 12,
  },
});
