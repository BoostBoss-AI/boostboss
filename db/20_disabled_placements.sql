-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — PER-PLACEMENT PUBLISHER CONTROL   (migration 20)
-- Apply with: paste into Supabase → SQL Editor.
--
-- The publisher dashboard has two independent controls:
--   • Ad Formats     — which creative formats compete (format_* columns).
--   • Ad Placements  — which of the door's render surfaces are switched on.
--
-- This column backs the second one. It stores the door-qualified placement
-- keys a publisher has switched OFF — e.g. 'web-corner', 'mcp-citation'.
-- The key format matches the `surface` string every door already sends on
-- its ad request (web-/ext-/mcp-/bot- + placement), so the auction gate is
-- a plain set-membership check.
--
-- Empty array (the default) = all 16 core placements ON. The auction
-- (api/mcp.js) returns no-fill for any request whose surface is listed here.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE developers ADD COLUMN IF NOT EXISTS disabled_placements TEXT[] DEFAULT '{}';
