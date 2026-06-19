-- ============================================================
-- Migration: add 'draft' to product audit_status (Task #156)
-- ============================================================
--
-- Adds 'draft' as a valid audit_status for products so newly-saved
-- products don't immediately enter the admin audit queue. The
-- seller's workflow is now:
--
--   1. Click Save in the product modal  -> audit_status='draft'
--   2. Click "Submit for audit" button   -> audit_status='pending'
--   3. Admin approves / rejects          -> audit_status='approved' | 'rejected'
--
-- This matches the seller mental model: "I'm still tinkering — don't
-- send this to BB for review yet." Stops the audit queue from filling
-- up with half-finished products.
--
-- Apply in Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_audit_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_audit_status_check
  CHECK (audit_status IN ('draft', 'pending', 'approved', 'rejected', 'changes_requested'));

-- Optionally, flip existing pending products that have never been
-- submitted (no audit_reviewed_at) back to draft so the seller has a
-- chance to review before they go live. Comment this block out if
-- you'd rather leave the audit queue as-is.
--
-- UPDATE public.products
-- SET audit_status = 'draft'
-- WHERE audit_status = 'pending'
--   AND audit_reviewed_at IS NULL;
