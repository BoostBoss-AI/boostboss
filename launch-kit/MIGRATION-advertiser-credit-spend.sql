-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — advertiser_credit_spend: track ad-credit deductions
-- ──────────────────────────────────────────────────────────────────────
-- Phase 3 of the Promote / ad credit flow. Phases 1-2 let sellers convert
-- MoR earnings into a credit pool; Phase 3 lets them actually spend that
-- pool on campaigns.
--
-- Available credit at any moment =
--   SUM(advertiser_payouts.amount  WHERE status='credited')
-- − SUM(advertiser_credit_spend.amount)
--
-- One row per spend (per campaign creation, or per future per-impression
-- billing tick if we later move to fine-grained metering).
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.advertiser_credit_spend (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id     uuid,                          -- references campaigns(id); no FK to keep
                                                  -- referential ownership flexible
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  currency        text NOT NULL DEFAULT 'USD',
  note            text,                          -- e.g. 'campaign:Stripe Atlas launch'
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advertiser_credit_spend_advertiser_idx
  ON public.advertiser_credit_spend (advertiser_id, created_at DESC);

CREATE INDEX IF NOT EXISTS advertiser_credit_spend_campaign_idx
  ON public.advertiser_credit_spend (campaign_id)
  WHERE campaign_id IS NOT NULL;

COMMENT ON TABLE public.advertiser_credit_spend IS
  'Deductions from the ad-credit pool. Available credit = sum of credited '
  'advertiser_payouts minus sum of these rows. Created when a campaign is '
  'funded from credit (Phase 3 of Promote).';

-- RLS — self-read; writes only via service role (server endpoints)
ALTER TABLE public.advertiser_credit_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS advertiser_credit_spend_self_read ON public.advertiser_credit_spend;
CREATE POLICY advertiser_credit_spend_self_read
  ON public.advertiser_credit_spend FOR SELECT TO authenticated
  USING (advertiser_id = auth.uid());

-- Mark campaigns that were funded from credit so the seller can identify
-- them in the campaigns list ("paid with: ad credit" vs "paid with: PayPal")
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS credit_funded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_funded_amount numeric(12,2) DEFAULT 0;

COMMIT;
