-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — MoR Storefront migration
-- ════════════════════════════════════════════════════════════════════════
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
--
-- WHAT THIS DOES
-- --------------
-- Stands up the schema for the Light Merchant-of-Record + voucher
-- redemption model. See [[mor-product-page-model]] memory for the full
-- architectural rationale.
--
--   1. products            +rich content fields (long_description, screenshots,
--                          FAQ, testimonials, demo_video_url, etc.) plus the
--                          MoR fields (price, currency, sku_type,
--                          fulfillment_redirect_url, fulfillment_webhook_url,
--                          redemption_window_days, package_duration_days,
--                          external_marketing_url)
--   2. transactions        every PayPal-mediated purchase, links
--                          (product, affiliate via bb_click, buyer email,
--                          PayPal order id, amount, status)
--   3. vouchers            redemption codes issued post-payment, status flow
--                          (issued → redeemed | refunded | expired)
--
-- ATTRIBUTION CHAIN (transaction → affiliate)
-- -------------------------------------------
-- Each transaction stores bb_click (the URL param the buyer arrived with).
-- bb_click resolves to affiliate_clicks → affiliate_id, share_link_id.
-- Affiliate commission is computed at capture time from
-- products.default_commission_pct so historical commissions don't drift
-- when the seller updates their rate later.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. PRODUCTS — extend with rich content + MoR fields
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.products
  -- Pricing (MoR core)
  ADD COLUMN IF NOT EXISTS price            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency         TEXT NOT NULL DEFAULT 'USD',
  -- 'one_time'           — single purchase, voucher grants forever access
  -- 'bundle'             — single purchase, voucher grants curated set of features
  -- 'lifetime'           — single payment for permanent access to ongoing service
  -- 'subscription_pack'  — single payment for N months/years of an otherwise-recurring product
  ADD COLUMN IF NOT EXISTS sku_type         TEXT NOT NULL DEFAULT 'one_time',

  -- Rich content (buyer-facing product page)
  ADD COLUMN IF NOT EXISTS long_description TEXT,           -- markdown supported
  ADD COLUMN IF NOT EXISTS screenshots      JSONB DEFAULT '[]'::jsonb,  -- array of URLs
  ADD COLUMN IF NOT EXISTS demo_video_url   TEXT,
  -- Free-form "what's included" structure: e.g.
  --   [{"label":"Lifetime access","included":true},
  --    {"label":"All future updates","included":true},
  --    {"label":"Priority support","included":false}]
  ADD COLUMN IF NOT EXISTS package_details  JSONB DEFAULT '[]'::jsonb,
  -- [{"q":"...","a":"..."}]
  ADD COLUMN IF NOT EXISTS faq              JSONB DEFAULT '[]'::jsonb,
  -- [{"author":"Jane Doe","role":"CTO at ACME","body":"..."}]
  ADD COLUMN IF NOT EXISTS testimonials     JSONB DEFAULT '[]'::jsonb,
  -- Seller's external marketing page — optional. When present, BB shows
  -- "Read full details on seller.com →" link. Tier 2/3 escape hatch.
  ADD COLUMN IF NOT EXISTS external_marketing_url TEXT,

  -- Fulfillment integration (seller's redemption + S2S webhook)
  ADD COLUMN IF NOT EXISTS fulfillment_redirect_url TEXT,    -- seller.com/bb-redeem
  ADD COLUMN IF NOT EXISTS fulfillment_webhook_url  TEXT,    -- S2S notification when sale clears
  ADD COLUMN IF NOT EXISTS fulfillment_webhook_secret TEXT,  -- HMAC key for webhook signature

  -- Voucher lifecycle config
  -- Days the voucher remains redeemable from issuance. Default 90 = industry
  -- standard for gift cards; some sellers may want 30 for time-sensitive offers.
  ADD COLUMN IF NOT EXISTS redemption_window_days INT NOT NULL DEFAULT 90,
  -- For sku_type='subscription_pack': how long the package grants access for.
  -- Set seller-side at redemption time so they know when to renew prompts.
  ADD COLUMN IF NOT EXISTS package_duration_days  INT;

-- SKU type allowlist
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sku_type_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_sku_type_check
  CHECK (sku_type IN ('one_time', 'bundle', 'lifetime', 'subscription_pack'));

-- Price bounds — sanity check, $0 - $100k. Higher than this should require
-- a manual review path.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_price_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_price_check
  CHECK (price IS NULL OR (price >= 0 AND price <= 100000));

CREATE INDEX IF NOT EXISTS products_advertiser_status_idx
  ON public.products (advertiser_id, status)
  WHERE status = 'active';

COMMENT ON COLUMN public.products.sku_type IS
  'one_time = single purchase forever. bundle = single purchase grants a '
  'curated set of features. lifetime = single payment for permanent access '
  'to ongoing service. subscription_pack = single payment for N months/years '
  'of an otherwise-recurring product. Affects voucher fulfillment payload.';

COMMENT ON COLUMN public.products.fulfillment_redirect_url IS
  'Seller-operated redemption page (e.g. seller.com/bb-redeem). Buyer is '
  'directed here after payment with ?code=<voucher>. Seller validates the '
  'code via BB API and provisions access. REQUIRED for active products.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. TRANSACTIONS — every BB-mediated purchase
-- ────────────────────────────────────────────────────────────────────────
--
-- One row per attempted purchase. Status flow:
--   pending     just created, PayPal Order pending capture
--   captured    PayPal captured the payment, money is in BB's account
--   refunded    payment was refunded (BB-initiated or PayPal dispute won)
--   settled     seller's portion has been paid out to them
--   failed     PayPal authorization or capture failed
--   cancelled   buyer abandoned at checkout
--
-- The (affiliate_id, product_id, advertiser_id) attribution chain is
-- denormalized from bb_click at insert time so the row stays valid even
-- if upstream tables change.

CREATE TABLE IF NOT EXISTS public.transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product + seller side
  product_id               UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  advertiser_id            UUID NOT NULL,  -- denormalized for fast advertiser dashboard queries

  -- Affiliate attribution (resolved from bb_click at insert)
  affiliate_id             UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  share_link_id            UUID REFERENCES public.affiliate_share_links(id) ON DELETE SET NULL,
  bb_click                 UUID,  -- preserved even if affiliate row is later deleted

  -- Buyer details (from checkout form + PayPal)
  buyer_email              TEXT NOT NULL,
  paypal_payer_email       TEXT,  -- might differ from buyer_email
  buyer_ip                 INET,

  -- PayPal references
  paypal_order_id          TEXT,   -- PayPal's Order id
  paypal_capture_id        TEXT,   -- PayPal's Capture id (from PAYMENT.CAPTURE.COMPLETED)

  -- Money breakdown (all USD-snapshotted at capture time)
  amount                   NUMERIC(12,2) NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'USD',
  commission_pct           NUMERIC(5,2) DEFAULT 0,   -- snapshot of product's rate
  affiliate_commission     NUMERIC(12,2) DEFAULT 0,  -- amount * commission_pct / 100
  bb_take_pct              NUMERIC(5,2) DEFAULT 15.00,
  bb_take                  NUMERIC(12,2) DEFAULT 0,  -- BB's cut
  seller_settlement        NUMERIC(12,2) DEFAULT 0,  -- what the seller gets net

  -- Status + lifecycle
  status                   TEXT NOT NULL DEFAULT 'pending',
  captured_at              TIMESTAMPTZ,
  refunded_at              TIMESTAMPTZ,
  settled_at               TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  failed_at                TIMESTAMPTZ,

  -- Voucher (set when transaction completes)
  voucher_id               UUID,   -- FK below, after vouchers table created

  -- Metadata + audit
  metadata                 JSONB DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'captured', 'refunded', 'settled', 'failed', 'cancelled'));

-- Lookup by PayPal order id when webhook fires
CREATE UNIQUE INDEX IF NOT EXISTS transactions_paypal_order_idx
  ON public.transactions (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

-- Per-affiliate purchase history (affiliate's Sales Report)
CREATE INDEX IF NOT EXISTS transactions_affiliate_idx
  ON public.transactions (affiliate_id, created_at DESC)
  WHERE affiliate_id IS NOT NULL;

-- Per-advertiser purchase history (seller's revenue dashboard)
CREATE INDEX IF NOT EXISTS transactions_advertiser_idx
  ON public.transactions (advertiser_id, created_at DESC);

-- Per-product purchase counts (per-share-link analytics)
CREATE INDEX IF NOT EXISTS transactions_product_idx
  ON public.transactions (product_id, created_at DESC);

-- Per-share-link counts (Q: "how many sales did affiliate A's link
-- AAAA generate?")
CREATE INDEX IF NOT EXISTS transactions_share_link_idx
  ON public.transactions (share_link_id, status)
  WHERE share_link_id IS NOT NULL;

-- Status sweep for settlement cron + refund recon
CREATE INDEX IF NOT EXISTS transactions_status_idx
  ON public.transactions (status, captured_at)
  WHERE status IN ('captured', 'pending');

COMMENT ON TABLE public.transactions IS
  'Every BB-mediated purchase. One row per checkout attempt. Status flows '
  'pending → captured → settled. Refunds and cancellations short-circuit. '
  'Attribution chain (affiliate, share_link) denormalized at insert via '
  'bb_click lookup. See [[mor-product-page-model]].';

-- ────────────────────────────────────────────────────────────────────────
-- 3. VOUCHERS — codes issued post-payment, redeemed by buyer on seller's site
-- ────────────────────────────────────────────────────────────────────────
--
-- Status flow:
--   issued     code generated, emailed to buyer, awaiting redemption
--   redeemed   seller's redemption page called BB API to confirm
--   refunded   buyer was refunded → voucher voided (regardless of redemption)
--   expired    redemption window elapsed without redemption
--   revoked    manually voided by admin or by seller (e.g. fraud detection)

CREATE TABLE IF NOT EXISTS public.vouchers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,

  -- The code shown to buyer + emailed + entered on seller's redemption page.
  -- Format: BB-XXXX-XXXX-XXXX (12 alphanumeric chars in groups of 4, hyphen-separated)
  -- Generated from a legibility-safe alphabet (no 0/O/1/l/I).
  code                TEXT NOT NULL UNIQUE,

  -- Denormalized for the seller's validation API call (so the API doesn't
  -- need to join through transactions to know which product this is for).
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  buyer_email         TEXT NOT NULL,

  -- Voucher type — most are paid_purchase but the schema reserves the
  -- review_copy/trial slots for Phase 2 (affiliate review-access requests).
  voucher_type        TEXT NOT NULL DEFAULT 'paid_purchase',

  -- Status + lifecycle
  status              TEXT NOT NULL DEFAULT 'issued',
  expires_at          TIMESTAMPTZ NOT NULL,   -- = now() + product.redemption_window_days
  redeemed_at         TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,

  -- Audit
  redeemer_ip         INET,                   -- IP that called the validation API
  redeemer_metadata   JSONB DEFAULT '{}'::jsonb,  -- buyer's info the seller passes back

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vouchers
  DROP CONSTRAINT IF EXISTS vouchers_status_check;
ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_status_check
  CHECK (status IN ('issued', 'redeemed', 'refunded', 'expired', 'revoked'));

ALTER TABLE public.vouchers
  DROP CONSTRAINT IF EXISTS vouchers_type_check;
ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_type_check
  CHECK (voucher_type IN ('paid_purchase', 'review_copy', 'trial', 'partner_perk'));

-- Lookups
CREATE UNIQUE INDEX IF NOT EXISTS vouchers_code_idx
  ON public.vouchers (code);

CREATE INDEX IF NOT EXISTS vouchers_transaction_idx
  ON public.vouchers (transaction_id);

CREATE INDEX IF NOT EXISTS vouchers_product_status_idx
  ON public.vouchers (product_id, status)
  WHERE status IN ('issued', 'redeemed');

-- Cron: sweep expired vouchers daily
CREATE INDEX IF NOT EXISTS vouchers_expiry_idx
  ON public.vouchers (status, expires_at)
  WHERE status = 'issued';

-- Now we can add the back-pointer FK from transactions to vouchers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_voucher_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_voucher_id_fkey
      FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON TABLE public.vouchers IS
  'Redemption codes issued to buyers after paid transactions. Seller validates '
  'via BB API at seller.com/bb-redeem then marks as redeemed. Expires per '
  'product.redemption_window_days. See [[mor-product-page-model]].';

-- ────────────────────────────────────────────────────────────────────────
-- 4. RLS — affiliates see own conversions, advertisers see own transactions
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_aff_read"  ON public.transactions;
DROP POLICY IF EXISTS "transactions_adv_read"  ON public.transactions;
DROP POLICY IF EXISTS "vouchers_buyer_read"    ON public.vouchers;

CREATE POLICY "transactions_aff_read"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = affiliate_id);

CREATE POLICY "transactions_adv_read"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = advertiser_id);

-- Vouchers are referenced by buyer_email (which isn't the buyer's auth.uid()
-- since buyers may be guests). RLS for buyer-facing voucher lookup happens
-- through the public validation API, not direct DB access. Service-role
-- bypasses all RLS so the API endpoints work.

-- ────────────────────────────────────────────────────────────────────────
-- 5. updated_at triggers
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_updated_at_trg ON public.transactions;
CREATE TRIGGER transactions_updated_at_trg
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_transactions_updated_at();

CREATE OR REPLACE FUNCTION public.tg_vouchers_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vouchers_updated_at_trg ON public.vouchers;
CREATE TRIGGER vouchers_updated_at_trg
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_vouchers_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- DONE.
-- ════════════════════════════════════════════════════════════════════════
--
-- Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'products'
--     AND column_name IN ('price','sku_type','fulfillment_redirect_url',
--                          'long_description','screenshots','package_details');
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN ('transactions','vouchers');
