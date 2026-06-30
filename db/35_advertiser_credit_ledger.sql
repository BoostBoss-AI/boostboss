-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — Advertiser credit ledger (Phase 2: credits model)
-- See ai-team/specs/cold-start.md + build-roadmap.md.
-- Transparent, itemized record of every credit event (grant / topup / spend /
-- refund). Powers the dashboard activity feed and Finance's solvency audit.
-- ADDITIVE — changes no existing money flow. Idempotent. Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.advertiser_credit_ledger (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id      uuid REFERENCES public.advertisers(id) ON DELETE CASCADE,
  kind               text NOT NULL CHECK (kind IN ('grant','topup','spend','refund')),
  amount_usd         numeric(12,2) NOT NULL,
  balance_after_usd  numeric(12,2),
  ref                text,
  note               text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_adv
  ON public.advertiser_credit_ledger(advertiser_id, created_at DESC);
