-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — Publisher calibration (cold-start, Phase 1)
-- See ai-team/specs/cold-start.md + build-roadmap.md.
-- A publisher in 'calibrating' status serves real ads but is NOT charged or
-- paid; impressions count toward graduation, then status flips to 'live'.
-- Default 'live' = every existing publisher and all billing behavior unchanged.
-- Idempotent — safe to re-run. Run in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.developers ADD COLUMN calibration_status text DEFAULT 'live'
    CHECK (calibration_status IN ('calibrating','live'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.developers ADD COLUMN impressions_calibrated integer DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.developers ADD COLUMN calibration_threshold integer DEFAULT 1000;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Activation (deliberate — NOT automatic) ──
-- New publisher signups should set calibration_status = 'calibrating'.
-- To start calibrating one publisher now:
--   UPDATE public.developers
--     SET calibration_status = 'calibrating', impressions_calibrated = 0
--     WHERE id = '<developer_id>';
