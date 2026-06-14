-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — Seller (advertiser) PayPal payout method
-- ──────────────────────────────────────────────────────────────────────
--
-- Sellers running products through MoR need a way to receive the money
-- BB collects on their behalf. Under the Taiwan-entity single-provider
-- rule (see [[taiwan_entity_single_provider]]), pay-in and pay-out both
-- go through PayPal. So one PayPal email per seller is enough — no bank
-- transfer fields needed.
--
-- Mirrors publisher_payout_methods structurally but lives in a separate
-- table because:
--   1. Different role (advertiser vs publisher)
--   2. Different cadence (sellers settle on the same biweekly Friday
--      cron but pull from storefront_transactions, not payout_requests)
--   3. Future: sellers may need separate tax/business fields publishers
--      don't (W-8/W-9 for US sellers, VAT IDs for EU, etc.)
--
-- Writes from the seller dashboard. Reads from the payout cron.
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.advertiser_payout_methods (
  advertiser_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paypal_email    text,
  display_name    text,                          -- "John Smith" or company name on payout statement
  country_code    text,                          -- ISO 3166-1 alpha-2 (for compliance routing)
  tax_form_status text DEFAULT 'not_required',   -- 'not_required' | 'pending' | 'verified'
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advertiser_payout_methods
  DROP CONSTRAINT IF EXISTS advertiser_payout_methods_paypal_email_format;
ALTER TABLE public.advertiser_payout_methods
  ADD CONSTRAINT advertiser_payout_methods_paypal_email_format
  CHECK (paypal_email IS NULL OR paypal_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

COMMENT ON TABLE public.advertiser_payout_methods IS
  'Seller PayPal payout details. BB sends settled funds to this email '
  'every biweekly Friday via PayPal Payouts API. See [[payouts_cycle]] '
  'and [[taiwan_entity_single_provider]].';
COMMENT ON COLUMN public.advertiser_payout_methods.paypal_email IS
  'Email PayPal will route the payout to. Verified by emailing the seller '
  'before the first payout — invalid emails get held in admin queue.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_advertiser_payout_methods_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS tg_advertiser_payout_methods_updated_at ON public.advertiser_payout_methods;
CREATE TRIGGER tg_advertiser_payout_methods_updated_at
  BEFORE UPDATE ON public.advertiser_payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.tg_advertiser_payout_methods_updated_at();

-- RLS — service role bypasses, advertisers manage their own row.
ALTER TABLE public.advertiser_payout_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advertiser_payout_methods_self_read  ON public.advertiser_payout_methods;
DROP POLICY IF EXISTS advertiser_payout_methods_self_write ON public.advertiser_payout_methods;

CREATE POLICY advertiser_payout_methods_self_read
  ON public.advertiser_payout_methods FOR SELECT TO authenticated
  USING (advertiser_id = auth.uid());

CREATE POLICY advertiser_payout_methods_self_write
  ON public.advertiser_payout_methods FOR ALL TO authenticated
  USING (advertiser_id = auth.uid())
  WITH CHECK (advertiser_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Track seller payouts dispatched. Separate from publisher payout_requests
-- so each side can evolve its lifecycle independently.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.advertiser_payouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount           numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency         text NOT NULL DEFAULT 'USD',
  status           text NOT NULL DEFAULT 'pending',
                   -- 'pending' | 'dispatched' | 'completed' | 'failed' | 'on_hold'
  paypal_email     text,
  paypal_batch_id  text,                          -- PayPal Payouts API batch id
  paypal_item_id   text,                          -- PayPal Payouts API per-recipient id
  transaction_ids  uuid[] DEFAULT '{}'::uuid[],   -- storefront_transactions rolled into this payout
  failure_reason   text,
  bank_snapshot    jsonb DEFAULT '{}'::jsonb,     -- snapshot of payout method at dispatch time
  dispatched_at    timestamptz,
  completed_at     timestamptz,
  failed_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advertiser_payouts
  DROP CONSTRAINT IF EXISTS advertiser_payouts_status_check;
ALTER TABLE public.advertiser_payouts
  ADD CONSTRAINT advertiser_payouts_status_check
  CHECK (status IN ('pending', 'dispatched', 'completed', 'failed', 'on_hold'));

CREATE INDEX IF NOT EXISTS advertiser_payouts_advertiser_idx
  ON public.advertiser_payouts (advertiser_id, created_at DESC);

CREATE INDEX IF NOT EXISTS advertiser_payouts_status_idx
  ON public.advertiser_payouts (status, created_at)
  WHERE status IN ('pending', 'dispatched');

COMMENT ON TABLE public.advertiser_payouts IS
  'Seller payout history. One row per dispatched batch; transaction_ids '
  'array records which storefront_transactions were rolled into it so '
  'we never double-pay a single sale.';

-- ─────────────────────────────────────────────────────────────────────
-- Add settled_to_advertiser_at column on storefront_transactions
-- so we know which captures have been settled to the seller already.
-- (Different from settled_at, which is the affiliate-side concept.)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.storefront_transactions
  ADD COLUMN IF NOT EXISTS advertiser_settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS advertiser_payout_id  uuid REFERENCES public.advertiser_payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS storefront_transactions_advertiser_unsettled_idx
  ON public.storefront_transactions (advertiser_id, captured_at)
  WHERE status = 'captured' AND advertiser_settled_at IS NULL;

COMMIT;

-- Smoke check:
--   SELECT count(*) FROM public.advertiser_payout_methods;
--   SELECT count(*) FROM public.advertiser_payouts;
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='storefront_transactions'
--      AND column_name IN ('advertiser_settled_at','advertiser_payout_id');
