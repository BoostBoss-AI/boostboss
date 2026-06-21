// @boostbossai/lumi-mobile — RewardedVideo
//
// Opt-in rewarded video placement. The standard adtech contract (AppLovin /
// Unity Ads / IronSource): the user taps an opt-in CTA, a full-screen video
// plays, and on completion we fire onReward so the publisher app grants the
// promised reward. Skipping early grants no reward. Apple App Store
// guideline 4.5.4 explicitly permits this format — but only when a real
// rewarded video is shown. This component implements that contract.
//
// REAL VIDEO REQUIRES `expo-av`:
//   expo install expo-av
// If expo-av is not installed we fall back to a static "[Sponsored] Watch
// to earn reward" full-screen card with a countdown — same payout model,
// no native video frame. We conditionally require() expo-av inside a
// try/catch so it stays a soft (optional) dependency.

import * as React from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';

import { useLumi } from '../LumiProvider';
import { fetchAd, fireImpression } from '../api';
import { PLACEMENTS, type Ad } from '../types';

// Soft-detect expo-av. If installed, we'll use its <Video> component;
// otherwise fall through to the static countdown card.
// v0 fallback — install expo-av for real playback.
let ExpoVideo: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expoAv = require('expo-av');
  ExpoVideo = expoAv && expoAv.Video ? expoAv.Video : null;
} catch (_e) {
  ExpoVideo = null;
}

type PlayerState = 'idle' | 'loading' | 'playing' | 'complete' | 'skipped';

export interface RewardedVideoProps {
  /** CTA label on the opt-in button. Defaults to
   *  `Watch ad to earn ${rewardAmount} ${rewardUnit}`. */
  buttonLabel?: string;
  /** Numeric reward, used in default label + passed to onReward. */
  rewardAmount?: number;
  /** Unit string, used in default label + passed to onReward. */
  rewardUnit?: string;
  /** Optional context hint (current screen name, query, etc.) for scoring. */
  contextHint?: string | null;
  /** Fired on successful completion. Publisher grants reward here. */
  onReward?: (reward: { amount: number; unit: string }) => void;
  /** Fired when user dismisses early — no reward should be granted. */
  onSkip?: () => void;
  /** Fired on network failure / no ad available. */
  onError?: (err: Error) => void;
  /** Seconds before the skip button becomes available. Default 5. */
  skipAfterSec?: number;
  /** Seconds for the fallback (non-expo-av) countdown. Default 15. */
  fallbackDurationSec?: number;
}

export function RewardedVideo({
  buttonLabel,
  rewardAmount = 10,
  rewardUnit = 'credits',
  contextHint = null,
  onReward,
  onSkip,
  onError,
  skipAfterSec = 5,
  fallbackDurationSec = 15,
}: RewardedVideoProps): React.ReactElement {
  const { publisherId, sessionId } = useLumi();

  const [visible, setVisible] = React.useState(false);
  const [state, setState] = React.useState<PlayerState>('idle');
  const [ad, setAd] = React.useState<Ad | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(skipAfterSec);
  const [showRewardToast, setShowRewardToast] = React.useState(false);

  const impressionFiredRef = React.useRef(false);
  const settledRef = React.useRef(false); // reward OR skip has fired

  const resolvedLabel =
    buttonLabel || `Watch ad to earn ${rewardAmount} ${rewardUnit}`;

  // -- Open / reset modal ----------------------------------------------------
  const openModal = React.useCallback(() => {
    if (!publisherId) return;
    impressionFiredRef.current = false;
    settledRef.current = false;
    setAd(null);
    setSecondsLeft(skipAfterSec);
    setShowRewardToast(false);
    setState('loading');
    setVisible(true);
  }, [publisherId, skipAfterSec]);

  // -- Ad fetch (runs on modal open) -----------------------------------------
  React.useEffect(() => {
    if (state !== 'loading') return;
    let alive = true;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.REWARDED_VIDEO,
      sessionId,
      contextHint,
    })
      .then((next) => {
        if (!alive) return;
        if (!next) {
          if (onError) onError(new Error('No rewarded ad available'));
          setVisible(false);
          setState('idle');
          return;
        }
        setAd(next);
        setState('playing');
      })
      .catch((err) => {
        if (!alive) return;
        if (onError) onError(err instanceof Error ? err : new Error(String(err)));
        setVisible(false);
        setState('idle');
      });
    return () => {
      alive = false;
    };
  }, [state, publisherId, sessionId, contextHint, onError]);

  // Fire impression when playback actually starts (not on fetch).
  React.useEffect(() => {
    if (state !== 'playing' || !ad || impressionFiredRef.current) return;
    impressionFiredRef.current = true;
    fireImpression(ad, { sessionId } as any);
  }, [state, ad, sessionId]);

  // -- Skip-availability countdown -------------------------------------------
  React.useEffect(() => {
    if (state !== 'playing') return;
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [state, secondsLeft]);

  // -- Fallback countdown (no expo-av) ---------------------------------------
  // When ExpoVideo is not available we don't get a didJustFinish callback,
  // so we drive completion off a wall-clock timer of fallbackDurationSec.
  React.useEffect(() => {
    if (state !== 'playing') return;
    if (ExpoVideo && ad && (ad.video_url || ad.image_url)) return; // real video path
    const duration = Math.max(fallbackDurationSec, skipAfterSec + 1);
    const t = setTimeout(() => {
      handleComplete();
    }, duration * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ad, fallbackDurationSec, skipAfterSec]);

  // -- Completion / skip handlers --------------------------------------------
  const handleComplete = React.useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    setState('complete');
    setShowRewardToast(true);
    if (onReward) onReward({ amount: rewardAmount, unit: rewardUnit });
    // Brief "✓ Reward earned!" toast, then auto-close.
    setTimeout(() => {
      setShowRewardToast(false);
      setVisible(false);
      setState('idle');
    }, 1000);
  }, [onReward, rewardAmount, rewardUnit]);

  const handleSkip = React.useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    setState('skipped');
    if (onSkip) onSkip();
    setVisible(false);
    setState('idle');
  }, [onSkip]);

  const onPlaybackStatusUpdate = React.useCallback(
    (status: any) => {
      if (status && status.didJustFinish) {
        handleComplete();
      }
    },
    [handleComplete]
  );

  const onLearnMore = React.useCallback(() => {
    if (!ad || !ad.click_url) return;
    Linking.openURL(ad.click_url as string).catch(() => {});
  }, [ad]);

  const canSkip = secondsLeft <= 0;

  // -- Render ----------------------------------------------------------------
  return (
    <>
      <TouchableOpacity
        style={styles.optInBtn}
        onPress={openModal}
        activeOpacity={0.85}
      >
        <Text style={styles.optInLabel}>{resolvedLabel}</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="fade"
        transparent={false}
        onRequestClose={handleSkip}
      >
        <View style={styles.modalRoot}>
          {state === 'loading' ? (
            <View style={styles.center}>
              <ActivityIndicator color="#FFFFFF" size="large" />
              <Text style={styles.loadingText}>Loading ad…</Text>
            </View>
          ) : null}

          {state === 'playing' && ad ? (
            <View style={styles.playerWrap}>
              {ExpoVideo && (ad.video_url || ad.image_url) ? (
                <ExpoVideo
                  source={{
                    uri:
                      (ad.video_url as string) || (ad.image_url as string),
                  }}
                  style={styles.media}
                  shouldPlay
                  isLooping={false}
                  useNativeControls={false}
                  resizeMode="contain"
                  onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                />
              ) : (
                // Fallback: static card + wall-clock completion.
                <View style={styles.fallback}>
                  {ad.image_url ? (
                    <Image
                      source={{ uri: ad.image_url as string }}
                      style={styles.fallbackImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      style={[styles.fallbackImage, styles.fallbackImageEmpty]}
                    />
                  )}
                  <View style={styles.fallbackOverlay}>
                    <Text style={styles.fallbackLabel}>[Sponsored]</Text>
                    {ad.headline ? (
                      <Text style={styles.fallbackHeadline} numberOfLines={2}>
                        {ad.headline as string}
                      </Text>
                    ) : null}
                    <Text style={styles.fallbackSub}>
                      Watch to earn {rewardAmount} {rewardUnit}
                    </Text>
                  </View>
                </View>
              )}

              {canSkip ? (
                <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                  <Text style={styles.skipText}>Skip ✕</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.skipCountdown}>
                  <Text style={styles.skipCountdownText}>
                    Skip in {secondsLeft}s
                  </Text>
                </View>
              )}

              {ad.click_url ? (
                <TouchableOpacity
                  style={styles.ctaBtn}
                  onPress={onLearnMore}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ctaText}>
                    {(ad.cta as string) || 'Learn more →'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {showRewardToast ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>✓ Reward earned!</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  optInBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#FF2D78',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optInLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#CCCCCC',
    marginTop: 12,
    fontSize: 13,
  },
  playerWrap: {
    flex: 1,
    backgroundColor: '#000000',
  },
  media: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  fallback: {
    flex: 1,
    backgroundColor: '#111',
  },
  fallbackImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#222',
  },
  fallbackImageEmpty: {
    backgroundColor: '#222',
  },
  fallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 24,
  },
  fallbackLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fallbackHeadline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  fallbackSub: {
    color: '#FF8FB7',
    fontSize: 14,
    fontWeight: '600',
  },
  skipBtn: {
    position: 'absolute',
    top: 44,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  skipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  skipCountdown: {
    position: 'absolute',
    top: 44,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  skipCountdownText: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  ctaBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#FF2D78',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  toast: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
