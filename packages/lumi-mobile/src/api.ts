// @boostbossai/lumi-mobile — ad-server client.
//
// Uses RN's built-in global `fetch`. No deps.
//
// Wire contract (must match api/lumi-fetch.js + api/track.js on the server):
//   POST /api/lumi-fetch  { publisher_id, door, context, placement, session_id }
//     → { ad: { ad_id, headline, body, image_url, cta_label, click_url,
//                impression_url, ... } }
//   The impression_url returned is a server-built tracking URL the runtime
//   fires when a placement becomes visible.

import type { Ad, FetchAdOpts } from './types';

export const API_ORIGIN = 'https://boostboss.ai';
export const LUMI_FETCH_URL = `${API_ORIGIN}/api/lumi-fetch`;
export const TRACK_URL = `${API_ORIGIN}/api/track`;
export const DOOR = 'rest-api';  // Internal door key for Lumi for Mobile App
export const SDK_NAME = 'lumi-mobile';
export const SDK_VERSION = '0.1.0';

/**
 * Fire the install handshake — records one impression event with
 * integration_method='rest-api' so the publisher's "Mobile App" verify
 * badge in the dashboard flips from "Not started" to "Connected".
 *
 * Idempotency is enforced by the caller (LumiProvider) which fires it
 * exactly once per app launch.
 */
export async function fireHandshake(publisherId: string, sessionId: string): Promise<void> {
  if (!publisherId) return;
  const body = {
    event: 'impression',
    campaign_id: 'lumi_mobile_v0_handshake',
    session_id: sessionId,
    developer_id: publisherId,
    integration_method: DOOR,
    surface: 'mobile',
    placement_id: 'lumi_handshake',
    context: {
      sdk: SDK_NAME,
      sdk_version: SDK_VERSION,
      handshake: true,
    },
  };
  try {
    await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch (_e) { /* silent — handshake is best-effort */ }
}

/**
 * Fetch a single ad placement from /api/lumi-fetch.
 * Returns null on miss, network failure, or non-2xx response.
 */
export async function fetchAd(opts: FetchAdOpts): Promise<Ad | null> {
  if (!opts.publisherId) return null;
  const body = {
    publisher_id: opts.publisherId,
    door: DOOR,
    placement: opts.placement,
    context: opts.contextHint || 'mobile app',
    format: 'native',
    session_id: opts.sessionId,
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
 * Fire an impression beacon using the server-built impression_url.
 * RN's fetch handles this just fine; failures are silent.
 */
export function fireImpression(ad: Ad | null): void {
  if (!ad || !ad.impression_url) return;
  try {
    fetch(ad.impression_url, { method: 'GET' }).catch(() => {});
  } catch (_e) { /* silent */ }
}
