-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — Pricing Plans + new commission model
-- ──────────────────────────────────────────────────────────────────────
--
-- WHAT THIS MIGRATION DOES
--
-- 1. Adds a `pricing_plans` table. One product can now offer multiple
--    price tiers (Annual Tier 1, Lifetime Tier 2, etc.), each with its
--    OWN audit-gated discount proof. Inspired by AppSumo's tier layout.
--
-- 2. Adds `affiliate_pool_pct` on `products`. This is the seller-set
--    percentage of each sale that funds the affiliate marketing pool.
--    Replaces the meaning of `default_commission_pct` (we keep the old
--    column for backward compat + backfill).
--
-- 3. NEW COMMISSION MODEL
--
--    order_amount    = the buyer pays this
--    affiliate_pool  = order_amount × affiliate_pool_pct      ← seller sets
--    seller_net      = order_amount − affiliate_pool          ← seller keeps the rest
--    bb_take         = affiliate_pool × 0.30                  ← BB takes 30% of the pool
--    affiliate_payout = affiliate_pool × 0.70                 ← affiliate gets 70% of the pool
--
--    BB no longer takes a top-line cut from the seller. BB's fee comes
--    ENTIRELY out of the seller's chosen affiliate marketing budget.
--    Seller's net goes up; the trade-off is that affiliate payouts now
--    scale with how much the seller allocates to affiliate marketing.
--
-- 4. AUDIT POLICY (the legitimacy moat)
--
--    For every pricing plan, the seller must:
--      - List the identical package on their OWN site at `original_price`
--      - Attach proof (URL + optional notes) in `original_price_proof_url`
--      - Wait for admin (Andy) to review via the audit queue
--    Only `audit_status = 'approved'` plans are purchasable on BB.
--    This is what justifies the "guaranteed discount" pitch.
--
-- 5. BACKFILL
--    Every existing product gets ONE default pricing plan derived from
--    its current `price`. Marked `audit_status = 'approved'` so legacy
--    products (like the Stripe Atlas test) keep working without manual
--    re-approval. New plans go through the audit queue.
--
-- See [[mor-product-page-model]] + the commission-policy discussion in
-- the corresponding chat session (2026-06-13).
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. New pricing_plans table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- ─── Plan identity ────────────────────────────────────────────────
  plan_name                   TEXT NOT NULL,        -- "Annual Tier 1", "Lifetime Tier 2"
  description                 TEXT,                 -- short subtitle under the plan card

  -- ─── Pricing ──────────────────────────────────────────────────────
  price                       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  original_price              NUMERIC(12,2),        -- seller's normal price (audited)
  currency                    TEXT NOT NULL DEFAULT 'USD',
  billing_period              TEXT NOT NULL DEFAULT 'one_time',
                              -- enforce in CHECK below

  -- ─── Audit gate (the legitimacy moat) ─────────────────────────────
  original_price_proof_url    TEXT,                 -- link to seller's own pricing page
  original_price_proof_notes  TEXT,                 -- seller's notes for the reviewer
  audit_status                TEXT NOT NULL DEFAULT 'pending',
                              -- enforce in CHECK below
  audit_reviewer_id           UUID,                 -- admin (Andy) who approved/rejected
  audit_reviewed_at           TIMESTAMPTZ,
  audit_review_notes          TEXT,                 -- internal notes from the reviewer

  -- ─── Marketing surface ────────────────────────────────────────────
  features                    JSONB NOT NULL DEFAULT '[]'::jsonb,
                                                    -- e.g. ["Unlimited foo", "10GB bar"]
  is_recommended              BOOLEAN NOT NULL DEFAULT false,

  -- ─── Lifecycle ────────────────────────────────────────────────────
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  sort_order                  INTEGER NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- billing_period enum-via-CHECK (matches the products.sku_type pattern;
-- avoids the brittleness of Postgres ENUMs for a small set we'll add to).
ALTER TABLE public.pricing_plans
  DROP CONSTRAINT IF EXISTS pricing_plans_billing_period_check;
ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_billing_period_check
  CHECK (billing_period IN ('one_time', 'monthly', 'annual', 'lifetime'));

ALTER TABLE public.pricing_plans
  DROP CONSTRAINT IF EXISTS pricing_plans_audit_status_check;
ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_audit_status_check
  CHECK (audit_status IN ('pending', 'approved', 'rejected', 'changes_requested'));

-- Per-product plan list lookup, ordered for the buyer-facing tier cards
CREATE INDEX IF NOT EXISTS pricing_plans_product_sort_idx
  ON public.pricing_plans (product_id, sort_order, created_at);

-- Admin audit queue: pull plans needing review in one query
CREATE INDEX IF NOT EXISTS pricing_plans_audit_queue_idx
  ON public.pricing_plans (audit_status, created_at)
  WHERE audit_status IN ('pending', 'changes_requested');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_pricing_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS tg_pricing_plans_updated_at ON public.pricing_plans;
CREATE TRIGGER tg_pricing_plans_updated_at
  BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_pricing_plans_updated_at();

COMMENT ON TABLE public.pricing_plans IS
  'Per-product price tiers. Each plan is independently audit-gated: seller must list the '
  'identical package at original_price on their own site and attach proof. Only plans with '
  'audit_status=approved are purchasable on BB. See migration header for the new commission model.';

COMMENT ON COLUMN public.pricing_plans.original_price IS
  'The price the seller charges on their own site for this exact package. Must be > price '
  '(the BB price is the discount). Audited manually by admin against original_price_proof_url.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. products: add affiliate_pool_pct (the seller-set marketing %)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS affiliate_pool_pct NUMERIC(5,2);

-- Carry forward the old default_commission_pct value (same number, new
-- semantic meaning). Sellers can update this in the dashboard later.
UPDATE public.products
  SET affiliate_pool_pct = COALESCE(default_commission_pct, 15.00)
  WHERE affiliate_pool_pct IS NULL;

-- Reasonable bounds so we don't end up with 200% commission pools
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_affiliate_pool_pct_range;
ALTER TABLE public.products
  ADD CONSTRAINT products_affiliate_pool_pct_range
  CHECK (affiliate_pool_pct IS NULL OR (affiliate_pool_pct >= 0 AND affiliate_pool_pct <= 80));

COMMENT ON COLUMN public.products.affiliate_pool_pct IS
  'Seller-set %% of each sale that funds the affiliate marketing pool. '
  'BB takes 30%% of the pool, affiliate gets 70%%. Seller keeps (100 - pool_pct)%%. '
  'Replaces default_commission_pct semantically; the old column is kept for backward compat.';

-- Keep affiliate_pool_pct and default_commission_pct in sync on writes —
-- so the existing advertiser dashboard form (which still writes the old
-- column name) transparently updates the new column. Removed when Pass 3
-- ships the new pricing-plans UI that writes affiliate_pool_pct directly.
CREATE OR REPLACE FUNCTION public.tg_products_sync_pool_pct()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- If the writer set default_commission_pct but not affiliate_pool_pct,
  -- propagate. If they set affiliate_pool_pct, propagate to the legacy
  -- column. If they set both, trust affiliate_pool_pct (the new field).
  IF (NEW.affiliate_pool_pct IS DISTINCT FROM OLD.affiliate_pool_pct)
     AND NEW.affiliate_pool_pct IS NOT NULL THEN
    NEW.default_commission_pct := NEW.affiliate_pool_pct;
  ELSIF (NEW.default_commission_pct IS DISTINCT FROM OLD.default_commission_pct)
        AND NEW.default_commission_pct IS NOT NULL THEN
    NEW.affiliate_pool_pct := NEW.default_commission_pct;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tg_products_sync_pool_pct ON public.products;
CREATE TRIGGER tg_products_sync_pool_pct
  BEFORE UPDATE OF affiliate_pool_pct, default_commission_pct ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_products_sync_pool_pct();

-- ─────────────────────────────────────────────────────────────────────
-- 3. Backfill: every existing product gets a default pricing plan
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.pricing_plans (
  product_id, plan_name, price, original_price, currency, billing_period,
  audit_status, is_active, is_recommended, sort_order, features
)
SELECT
  p.id,
  -- Sensible default plan name based on the product's sku_type
  CASE p.sku_type
    WHEN 'lifetime'          THEN 'Lifetime'
    WHEN 'subscription_pack' THEN 'Annual'
    WHEN 'bundle'            THEN 'Bundle'
    ELSE 'Standard'
  END,
  COALESCE(p.price, 0),
  NULL,  -- original_price not known for legacy products
  COALESCE(p.currency, 'USD'),
  CASE p.sku_type
    WHEN 'lifetime'          THEN 'lifetime'
    WHEN 'subscription_pack' THEN 'annual'
    ELSE 'one_time'
  END,
  -- Existing products auto-approved so the test transactions keep working
  'approved',
  true,
  true,
  0,
  '[]'::jsonb
FROM public.products p
WHERE p.price IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.pricing_plans pp WHERE pp.product_id = p.id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. storefront_transactions: track which plan was bought + pool amount
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.storefront_transactions
  ADD COLUMN IF NOT EXISTS pricing_plan_id UUID REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_pool NUMERIC(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS storefront_transactions_pricing_plan_idx
  ON public.storefront_transactions (pricing_plan_id)
  WHERE pricing_plan_id IS NOT NULL;

COMMENT ON COLUMN public.storefront_transactions.affiliate_pool IS
  'Dollar amount of the seller-allocated affiliate marketing pool for this sale. '
  'bb_take = affiliate_pool × 0.30, affiliate_commission = affiliate_pool × 0.70. '
  'Stored separately from bb_take + affiliate_commission so the split is auditable.';

-- Existing rows had bb_take_pct=15 (old top-line model). Under the new
-- model bb_take is no longer a fixed % of gross — it's a fixed 30% of
-- the affiliate pool. Don't backfill these legacy rows: they were
-- already settled (or close to it) under the old model. Going forward,
-- new rows are computed under the new model.

-- ─────────────────────────────────────────────────────────────────────
-- 5. RLS — pricing_plans
--    Service role bypasses RLS entirely (used by /api endpoints), so
--    these policies primarily protect direct PostgREST access if it
--    ever gets exposed.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

-- Public can read approved + active plans (for the buyer-facing
-- product page if it ever queries Supabase directly).
DROP POLICY IF EXISTS pricing_plans_public_read ON public.pricing_plans;
CREATE POLICY pricing_plans_public_read
  ON public.pricing_plans
  FOR SELECT
  USING (audit_status = 'approved' AND is_active = true);

-- Advertisers (product owners) can read/write their own plans.
DROP POLICY IF EXISTS pricing_plans_owner_all ON public.pricing_plans;
CREATE POLICY pricing_plans_owner_all
  ON public.pricing_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = pricing_plans.product_id
        AND p.advertiser_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = pricing_plans.product_id
        AND p.advertiser_id = auth.uid()
    )
  );

COMMIT;

-- ──────────────────────────────────────────────────────────────────────
-- Smoke-check queries (run by hand after migration)
-- ──────────────────────────────────────────────────────────────────────
--
-- Verify backfill: every product with a price should now have exactly
-- one approved pricing_plan:
--
--   SELECT p.id, p.name, p.price, count(pp.id) AS plans,
--          string_agg(pp.audit_status, ',') AS audit_statuses
--   FROM public.products p
--   LEFT JOIN public.pricing_plans pp ON pp.product_id = p.id
--   WHERE p.price IS NOT NULL
--   GROUP BY p.id, p.name, p.price
--   ORDER BY p.created_at DESC;
--
-- Spot-check a single product (Stripe Atlas in the test data):
--
--   SELECT id, plan_name, price, original_price, billing_period,
--          audit_status, is_active, is_recommended, sort_order
--   FROM public.pricing_plans
--   WHERE product_id = '07a7cac5-fe74-4115-ae90-b26eb137592f';
--
-- ──────────────────────────────────────────────────────────────────────
