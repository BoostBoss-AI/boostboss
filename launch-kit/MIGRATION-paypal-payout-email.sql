-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — PayPal payout email migration
-- ════════════════════════════════════════════════════════════════════════
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run.
-- Safe to re-run (uses IF NOT EXISTS).
--
-- WHAT THIS DOES
-- --------------
-- Adds a `paypal_email` text column to publisher_payout_methods so the
-- Settings → Payouts form can save a single PayPal recipient email instead
-- of the 8 bank-detail fields it used to collect.
--
-- WHY
-- ---
-- Taiwan business-entity legal constraint forces single-provider pay-in +
-- payout. PayPal is already integrated for pay-in (live in production),
-- so PayPal Payouts API handles payouts too — until the planned Singapore
-- corp move. See [[taiwan_entity_single_provider]] memory.
--
-- LEGACY BANK COLUMNS
-- -------------------
-- We do NOT drop the old bank fields (account_holder_name, swift_bic,
-- iban_or_account, …). Reasons:
--   1. Some publishers already submitted bank details — keep the data
--      around even though we won't use it (could be needed if Andy ever
--      needs to refund or reconcile via the old rail).
--   2. The admin_export CSV legacy path in api/payouts.js still reads
--      these fields. It's a manual escape hatch retained for cases where
--      PayPal Payouts hard-fails.
--   3. Cheap to keep around. Cost of dropping & restoring later >> cost
--      of the columns sitting unused.
--
-- IDEMPOTENCY
-- -----------
-- Wrapped in IF NOT EXISTS where supported. Running this twice is a no-op.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. publisher_payout_methods.paypal_email
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.publisher_payout_methods
  ADD COLUMN IF NOT EXISTS paypal_email TEXT;

-- Loose format check at the DB layer too — defense in depth, the app
-- already validates before write. NULL is allowed (legacy rows from before
-- the pivot didn't have an email).
ALTER TABLE public.publisher_payout_methods
  DROP CONSTRAINT IF EXISTS publisher_payout_methods_paypal_email_format;

ALTER TABLE public.publisher_payout_methods
  ADD CONSTRAINT publisher_payout_methods_paypal_email_format
  CHECK (paypal_email IS NULL OR paypal_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- ────────────────────────────────────────────────────────────────────────
-- 2. payout_requests.paypal_batch_id  (for webhook reconciliation later)
-- ────────────────────────────────────────────────────────────────────────
--
-- The admin_send_batch action in api/payouts.js writes the PayPal-returned
-- payout_batch_id here so the webhook handler in api/billing.js (task #129)
-- can find rows by either:
--   - batch_id (our id, BB-YYYYMMDD-XXXXXX, == PayPal sender_batch_id)
--   - paypal_batch_id (PayPal's internal id, == event.resource.batch_header.payout_batch_id)
--   - sender_item_id (== payout_requests.id, used for per-item events)

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS paypal_batch_id TEXT;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS paypal_item_id TEXT;

CREATE INDEX IF NOT EXISTS payout_requests_paypal_batch_id_idx
  ON public.payout_requests (paypal_batch_id) WHERE paypal_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payout_requests_paypal_item_id_idx
  ON public.payout_requests (paypal_item_id) WHERE paypal_item_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────
-- DONE.
-- ────────────────────────────────────────────────────────────────────────
--
-- Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'publisher_payout_methods' AND column_name = 'paypal_email';
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'payout_requests'
--     AND column_name IN ('paypal_batch_id', 'paypal_item_id');
