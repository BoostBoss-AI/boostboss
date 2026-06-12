-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — Conversion tracking migration (#3 Commission Tracking)
-- ════════════════════════════════════════════════════════════════════════
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run.
-- Safe to re-run (uses IF NOT EXISTS).
--
-- WHAT THIS DOES
-- --------------
-- Adds the commission tracking layer between clicks and payouts.
-- See [[commission-attribution-model]] memory for full architecture.
--
--   1. affiliate_clicks.click_id     UUID column for URL-based attribution
--                                    (the bb_click=<UUID> param appended to
--                                    every share-link redirect)
--   2. affiliate_conversions         per-conversion log with full attribution
--                                    chain, commission_due, status, clawback
--
-- ATTRIBUTION FLOW
-- ----------------
-- Audience clicks /s/<token>
--   → backend mints click_id UUID, stores on affiliate_clicks row
--   → redirects to advertiser with ?bb_click=<click_id> appended
-- Audience converts on advertiser site
--   → advertiser fires trackConversion({bb_click, type, amount})
--   → backend looks up affiliate_clicks by click_id
--   → resolves (affiliate, share_link, product) tuple
--   → writes affiliate_conversions row with commission_due derived from
--     products.default_commission_pct
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. affiliate_clicks.click_id — load-bearing UUID for URL attribution
-- ────────────────────────────────────────────────────────────────────────
--
-- Until this migration, attribution relied on the bb_aff cookie which is
-- unreliable in modern browsers (Safari ITP, ad-blockers strip it). Now
-- every click row gets a stable UUID that's also appended to the target
-- URL as ?bb_click=<id>. Advertiser preserves it through their funnel as
-- a hidden form field and echoes it via trackConversion. Cookie is
-- demoted to a secondary fallback.

ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS click_id UUID DEFAULT gen_random_uuid();

-- Backfill any pre-existing click rows so they have an ID. The redirect
-- handler generates a fresh UUID for every NEW click, but historical rows
-- predating this migration need one for completeness.
UPDATE public.affiliate_clicks
   SET click_id = gen_random_uuid()
 WHERE click_id IS NULL;

ALTER TABLE public.affiliate_clicks
  ALTER COLUMN click_id SET NOT NULL;

-- Uniqueness + fast lookup by click_id. The postback handler queries by
-- this id on every conversion, so an index is critical for perf.
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_clicks_click_id_idx
  ON public.affiliate_clicks (click_id);

COMMENT ON COLUMN public.affiliate_clicks.click_id IS
  'UUID appended to the share-link redirect as ?bb_click=<id>. The '
  'advertiser preserves this param through their funnel and echoes it '
  'via trackConversion postback so we can match the conversion back '
  'to (affiliate, share_link, product). See [[commission-attribution-model]].';

-- ────────────────────────────────────────────────────────────────────────
-- 2. affiliate_conversions — the conversion log
-- ────────────────────────────────────────────────────────────────────────
--
-- One row per declared conversion event. The advertiser's trackConversion
-- call lands here after attribution resolution. Status flows:
--   pending     — just recorded, within clawback window
--   confirmed   — clawback window elapsed without refund
--   refunded    — advertiser reported refund within 30 days
--   paid        — included in a payout batch
--   orphan      — could not resolve attribution chain (no matching click)

CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Attribution chain (all nullable so an orphan can still be recorded
  -- with the raw bb_click for ops to investigate).
  click_id            UUID,
  affiliate_id        UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  share_link_id       UUID REFERENCES public.affiliate_share_links(id) ON DELETE SET NULL,
  product_id          UUID REFERENCES public.products(id) ON DELETE SET NULL,
  advertiser_id       UUID,  -- denormalized from product for fast advertiser-side queries
  -- Conversion event details supplied by the advertiser
  event_type          TEXT NOT NULL,                  -- 'signup' | 'purchase' | 'trial' | custom
  amount              NUMERIC(12, 2) DEFAULT 0,       -- gross purchase value in USD
  currency            TEXT DEFAULT 'USD',
  -- Commission computation
  commission_pct      NUMERIC(5, 2) DEFAULT 0,        -- snapshot of product's rate at conversion time
  commission_due      NUMERIC(12, 2) DEFAULT 0,       -- amount * commission_pct/100
  bb_take_pct         NUMERIC(5, 2) DEFAULT 15.00,    -- BB's take rate
  bb_take_due         NUMERIC(12, 2) DEFAULT 0,       -- separate line so payouts know what to keep
  -- Status + clawback window
  status              TEXT NOT NULL DEFAULT 'pending',
  clawback_until      TIMESTAMPTZ,                    -- after this date, conversion auto-confirms
  refunded_at         TIMESTAMPTZ,                    -- set if advertiser fires a refund postback
  paid_at             TIMESTAMPTZ,                    -- set when included in a payout batch
  payout_id           UUID,                           -- FK to payouts table (added in a later migration)
  -- Raw postback for audit
  idempotency_key     TEXT,                           -- prevent double-credit on advertiser retries
  metadata            JSONB DEFAULT '{}'::jsonb,      -- advertiser-supplied extra fields
  client_ip           INET,                           -- IP that fired the postback (advertiser-server-side)
  -- Bookkeeping
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_conversions
  DROP CONSTRAINT IF EXISTS affiliate_conversions_status_check;
ALTER TABLE public.affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_status_check
  CHECK (status IN ('pending', 'confirmed', 'refunded', 'paid', 'orphan'));

-- Dedupe on (advertiser, idempotency_key) so retries don't credit twice.
-- Idempotency_key is per-advertiser-namespace — different advertisers can
-- reuse the same string without colliding.
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_conversions_idem_idx
  ON public.affiliate_conversions (advertiser_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Per-affiliate listing — backs the Conversion Report dashboard view.
-- Ordered by created_at so the dashboard always shows newest first.
CREATE INDEX IF NOT EXISTS affiliate_conversions_affiliate_idx
  ON public.affiliate_conversions (affiliate_id, created_at DESC)
  WHERE affiliate_id IS NOT NULL;

-- Per-advertiser listing — backs the monthly commission bill aggregation.
CREATE INDEX IF NOT EXISTS affiliate_conversions_advertiser_idx
  ON public.affiliate_conversions (advertiser_id, created_at DESC)
  WHERE advertiser_id IS NOT NULL;

-- Status-bucket index for the clawback cron job + payout-eligibility query.
CREATE INDEX IF NOT EXISTS affiliate_conversions_status_idx
  ON public.affiliate_conversions (status, clawback_until)
  WHERE status IN ('pending', 'confirmed');

-- Lookup by click_id for the rare case of a duplicate postback that
-- arrives with the same bb_click — we want to detect those even without
-- an idempotency_key, to alert ops if the same click is being credited
-- multiple times.
CREATE INDEX IF NOT EXISTS affiliate_conversions_click_idx
  ON public.affiliate_conversions (click_id)
  WHERE click_id IS NOT NULL;

COMMENT ON TABLE public.affiliate_conversions IS
  'Per-conversion log driving commission accrual. Resolved attribution '
  '(affiliate, share_link, product) is denormalized at insert time so '
  'changes to share_links / products don''t retroactively alter historical '
  'commissions. status flows pending → confirmed (after clawback window) '
  '→ paid. refunded short-circuits the chain. orphan = no matching click. '
  'See [[commission-attribution-model]] for the full flow.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. RLS — affiliates see their own; advertisers see their own
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversions_aff_read"  ON public.affiliate_conversions;
DROP POLICY IF EXISTS "conversions_adv_read"  ON public.affiliate_conversions;

CREATE POLICY "conversions_aff_read"
  ON public.affiliate_conversions
  FOR SELECT
  USING (auth.uid() = affiliate_id);

CREATE POLICY "conversions_adv_read"
  ON public.affiliate_conversions
  FOR SELECT
  USING (auth.uid() = advertiser_id);

-- Writes go through service_role (postback handler bypasses RLS).

-- ────────────────────────────────────────────────────────────────────────
-- 4. updated_at trigger
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_affiliate_conversions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS affiliate_conversions_updated_at_trg ON public.affiliate_conversions;
CREATE TRIGGER affiliate_conversions_updated_at_trg
  BEFORE UPDATE ON public.affiliate_conversions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_affiliate_conversions_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- DONE.
-- ════════════════════════════════════════════════════════════════════════
--
-- Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'affiliate_clicks'
--     AND column_name = 'click_id';
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'affiliate_conversions';
