-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — PUBLISHER BRAND SAFETY   (migration 18)
-- Apply with: paste into Supabase → SQL Editor.
--
-- Pass 2 of the settings rebuild. Account-level brand-safety controls for
-- publishers: a publisher can block whole advertiser categories (IAB codes)
-- and specific advertiser domains across ALL their inventory, instead of
-- configuring it per placement. The auction (api/mcp.js) unions these with
-- any per-placement exclusions when filtering candidate campaigns.
--   • blocked_categories          — IAB category codes the publisher refuses
--   • blocked_advertiser_domains  — advertiser domains the publisher refuses
-- Empty arrays (the default) mean "no account-level blocks".
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE developers ADD COLUMN IF NOT EXISTS blocked_categories         TEXT[] DEFAULT '{}';
ALTER TABLE developers ADD COLUMN IF NOT EXISTS blocked_advertiser_domains TEXT[] DEFAULT '{}';
