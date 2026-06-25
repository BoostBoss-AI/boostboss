// @boostbossai/lumi-mobile — BrandLine + Voucher
//
// Shared inheritance components for placements rich enough to surface
// the global Creatives library's brand kit + voucher. Pulled from
// ad.brand_kit / ad.voucher (added in lumi-mobile 0.3.0 / backend
// 2026-06-25 alongside the global creative_assets library).
//
// Both components render null when their respective field is empty, so
// they're safe to drop into any placement without an existence check at
// the call site.

import * as React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

import type { Ad } from '../types';

export interface BrandLineProps {
  ad: Ad;
  /** Optional override styles for centered layouts (splash, interstitial). */
  align?: 'flex-start' | 'center';
}

export function BrandLine({ ad, align = 'flex-start' }: BrandLineProps): React.ReactElement | null {
  const bk = ad.brand_kit;
  if (!bk || (!bk.name && !bk.logo_url && !bk.domain)) return null;
  return (
    <View style={[styles.brand, { justifyContent: align }]}>
      {bk.logo_url ? (
        <Image
          source={{ uri: bk.logo_url }}
          style={styles.logo}
          resizeMode="contain"
        />
      ) : null}
      {bk.name ? (
        <Text style={styles.text}>
          Sponsored by <Text style={styles.name}>{bk.name}</Text>
          {bk.domain ? <Text style={styles.domain}>{' · ' + bk.domain}</Text> : null}
        </Text>
      ) : bk.domain ? (
        <Text style={styles.text}>{bk.domain}</Text>
      ) : null}
    </View>
  );
}

export interface VoucherProps {
  ad: Ad;
}

export function Voucher({ ad }: VoucherProps): React.ReactElement | null {
  const v = ad.voucher;
  if (!v || !v.value_text) return null;
  return (
    <View style={styles.voucher}>
      <Text style={styles.voucherIcon}>🎟</Text>
      <View style={styles.voucherBody}>
        <Text style={styles.voucherValue} numberOfLines={2}>
          {v.value_text}
        </Text>
        {v.code ? (
          <Text style={styles.voucherCode}>Code: {v.code}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  logo: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 14,
  },
  name: {
    fontWeight: '700',
    color: '#111',
  },
  domain: {
    color: '#6b7280',
  },
  voucher: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: '#fff7ed',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(252,211,77,0.55)',
    borderRadius: 8,
    marginVertical: 8,
  },
  voucherIcon: {
    fontSize: 15,
  },
  voucherBody: {
    flex: 1,
  },
  voucherValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    lineHeight: 16,
  },
  voucherCode: {
    fontSize: 10,
    color: '#9a3412',
    fontFamily: 'Menlo',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
