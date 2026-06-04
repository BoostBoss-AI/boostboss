-- ════════════════════════════════════════════════════════════════════
-- Phase 2 — PayPal pay-in columns on transactions
-- ════════════════════════════════════════════════════════════════════
--
-- The Stripe deposit path used a single column (`stripe_session_id`)
-- to correlate webhooks with the in-flight order. PayPal has two
-- correlation ids worth persisting: the order id (created at
-- approval) and the capture id (created at capture). The webhook
-- also carries an `event id` we want to dedupe on independently.
--
-- We also add a `provider` column so the history endpoint can show
-- the user which rail each deposit/refund ran on, and a
-- `payer_email` column so PayPal's receipt info isn't lost (Stripe
-- captured this in metadata; PayPal returns it on the capture).
--
-- All columns are nullable and have no defaults so back-fill isn't
-- needed for existing Stripe rows. Unique indexes are partial so
-- they don't reject NULLs the way a plain UNIQUE constraint would.

BEGIN;

-- Defensive: only run if the transactions table exists in this project.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    RAISE NOTICE 'transactions table not found — skipping PayPal column adds';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'provider'
  ) THEN
    ALTER TABLE public.transactions
      ADD COLUMN provider          text,
      ADD COLUMN paypal_order_id   text,
      ADD COLUMN paypal_capture_id text,
      ADD COLUMN paypal_event_id   text,
      ADD COLUMN payer_email       text;
  END IF;
END
$$;

-- Partial unique indexes — protect against double-credits without
-- forcing every row to have a value.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_paypal_capture_uniq
  ON public.transactions (paypal_capture_id)
  WHERE paypal_capture_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_paypal_event_uniq
  ON public.transactions (paypal_event_id)
  WHERE paypal_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_paypal_order_idx
  ON public.transactions (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_provider_idx
  ON public.transactions (provider)
  WHERE provider IS NOT NULL;

-- Mark migration applied (project convention from db/00_schema_migrations.sql).
-- The table is keyed on `name` (text PK); columns: name, applied_at, applied_by, notes.
INSERT INTO public.bbx_schema_migrations (name, applied_by, notes)
VALUES ('22_paypal_transactions.sql', 'andy', 'phase 2 paypal pay-in scaffolding')
ON CONFLICT (name) DO NOTHING;

COMMIT;
