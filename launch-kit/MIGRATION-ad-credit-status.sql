-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — allow 'credited' status on advertiser_payouts
-- ──────────────────────────────────────────────────────────────────────
-- Phase 2 of the Promote flow. When a seller converts unsettled MoR
-- earnings into in-platform ad credit (instead of withdrawing to PayPal),
-- we insert an advertiser_payouts row with status='credited'.
--
-- The CHECK constraint from MIGRATION-advertiser-payout-methods.sql
-- only allowed 'pending' | 'dispatched' | 'completed' | 'failed' |
-- 'on_hold'. This migration adds 'credited' to that list.
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.advertiser_payouts
  DROP CONSTRAINT IF EXISTS advertiser_payouts_status_check;
ALTER TABLE public.advertiser_payouts
  ADD CONSTRAINT advertiser_payouts_status_check
  CHECK (status IN ('pending', 'dispatched', 'completed', 'failed', 'on_hold', 'credited'));

COMMENT ON COLUMN public.advertiser_payouts.status IS
  'Lifecycle: pending → dispatched → completed (PayPal route), '
  'or pending → failed/on_hold, or "credited" for the ad-credit route '
  'where money stays inside BB and funds future campaigns.';

COMMIT;

-- Smoke check:
--   SELECT 'credited'::text IN (
--     SELECT unnest(string_to_array(
--       regexp_replace(pg_get_constraintdef(c.oid), '.*ARRAY\[(.*)\].*', '\1'),
--       ', '
--     )) FROM pg_constraint c WHERE c.conname = 'advertiser_payouts_status_check'
--   );
