-- ────────────────────────────────────────────────────────────────────
-- MIGRATION: CPI (Cost-Per-Install) campaign type for AI app UA
-- 2026-06-20
--
-- Adds the three columns needed for AppLovin-style closed-loop AI app
-- user acquisition campaigns. CPI is mechanically identical to CPA
-- (charge advertiser on a postback-verified conversion event), but the
-- label lets dashboards report user-acquisition campaigns separately
-- and lets the auction frame the ad as "install this app" rather than
-- "buy this product."
--
-- Run in Supabase SQL Editor.
-- ────────────────────────────────────────────────────────────────────

-- App store / web app URL the user lands on when they click an install ad.
-- For mobile: https://apps.apple.com/... or https://play.google.com/...
-- For web AI apps: any signup/landing URL.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS app_store_url TEXT;

-- Optional postback URL the advertiser's backend / MMP will hit when an
-- installed user completes the install event. BB also accepts a pixel via
-- /api/conversions?bb_click=<id>; this column lets advertisers wire their
-- own server-side postback to confirm installs.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS install_postback_url TEXT;

-- The event name the advertiser's pixel/postback will use to mark an
-- install. Defaults to 'install' for CPI campaigns. Free-form so an
-- advertiser can model 'signup', 'first_run', 'activated', etc.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS install_event_name TEXT;

-- Constraint widening: allow 'cpi' in the billing_model enum if one
-- exists. Skip silently if the column is plain TEXT (current schema).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_billing_model_check'
  ) THEN
    ALTER TABLE campaigns DROP CONSTRAINT campaigns_billing_model_check;
    ALTER TABLE campaigns ADD CONSTRAINT campaigns_billing_model_check
      CHECK (billing_model IN ('cpm','cpc','cpv','cpa','cpi'));
  END IF;
END $$;

-- Helpful index for CPI reporting — queries like "show all my install
-- campaigns by spend" become a single index scan.
CREATE INDEX IF NOT EXISTS campaigns_cpi_idx
  ON campaigns (advertiser_id)
  WHERE billing_model = 'cpi';

COMMENT ON COLUMN campaigns.app_store_url IS
  'CPI campaigns: destination URL (App Store / Play Store / web app landing).';
COMMENT ON COLUMN campaigns.install_postback_url IS
  'CPI campaigns: optional server-to-server postback the advertiser hits to confirm installs.';
COMMENT ON COLUMN campaigns.install_event_name IS
  'CPI campaigns: event name the advertiser pixel uses to mark a confirmed install. Defaults to "install".';
