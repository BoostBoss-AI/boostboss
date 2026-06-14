-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — Pending migrations bundle (paste once, run once)
-- ════════════════════════════════════════════════════════════════════════
--
-- Generated 2026-06-12 to bundle the two outstanding migrations that
-- never got pasted into Supabase. Both are idempotent and safe to re-run.
--
-- Contains, in order:
--   1) Onboarding questionnaire fields on advertisers + developers
--      (fixes the "Could not find 'annual_revenue_range' column" error
--       blocking the advertiser dashboard modal)
--   2) Products table + campaigns.product_id + affiliate_saved_ads.product_id
--      + makes affiliate_share_links.saved_ad_id NULLable + adds .product_id
--      (unblocks the new Products section + Get Link from catalog + Custom
--       Link from arbitrary URLs)
--
-- Run instructions:
--   Supabase Dashboard → SQL Editor → New query → paste this whole file
--   → Run. Should take < 5 seconds. No data is mutated — only schema
--   changes (new columns + indexes + constraints + RLS policies).
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- ▼▼▼  PART 1 OF 2: ONBOARDING QUESTIONNAIRE  ▼▼▼
-- ════════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════════
-- ▼▼▼  PART 2 OF 2: PRODUCTS + SHARE-LINK EXTENSIONS  ▼▼▼
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — Products migration
-- ════════════════════════════════════════════════════════════════════════
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run.
-- Safe to re-run (uses IF NOT EXISTS).
--
-- WHAT THIS DOES
-- --------------
-- Adds Products as a first-class parent entity above Campaigns. TikTok
-- Shop seller analog — an advertiser registers a Product once, then runs
-- many campaigns/promos against the same product over time. Affiliates
-- save by Product (deduped), so the affiliate's saved list stays clean
-- even if the advertiser rotates campaigns.
--
-- RELATIONSHIPS
-- -------------
--   products          (one per real-world thing the advertiser sells)
--   campaigns         → ADD product_id (nullable for backwards compat)
--   affiliate_saved_ads → ADD product_id (resolved at save time so the
--                         affiliate's saved list groups by product)
--
-- Why product_id is NULLable on both:
--   - existing campaigns predate products; we don't want to break them
--   - affiliate_saved_ads rows that pre-date this migration won't have
--     a resolvable product (the campaign they were saved from might not
--     have one either)
-- The Products dashboard, share-link redirect, and affiliate browse all
-- handle the NULL gracefully — they treat campaigns/saves without a
-- product as "standalone, no product attached".
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. products — parent entity
-- ────────────────────────────────────────────────────────────────────────
--
-- The advertiser registers a Product before (or alongside) creating their
-- first campaign for it. The Product carries the canonical name, image,
-- destination URL, and DEFAULT commission rate that the affiliate sees.
-- Individual campaigns can override the commission, but the product-level
-- value is the rate the marketplace lists and the affiliate sorts by.

CREATE TABLE IF NOT EXISTS public.products (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id            UUID NOT NULL,  -- FK to auth.users; not REFERENCES (auth schema is special)
  name                     TEXT NOT NULL,
  description              TEXT,
  image_url                TEXT,
  -- Canonical destination URL for the product. Individual campaigns may
  -- override (e.g. a specific landing page for a promo), but absent an
  -- override the share-link redirect uses this.
  default_url              TEXT NOT NULL,
  -- Commission rate (0.00 – 100.00) the affiliate earns per converting
  -- visitor. Used for marketplace sorting and the default applied when
  -- attribution lands. Stored as percent for readability (5.00 = 5%).
  default_commission_pct   NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  -- Status: 'active' = visible to affiliates; 'archived' = hidden but
  -- preserved for historical attribution. Soft-delete only; never DROP.
  status                   TEXT NOT NULL DEFAULT 'active',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('active', 'archived'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_commission_pct_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_commission_pct_check
  CHECK (default_commission_pct >= 0 AND default_commission_pct <= 100);

CREATE INDEX IF NOT EXISTS products_advertiser_created_idx
  ON public.products (advertiser_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_status_idx
  ON public.products (status) WHERE status = 'active';

COMMENT ON TABLE public.products IS
  'Parent entity above campaigns. One product (the real-world thing the '
  'advertiser sells) can have many campaigns over time. Affiliates save '
  'and share by product, so links stay durable across campaign churn.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. campaigns.product_id — optional FK back to the parent product
-- ────────────────────────────────────────────────────────────────────────
--
-- Nullable for backwards compat. Existing campaigns without a product
-- keep working; new campaigns the advertiser creates should pick one.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS product_id UUID;

-- Add the FK constraint separately so it can be re-run safely (Postgres
-- doesn't have a clean "ADD CONSTRAINT IF NOT EXISTS" for FKs).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_product_id_fkey'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaigns_product_id_idx
  ON public.campaigns (product_id) WHERE product_id IS NOT NULL;

COMMENT ON COLUMN public.campaigns.product_id IS
  'FK to the parent product. NULL for legacy campaigns predating Products. '
  'The advertiser dashboard prompts to pick a product when creating new ones.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. affiliate_saved_ads.product_id — resolved at save time
-- ────────────────────────────────────────────────────────────────────────
--
-- When the SDK calls affiliate_save_ad, the backend now looks up the
-- campaign's product_id and writes it here. The affiliate dashboard
-- groups My Saves by product (one card per product, expandable to show
-- all active campaigns underneath).
--
-- Nullable because: (a) campaigns without products exist, (b) backfilling
-- historical saves would require joining back to campaigns and would lose
-- data for any save whose campaign has since been deleted.

ALTER TABLE public.affiliate_saved_ads
  ADD COLUMN IF NOT EXISTS product_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_saved_ads_product_id_fkey'
  ) THEN
    ALTER TABLE public.affiliate_saved_ads
      ADD CONSTRAINT affiliate_saved_ads_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS affiliate_saved_ads_product_id_idx
  ON public.affiliate_saved_ads (affiliate_id, product_id)
  WHERE product_id IS NOT NULL;

-- Idempotent re-save: one (affiliate, product) row only. The backend
-- handles the upsert; the unique constraint enforces it at the DB layer.
-- We DON'T add this until the backend is wired up — adding it now would
-- silently dupe-drop any in-flight save calls. Commented for the follow-up
-- migration that ships with the backend changes.
--
-- ALTER TABLE public.affiliate_saved_ads
--   ADD CONSTRAINT affiliate_saved_ads_unique_per_product
--   UNIQUE (affiliate_id, product_id) DEFERRABLE INITIALLY DEFERRED;

COMMENT ON COLUMN public.affiliate_saved_ads.product_id IS
  'The product this save resolves to. Populated by affiliate_save_ad at '
  'save time by looking up campaign.product_id. NULL if the campaign has '
  'no parent product, or for historical saves predating Products.';

-- ────────────────────────────────────────────────────────────────────────
-- 3b. affiliate_share_links — saved_ad_id becomes optional + product_id added
-- ────────────────────────────────────────────────────────────────────────
--
-- The share-links table was originally minted-from-saved-ad only. Two new
-- paths are now supported:
--
--   (a) Catalog "Get Link" — mints from a product_id directly (no save
--       required). Lets affiliates browse the public catalog and grab a
--       tracked URL without first bookmarking an ad render.
--
--   (b) Custom Link — mints from an arbitrary advertiser URL (target_url
--       only, neither saved_ad nor product). For URLs that aren't in the
--       catalog yet — brand deals, beta links, etc.
--
-- The legacy SDK-bookmark path still works (saved_ad_id is set).

-- Make saved_ad_id NULLable. Without this, the Custom Link / Catalog paths
-- can't insert a row that has no saved_ad backing.
ALTER TABLE public.affiliate_share_links
  ALTER COLUMN saved_ad_id DROP NOT NULL;

ALTER TABLE public.affiliate_share_links
  ADD COLUMN IF NOT EXISTS product_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_share_links_product_id_fkey'
  ) THEN
    ALTER TABLE public.affiliate_share_links
      ADD CONSTRAINT affiliate_share_links_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS affiliate_share_links_product_idx
  ON public.affiliate_share_links (affiliate_id, product_id)
  WHERE product_id IS NOT NULL;

COMMENT ON COLUMN public.affiliate_share_links.product_id IS
  'Set when the affiliate mints a share link by clicking "Get Link" in '
  'the Product Catalog. NULL for SDK-save mints (which set saved_ad_id) '
  'and Custom Link mints (which set neither and rely on target_url).';

-- ────────────────────────────────────────────────────────────────────────
-- 4. RLS — advertisers see only their own products
-- ────────────────────────────────────────────────────────────────────────
--
-- Note: backend uses service_role for all CRUD, so RLS is a belt-and-
-- suspenders layer for any direct anon-key access (e.g. future client
-- libraries that talk to PostgREST directly).

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_read_own"    ON public.products;
DROP POLICY IF EXISTS "products_modify_own"  ON public.products;
DROP POLICY IF EXISTS "products_read_active" ON public.products;

CREATE POLICY "products_read_own"
  ON public.products
  FOR SELECT
  USING (auth.uid() = advertiser_id);

CREATE POLICY "products_modify_own"
  ON public.products
  FOR ALL
  USING (auth.uid() = advertiser_id);

-- Affiliates and the marketplace need to see active products from ANY
-- advertiser (that's the whole point of the marketplace). Read-only.
CREATE POLICY "products_read_active"
  ON public.products
  FOR SELECT
  USING (status = 'active');

-- ────────────────────────────────────────────────────────────────────────
-- 5. updated_at trigger on products
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at_trg ON public.products;
CREATE TRIGGER products_updated_at_trg
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_products_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- DONE.
-- ════════════════════════════════════════════════════════════════════════
--
-- Verify:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'products';
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'product_id';
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'affiliate_saved_ads' AND column_name = 'product_id';
