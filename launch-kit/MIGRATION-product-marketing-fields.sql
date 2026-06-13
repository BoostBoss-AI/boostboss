-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — Product marketing content fields
-- ──────────────────────────────────────────────────────────────────────
--
-- Adds the content fields that let a BB product page rival AppSumo /
-- Castmagic in surface area. All are optional — products that don't fill
-- them out keep working exactly as before. Set per-product in the
-- advertiser dashboard's enriched "Storefront" tab.
--
-- See [[mor-product-page-model]] + the Castmagic gap analysis from the
-- 2026-06-13 conversation.
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.products
  -- ── TL;DR section (top-of-page green-check bullets, AppSumo style) ──
  ADD COLUMN IF NOT EXISTS tldr_bullets jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- ── At-a-glance card ───────────────────────────────────────────────
  --    Three string arrays. Rendered as a 3-column inline info box.
  ADD COLUMN IF NOT EXISTS alternative_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS integrations   jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS best_for       jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- ── Trust badges (right rail purchase card) ────────────────────────
  --    refund_window_days drives the "Refundable up to N days" badge.
  --    guarantee_label is the short label after the trust icon
  --    (e.g. "We Got Your Back guarantee"). Both optional.
  ADD COLUMN IF NOT EXISTS refund_window_days integer,
  ADD COLUMN IF NOT EXISTS guarantee_label    text,

  -- ── Deal terms accordion (bottom-of-page expandable bullet list) ──
  ADD COLUMN IF NOT EXISTS deal_terms jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- ── Company / founder card ─────────────────────────────────────────
  --    The trust block AppSumo puts at the bottom of every product
  --    page: brand logo, founded date, city + country, size, growth
  --    stage, funding status, tagline, about, and the founder photo +
  --    LinkedIn. All optional.
  ADD COLUMN IF NOT EXISTS company_logo_url       text,
  ADD COLUMN IF NOT EXISTS company_founded_date   date,
  ADD COLUMN IF NOT EXISTS company_city           text,
  ADD COLUMN IF NOT EXISTS company_country_code   text,   -- ISO 3166-1 alpha-2 (e.g. 'US', 'TW')
  ADD COLUMN IF NOT EXISTS company_size           text,   -- '1-10', '11-50', '51-200', '201+'
  ADD COLUMN IF NOT EXISTS company_growth_stage   text,   -- 'Idea', 'Pre-revenue', 'Growth', 'Profitable'
  ADD COLUMN IF NOT EXISTS company_funding_status text,   -- 'Bootstrapped', 'Pre-seed', 'Seed', 'Series A+'
  ADD COLUMN IF NOT EXISTS company_tagline        text,
  ADD COLUMN IF NOT EXISTS company_about          text,
  ADD COLUMN IF NOT EXISTS company_website_url    text,

  ADD COLUMN IF NOT EXISTS founder_name           text,
  ADD COLUMN IF NOT EXISTS founder_photo_url      text,
  ADD COLUMN IF NOT EXISTS founder_linkedin_url   text,
  ADD COLUMN IF NOT EXISTS founder_role           text;   -- 'Founder', 'CEO', 'Co-founder', etc.

COMMENT ON COLUMN public.products.tldr_bullets IS
  'Top-of-page green-check value-prop bullets, AppSumo TL;DR style. Array of strings, max 5.';
COMMENT ON COLUMN public.products.alternative_to IS
  'At-a-glance: competitor products this replaces (e.g. ["Descript","Otter.ai"]).';
COMMENT ON COLUMN public.products.integrations IS
  'At-a-glance: services this product integrates with.';
COMMENT ON COLUMN public.products.best_for IS
  'At-a-glance: target persona/use-case (e.g. ["Content creators","Podcasters"]).';
COMMENT ON COLUMN public.products.refund_window_days IS
  'Number of days the buyer can request a refund. Drives the "Refundable up to N days" trust badge.';
COMMENT ON COLUMN public.products.deal_terms IS
  'Deal-terms bullet list shown in an accordion at the bottom of the product page.';

COMMIT;

-- ──────────────────────────────────────────────────────────────────────
-- Smoke check after migration:
--
--   SELECT id, name, tldr_bullets, alternative_to, integrations, best_for,
--          refund_window_days, guarantee_label, founder_name, company_tagline
--   FROM public.products
--   ORDER BY created_at DESC
--   LIMIT 5;
-- ──────────────────────────────────────────────────────────────────────
