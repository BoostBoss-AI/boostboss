// @boostbossai/lumi-mobile — SuggestedChip
//
// Opt-in inline placement. Tappable quick-reply pill used in suggested-action
// rows. Rounded pill (borderRadius:18), pink border, brand text.

import * as React from 'react';
import {
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';

import { useLumi } from '../LumiProvider';
import { fetchAd, fireImpression } from '../api';
import { PLACEMENTS, type Ad } from '../types';

export interface SuggestedChipProps {
  contextHint?: string | null;
  /** Optional override label. If omitted, uses ad.cta or ad.brand. */
  label?: string;
}

export function SuggestedChip({
  contextHint = null,
  label,
}: SuggestedChipProps): React.ReactElement | null {
  const { publisherId, sessionId } = useLumi();
  const [ad, setAd] = React.useState<Ad | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!publisherId) return;
    fetchAd({
      publisherId,
      placement: PLACEMENTS.SUGGESTED_CHIP,
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

  const displayLabel =
    label || (ad.cta as string) || (ad.brand as string) || 'Try this';

  return (
    <TouchableOpacity
      style={styles.chip}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.text} numberOfLines={1}>
        {displayLabel}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FF2E8E',
    backgroundColor: '#FFFFFF',
  },
  text: {
    color: '#FF2E8E',
    fontSize: 13,
    fontWeight: '600',
  },
});
