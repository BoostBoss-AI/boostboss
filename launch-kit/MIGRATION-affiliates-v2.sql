-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — Affiliate v2 onboarding migration
-- ════════════════════════════════════════════════════════════════════════
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run.
-- Safe to re-run (uses IF NOT EXISTS).
--
-- WHAT THIS DOES
-- --------------
-- Extends the affiliates table to support the multi-step onboarding flow
-- (modeled on Shopee Affiliates). Replaces the v1 "email + password only"
-- signup with structured fields about WHO the affiliate is, WHERE they
-- promote, and HOW BIG their audience is. This is what powers:
--   - The marketplace's "best fit for your audience" routing
--   - Per-channel reporting (where shares + clicks come from)
--   - Quality gating (manually-verified vs auto-approved affiliates)
--   - Outreach (we know which affiliates have which audience size)
--
-- ENUM-STYLE COLUMNS
-- ------------------
-- All free-text-ish columns get a CHECK constraint enforcing a known
-- vocabulary, with "other" as an escape valve so users unsure how to
-- categorize aren't blocked.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. New columns on affiliates
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS account_type           TEXT,
  ADD COLUMN IF NOT EXISTS primary_platform       TEXT,
  ADD COLUMN IF NOT EXISTS platform_handle        TEXT,
  ADD COLUMN IF NOT EXISTS followers_range        TEXT,
  ADD COLUMN IF NOT EXISTS audience_topic         TEXT,
  ADD COLUMN IF NOT EXISTS phone                  TEXT,
  ADD COLUMN IF NOT EXISTS referral_code_used     TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- account_type: individual creator vs registered enterprise
ALTER TABLE public.affiliates
  DROP CONSTRAINT IF EXISTS affiliates_account_type_check;
ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_account_type_check
  CHECK (account_type IS NULL OR account_type IN ('individual', 'enterprise'));

-- primary_platform: where the affiliate mainly distributes
ALTER TABLE public.affiliates
  DROP CONSTRAINT IF EXISTS affiliates_primary_platform_check;
ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_primary_platform_check
  CHECK (primary_platform IS NULL OR primary_platform IN (
    'twitter', 'tiktok', 'youtube', 'instagram', 'reddit',
    'discord', 'telegram', 'linkedin', 'newsletter', 'blog',
    'podcast', 'twitch', 'other'
  ));

-- followers_range: audience size bucket
ALTER TABLE public.affiliates
  DROP CONSTRAINT IF EXISTS affiliates_followers_range_check;
ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_followers_range_check
  CHECK (followers_range IS NULL OR followers_range IN (
    'under_1k', '1k_10k', '10k_100k', '100k_1m', 'over_1m', 'other'
  ));

-- audience_topic: what kind of content they make / what their audience cares about
-- Free text in the DB (variety is too wide for an enum) but the UI offers a
-- canonical list with an "other" escape.

-- ────────────────────────────────────────────────────────────────────────
-- 2. Index helpers — admin will filter affiliates by these
-- ────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS affiliates_primary_platform_idx
  ON public.affiliates (primary_platform) WHERE primary_platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS affiliates_followers_range_idx
  ON public.affiliates (followers_range) WHERE followers_range IS NOT NULL;
CREATE INDEX IF NOT EXISTS affiliates_onboarding_completed_at_idx
  ON public.affiliates (onboarding_completed_at)
  WHERE onboarding_completed_at IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════
-- DONE.
-- ════════════════════════════════════════════════════════════════════════
--
-- Verify:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'affiliates' ORDER BY ordinal_position;
