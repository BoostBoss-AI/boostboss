-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — CAMPAIGN PLACEMENT TIER   (migration 16)
-- Apply with: paste into Supabase → SQL Editor.
--
-- One tier per campaign — the inventory class the campaign's budget buys:
--   • ai-native    — gentle, sponsored lines in AI responses (cheapest)
--   • display      — image / corner cards alongside content
--   • interruptive — video / fullscreen units (richest eCPM, opt-in supply)
--
-- The advertiser picks the tier in the New Campaign budget section. The
-- auction (api/mcp.js) only lets a campaign compete for inventory whose
-- publisher has that tier's format family enabled.
--
-- NULL is allowed and means "unrestricted" — campaigns created before this
-- migration keep competing everywhere, so nothing breaks.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS placement_tier TEXT
  CHECK (placement_tier IN ('ai-native', 'display', 'interruptive'));
