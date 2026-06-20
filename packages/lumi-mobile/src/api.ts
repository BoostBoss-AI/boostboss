// @boostbossai/lumi-mobile — ad-server client.
//
// Uses RN's built-in global `fetch`. No deps.

import type { Ad, FetchAdOpts } from './types';

export const API_ORIGIN = 'https://boostboss.ai';
export const LUMI_FETCH_URL = `${API_ORIGIN}/api/lumi-fetch`;
export const LUMI_IMPRESSION_URL = `${API_ORIGIN}/api/lumi-impression`;

export const SDK_NAME = 'lumi-mobile';
export const SDK_VERSION = '0.1.0';

/**
 * Fetch a single ad placement from the BB ad server.
 * Returns null on miss, network failure, or non-2xx response.
 */
export async function fetchAd(opts: FetchAdOpts): Promise<Ad | null> {
  const body = {
    publisher_id: opts.publisherId,
    placement: opts.placement,
    surface: 'mobile-app',
    context: opts.contextHint ? { hint: opts.contextHint } : null,
    session_id: opts.sessionId,
    sdk: SDK_NAME,
    sdk_version: SDK_VERSION,
  };

  try {
    const res = await fetch(LUMI_FETCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ad?: Ad } | null;
    if (!data || !data.ad) return null;
    return data.ad;
  } catch (_e) {
    return null;
  }
}

/**
 * Fire an impression beacon. Best-effort; failures are silent.
 */
export function fireImpression(
  ad: Ad | null,
  opts: { sessionId: string }
): void {
  if (!ad || !ad.impression_token) return;
  const body = {
    impression_token: ad.impression_token,
    session_id: opts.sessionId,
    ts: Date.now(),
  };
  try {
    fetch(LUMI_IMPRESSION_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch (_e) {
    // ignore
  }
}
