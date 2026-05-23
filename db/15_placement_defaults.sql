-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — INTERRUPTIVE PLACEMENTS OFF BY DEFAULT   (migration 15)
-- Apply with: paste into Supabase → SQL Editor.
--
-- The publisher dashboard groups ad formats into three placement families:
--   • AI-native   (native)            — gentle, on by default
--   • Display     (image, corner)     — gentle, on by default
--   • Interruptive & gated (video, fullscreen) — opt-in
--
-- New publishers should start with the interruptive family OFF so a fresh
-- integration never ambushes their users with fullscreen / video gates.
-- This only changes the column DEFAULT — it does NOT touch existing rows,
-- so current publishers keep whatever they already chose.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE developers ALTER COLUMN format_video      SET DEFAULT false;
ALTER TABLE developers ALTER COLUMN format_fullscreen SET DEFAULT false;

-- AI-native + Display stay on by default (no change needed):
--   format_native, format_image, format_corner remain DEFAULT true.
