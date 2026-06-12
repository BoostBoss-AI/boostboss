-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — Onboarding questionnaire migration
-- ════════════════════════════════════════════════════════════════════════
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run.
-- Safe to re-run (uses IF NOT EXISTS).
--
-- WHAT THIS DOES
-- --------------
-- Adds questionnaire fields to advertisers + developers so we can ask new
-- signups (both email-password and Google OAuth) for context that informs
-- targeting, pricing, and outreach BEFORE they touch the dashboard.
--
-- The dashboard frontend gates user interaction (semi-transparent overlay
-- + required modal) until `onboarding_completed_at` is set. The questions
-- live in the dashboard, not in the signup form — so the same flow works
-- for OAuth users (who skip our signup form entirely).
--
-- ADVERTISER QUESTIONS
-- --------------------
-- a. industry — broad category of what they advertise
-- b. product_type — 'digital' | 'physical_goods' | 'services' | 'mix'
--                   | 'other'
--    digital_dau_range — only set if product_type='digital'; null otherwise
-- c. annual_revenue_range — used for tier-targeting + outreach prioritization
--
-- PUBLISHER QUESTIONS
-- -------------------
-- a. ai_app_category — 'entertainment' | 'educational' | 'productivity' |
--                      'developer_tools' | 'creative' | 'gaming' | 'health' |
--                      'finance' | 'customer_service' | 'research' | 'other'
-- b. surface_type — 'web_app' | 'mcp_server' | 'telegram_bot' | 'discord_bot' |
--                   'whatsapp_bot' | 'browser_extension' | 'mobile_app' |
--                   'desktop_app' | 'slack_teams' | 'voice' | 'other'
-- c. daily_users_range — DAU bucket
-- d. monetization_model — 'free' | 'freemium' | 'subscription' |
--                         'one_time_purchase' | 'mix' | 'other'
--
-- All columns NULLABLE — pre-pivot signups won't have answers; we only
-- enforce completion in the application layer via `onboarding_completed_at IS NULL`.
--
-- IDEMPOTENCY
-- -----------
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS is Postgres 9.6+. Running this
-- twice is a no-op. CHECK constraints are dropped+re-added to allow value
-- list updates without manual cleanup.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. ADVERTISERS — industry, product type, DAU (if digital), annual revenue
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.advertisers
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS digital_dau_range TEXT,
  ADD COLUMN IF NOT EXISTS annual_revenue_range TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- product_type allowed values
ALTER TABLE public.advertisers
  DROP CONSTRAINT IF EXISTS advertisers_product_type_check;
ALTER TABLE public.advertisers
  ADD CONSTRAINT advertisers_product_type_check
  CHECK (product_type IS NULL OR product_type IN (
    'digital', 'physical_goods', 'services', 'mix', 'other'
  ));

-- digital_dau_range allowed values (only used when product_type='digital')
ALTER TABLE public.advertisers
  DROP CONSTRAINT IF EXISTS advertisers_digital_dau_range_check;
ALTER TABLE public.advertisers
  ADD CONSTRAINT advertisers_digital_dau_range_check
  CHECK (digital_dau_range IS NULL OR digital_dau_range IN (
    'pre_launch', 'under_1k', '1k_10k', '10k_100k', '100k_1m', 'over_1m', 'other'
  ));

-- annual_revenue_range allowed values
ALTER TABLE public.advertisers
  DROP CONSTRAINT IF EXISTS advertisers_annual_revenue_range_check;
ALTER TABLE public.advertisers
  ADD CONSTRAINT advertisers_annual_revenue_range_check
  CHECK (annual_revenue_range IS NULL OR annual_revenue_range IN (
    'pre_revenue', 'under_10k', '10k_100k', '100k_1m',
    '1m_10m', '10m_100m', 'over_100m', 'prefer_not_to_say', 'other'
  ));

-- industry — keep as free-ish text but seed the canonical list in the UI.
-- We don't lock it down at DB layer because new industries appear faster
-- than we'd push migrations.

-- ────────────────────────────────────────────────────────────────────────
-- 2. DEVELOPERS (publishers) — AI category, surface, DAU, monetization
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.developers
  ADD COLUMN IF NOT EXISTS ai_app_category TEXT,
  ADD COLUMN IF NOT EXISTS surface_type TEXT,
  ADD COLUMN IF NOT EXISTS daily_users_range TEXT,
  ADD COLUMN IF NOT EXISTS monetization_model TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE public.developers
  DROP CONSTRAINT IF EXISTS developers_ai_app_category_check;
ALTER TABLE public.developers
  ADD CONSTRAINT developers_ai_app_category_check
  CHECK (ai_app_category IS NULL OR ai_app_category IN (
    'entertainment', 'educational', 'productivity', 'developer_tools',
    'creative', 'gaming', 'health', 'finance', 'customer_service',
    'research', 'other'
  ));

ALTER TABLE public.developers
  DROP CONSTRAINT IF EXISTS developers_surface_type_check;
ALTER TABLE public.developers
  ADD CONSTRAINT developers_surface_type_check
  CHECK (surface_type IS NULL OR surface_type IN (
    'web_app', 'mcp_server', 'telegram_bot', 'discord_bot',
    'whatsapp_bot', 'browser_extension', 'mobile_app',
    'desktop_app', 'slack_teams', 'voice', 'other'
  ));

ALTER TABLE public.developers
  DROP CONSTRAINT IF EXISTS developers_daily_users_range_check;
ALTER TABLE public.developers
  ADD CONSTRAINT developers_daily_users_range_check
  CHECK (daily_users_range IS NULL OR daily_users_range IN (
    'pre_launch', 'under_100', '100_1k', '1k_10k',
    '10k_100k', '100k_1m', 'over_1m', 'other'
  ));

ALTER TABLE public.developers
  DROP CONSTRAINT IF EXISTS developers_monetization_model_check;
ALTER TABLE public.developers
  ADD CONSTRAINT developers_monetization_model_check
  CHECK (monetization_model IS NULL OR monetization_model IN (
    'free', 'freemium', 'subscription', 'one_time_purchase', 'mix', 'other'
  ));

-- ────────────────────────────────────────────────────────────────────────
-- 3. Indexes for the most likely admin query patterns
-- ────────────────────────────────────────────────────────────────────────
-- Andy will filter the admin user list by these to find segments. Partial
-- indexes (only when value is set) keep the indexes small.

CREATE INDEX IF NOT EXISTS advertisers_industry_idx
  ON public.advertisers (industry) WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS advertisers_annual_revenue_range_idx
  ON public.advertisers (annual_revenue_range) WHERE annual_revenue_range IS NOT NULL;
CREATE INDEX IF NOT EXISTS developers_ai_app_category_idx
  ON public.developers (ai_app_category) WHERE ai_app_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS developers_surface_type_idx
  ON public.developers (surface_type) WHERE surface_type IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────
-- DONE.
-- ────────────────────────────────────────────────────────────────────────
--
-- Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'advertisers'
--     AND column_name IN ('industry','product_type','digital_dau_range',
--                         'annual_revenue_range','onboarding_completed_at');
--
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'developers'
--     AND column_name IN ('ai_app_category','surface_type','daily_users_range',
--                         'monetization_model','onboarding_completed_at');
