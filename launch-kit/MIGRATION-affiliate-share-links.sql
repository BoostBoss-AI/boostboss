-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — Affiliate share-links migration
-- ════════════════════════════════════════════════════════════════════════
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run.
-- Safe to re-run (uses IF NOT EXISTS).
--
-- WHAT THIS DOES
-- --------------
-- Adds the share-link layer between saved ads and end-audience clicks.
-- Each affiliate gets a tokenized URL per saved ad — paste it on Twitter,
-- TikTok, a newsletter, anywhere — and we redirect through Boost Boss to
-- the advertiser's target URL while:
--   1. logging the click (for analytics on the affiliate dashboard)
--   2. setting an attribution cookie for future conversion tracking
--
-- This is the predecessor to commission tracking (#3): without share-link
-- click rows, we have nothing to attribute conversions back to.
--
-- IDEMPOTENCY
-- -----------
-- One share_link per (affiliate_id, saved_ad_id) — re-clicking "Get share
-- link" returns the same token. The UNIQUE constraint enforces that.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. affiliate_share_links — one per (affiliate, saved_ad)
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affiliate_share_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  saved_ad_id     UUID NOT NULL REFERENCES public.affiliate_saved_ads(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  -- Snapshot of where this link redirects to at mint time. We snapshot here
  -- (instead of joining to saved_ads.target_url on every redirect) because
  -- (a) it's stable — if the saved_ad row gets edited or archived, the
  -- already-shared link keeps working, and (b) the redirect path becomes
  -- a single-row lookup with no join.
  target_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  click_count     INT  NOT NULL DEFAULT 0,
  last_click_at   TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);

-- One link per (affiliate, saved_ad). Re-minting returns the existing
-- token via ON CONFLICT in the backend's INSERT statement.
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_share_links_affiliate_savedad_idx
  ON public.affiliate_share_links (affiliate_id, saved_ad_id);

CREATE INDEX IF NOT EXISTS affiliate_share_links_affiliate_created_idx
  ON public.affiliate_share_links (affiliate_id, created_at DESC);

COMMENT ON TABLE public.affiliate_share_links IS
  'Tokenized URLs per (affiliate, saved_ad). The token is what shows up '
  'in boostboss.ai/s/<token> URLs the affiliate pastes everywhere. '
  'click_count is a denormalized counter for the dashboard so we do not '
  'need to COUNT(*) over affiliate_clicks on every page load.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. affiliate_clicks — append-only log of each redirect
-- ────────────────────────────────────────────────────────────────────────
--
-- Every visit to /s/<token> creates a row here. We use it for:
--   - per-link analytics
--   - per-channel breakdown (referrer)
--   - fraud detection (self-clicks, bots)
--   - conversion attribution (later: when a postback comes in, match the
--     conversion to the most recent click within the cookie window)

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id   UUID NOT NULL REFERENCES public.affiliate_share_links(id) ON DELETE CASCADE,
  affiliate_id    UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  saved_ad_id     UUID,  -- denormalized from share_link, for quick filters
  clicked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip              INET,
  user_agent      TEXT,
  referrer        TEXT,
  country_code    TEXT
);

CREATE INDEX IF NOT EXISTS affiliate_clicks_affiliate_clicked_idx
  ON public.affiliate_clicks (affiliate_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_clicks_share_link_idx
  ON public.affiliate_clicks (share_link_id, clicked_at DESC);

COMMENT ON TABLE public.affiliate_clicks IS
  'Append-only log of every share-link redirect. Used for per-link click '
  'analytics, conversion attribution (matching postback events back to a '
  'click within the cookie window), and fraud detection. Never updated.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. RPC to atomically bump click_count + last_click_at
-- ────────────────────────────────────────────────────────────────────────
--
-- The redirect endpoint calls this so the counter increment is atomic
-- and concurrent clicks don't race. Returns the row's target_url so the
-- handler can do the lookup + bump in one round trip.

CREATE OR REPLACE FUNCTION public.bbx_bump_share_link_click(
  p_token TEXT
)
RETURNS TABLE(
  id            UUID,
  affiliate_id  UUID,
  saved_ad_id   UUID,
  target_url    TEXT,
  revoked_at    TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE public.affiliate_share_links sl
  SET click_count   = sl.click_count + 1,
      last_click_at = now()
  WHERE sl.token = p_token
    AND sl.revoked_at IS NULL
  RETURNING sl.id, sl.affiliate_id, sl.saved_ad_id, sl.target_url, sl.revoked_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────────────
-- 4. RLS — affiliates see only their own data
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.affiliate_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "share_links_own"  ON public.affiliate_share_links;
DROP POLICY IF EXISTS "clicks_own_read"  ON public.affiliate_clicks;

CREATE POLICY "share_links_own"
  ON public.affiliate_share_links
  FOR ALL
  USING (auth.uid() = affiliate_id);

CREATE POLICY "clicks_own_read"
  ON public.affiliate_clicks
  FOR SELECT
  USING (auth.uid() = affiliate_id);

-- ════════════════════════════════════════════════════════════════════════
-- DONE.
-- ════════════════════════════════════════════════════════════════════════
--
-- Verify:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('affiliate_share_links', 'affiliate_clicks');
--
--   SELECT proname FROM pg_proc WHERE proname = 'bbx_bump_share_link_click';
