-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — Move audit decision to PRODUCT level
-- ──────────────────────────────────────────────────────────────────────
--
-- CONTEXT
--   The earlier MIGRATION-pricing-plans.sql put audit_status on each
--   pricing_plan row. That turned out to be wrong UX: sellers think of
--   their product page as one thing, with tiers as content INSIDE it.
--   Andy (admin) reviews the whole product page in one pass.
--
-- THE NEW MODEL
--   - products.audit_status drives "is this product purchasable?"
--   - Pricing plans are children of the product. They have prices,
--     proof URLs, marketing content — but no separate audit decision.
--   - Approve a product → ALL its active plans become purchasable.
--   - Reject a product → none of its plans sell.
--
-- WHAT THIS MIGRATION DOES
--   1. Adds audit_status + audit_reviewer_id + audit_reviewed_at +
--      audit_review_notes columns to products.
--   2. Backfills:
--        a. Products with status='active' AND at least one approved plan
--           → audit_status = 'approved' (grandfather the live ones)
--        b. Everything else → audit_status = 'pending'
--   3. Leaves the per-plan audit columns in place (deprecated, not
--      dropped) so existing transaction-history queries don't break.
--      Future migration can drop them once we're confident nothing
--      references them.
--
-- See [[pricing-plans-audit-policy]] memory (updated 2026-06-13 after
-- this clarification) and [[mor-product-page-model]].
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Add audit fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS audit_status       text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS audit_reviewer_id  uuid,
  ADD COLUMN IF NOT EXISTS audit_reviewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS audit_review_notes text;

-- Enforce the allowed status values
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_audit_status_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_audit_status_check
  CHECK (audit_status IN ('pending', 'approved', 'rejected', 'changes_requested'));

-- 2. Backfill
--    Grandfather existing live products that already have at least one
--    approved plan — they're known-good and shouldn't suddenly stop
--    selling because of the model change.
UPDATE public.products p
   SET audit_status = 'approved'
 WHERE p.status = 'active'
   AND EXISTS (
     SELECT 1 FROM public.pricing_plans pp
     WHERE pp.product_id = p.id AND pp.audit_status = 'approved'
   )
   AND audit_status = 'pending';  -- only flip from the default; preserve anything we set explicitly

-- 3. Index the audit queue for fast admin pagination
CREATE INDEX IF NOT EXISTS products_audit_queue_idx
  ON public.products (audit_status, created_at)
  WHERE audit_status IN ('pending', 'changes_requested');

COMMENT ON COLUMN public.products.audit_status IS
  'Product-level audit gate. Only approved products are purchasable on BB. '
  'When approved, ALL active pricing_plans for the product are live. '
  'Per-plan audit columns are now legacy — product-level is the source of truth.';

COMMIT;

-- ──────────────────────────────────────────────────────────────────────
-- Smoke check:
--
--   SELECT id, name, status, audit_status,
--          (SELECT count(*) FROM pricing_plans pp WHERE pp.product_id = p.id) AS plans
--   FROM public.products p
--   ORDER BY created_at DESC
--   LIMIT 10;
--
-- Stripe Atlas Lifetime should now show audit_status='approved'.
-- ──────────────────────────────────────────────────────────────────────
