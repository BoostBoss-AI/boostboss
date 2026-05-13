/**
 * Boost Boss — per-campaign 7-day performance history (Phase C, 2026-05-11).
 *
 * This is the bridge that closes the data-collection → optimization loop.
 * Benna's scoreBid and scorePrice both read from this module to find out
 * how a campaign has actually performed before letting the targeting-overlap
 * weights decide the bid alone.
 *
 * Constraints:
 *   • The hot bid path (api/mcp.js) cannot afford N Supabase round-trips per
 *     auction. The cache key is campaign_id, the cache is in-process, and
 *     misses are batched into a single SQL query before any score is computed.
 *   • Sandbox events (is_sandbox=true) are excluded — sandbox CTR should
 *     never modulate production bids.
 *   • Campaigns with too little data are "cold" — caller falls back to the
 *     deterministic signal-overlap path.
 *
 * Exports:
 *   getCampaignHistoryBatch(sb, campaignIds) → Promise<Map<id, History>>
 *   _resetCache()                            — test hook
 *   MIN_WARM_IMPRESSIONS, TTL_MS             — tunables, exposed for tests
 */

const TTL_MS = 5 * 60 * 1000;            // 5 min in-process cache
const WINDOW_MS = 7 * 24 * 3600 * 1000;  // 7-day rollup window
const MIN_WARM_IMPRESSIONS = 100;        // below this, history is "cold"

// Map<campaign_id, History>
// History shape: { impressions, clicks, conversions, ctr, cvr, isWarm, fetchedAt }
const CACHE = new Map();

function freshEnough(entry) {
  return entry && (Date.now() - entry.fetchedAt) < TTL_MS;
}

function emptyHistory() {
  return {
    impressions: 0, clicks: 0, conversions: 0,
    ctr: null, cvr: null,
    isWarm: false,
    fetchedAt: Date.now(),
  };
}

function toHistory(raw) {
  const ctr = raw.impressions > 0 ? raw.clicks / raw.impressions : null;
  const cvr = raw.clicks > 0 ? raw.conversions / raw.clicks : null;
  return {
    impressions: raw.impressions,
    clicks:      raw.clicks,
    conversions: raw.conversions,
    ctr,
    cvr,
    isWarm:      raw.impressions >= MIN_WARM_IMPRESSIONS,
    fetchedAt:   Date.now(),
  };
}

/**
 * Fetch (or read from cache) the last-7-day performance for a list of
 * campaign IDs. Returns a Map<campaign_id, History> covering every input
 * id — even campaigns with no event rows get an empty cold-start entry.
 *
 * sb is a Supabase client. Pass null in demo/test mode to get all cold
 * histories without touching the network.
 */
async function getCampaignHistoryBatch(sb, campaignIds) {
  const ids = Array.isArray(campaignIds) ? campaignIds.filter(Boolean) : [];
  const out = new Map();
  const misses = [];

  for (const id of ids) {
    const cached = CACHE.get(id);
    if (freshEnough(cached)) {
      out.set(id, cached);
    } else {
      misses.push(id);
    }
  }

  if (misses.length === 0) return out;

  // Demo / no-Supabase mode: return cold-start entries.
  if (!sb) {
    for (const id of misses) {
      const h = emptyHistory();
      CACHE.set(id, h);
      out.set(id, h);
    }
    return out;
  }

  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();

  // One SQL query for all misses. We deliberately count rows here rather
  // than using a server-side aggregate so it stays portable across
  // Supabase versions and is trivial to dual-test in demo mode.
  let rows = [];
  try {
    const { data, error } = await sb.from("events")
      .select("campaign_id, event_type")
      .in("campaign_id", misses)
      .eq("is_sandbox", false)
      .gte("created_at", sinceIso);
    if (error) {
      console.error("bbx:campaign_history:query_fail",
        JSON.stringify({ tag: "campaign_history.fail", code: error.code, message: error.message }));
    } else {
      rows = data || [];
    }
  } catch (e) {
    console.error("bbx:campaign_history:throw",
      JSON.stringify({ tag: "campaign_history.throw", message: e && e.message }));
  }

  // Aggregate by campaign_id
  const raw = new Map();
  for (const id of misses) raw.set(id, { impressions: 0, clicks: 0, conversions: 0 });
  for (const row of rows) {
    const stats = raw.get(row.campaign_id);
    if (!stats) continue;
    if      (row.event_type === "impression") stats.impressions++;
    else if (row.event_type === "click")      stats.clicks++;
    else if (row.event_type === "conversion") stats.conversions++;
  }

  for (const [id, agg] of raw) {
    const h = toHistory(agg);
    CACHE.set(id, h);
    out.set(id, h);
  }
  return out;
}

function _resetCache() { CACHE.clear(); }

module.exports = {
  getCampaignHistoryBatch,
  _resetCache,
  MIN_WARM_IMPRESSIONS,
  TTL_MS,
  WINDOW_MS,
};
