-- =====================================================================
-- 26_product_boost_pilot.sql — foundation for the Advertiser Pilot model
-- =====================================================================
--
-- This migration adds the schema fields required by the Pilot Console
-- UX that will replace the legacy "campaign builder" advertiser flow.
--
-- Background (full design notes in memory: advertiser-pilot-model):
--   Old model: advertisers create Campaigns and micromanage targeting
--   New model: advertisers boost a Product with objective sliders +
--              budget; Benna allocates autonomously across all 37
--              placements; reporting is the trust layer.
--
-- This migration is ADDITIVE ONLY. No existing column is dropped,
-- no existing UI breaks. Campaigns table stays for now (becomes an
-- internal Benna abstraction). All new fields have safe defaults so
-- existing products keep working.
--
-- Idempotent — uses IF NOT EXISTS guards. Safe to re-run.
-- =====================================================================

-- ── 1. Objective + Pilot Console slider fields ──────────────────────
-- Each advertiser tells Benna WHAT they want via sliders. Benna's
-- scoring function reads these to weight placement allocations.

do $$ begin
  -- Top-level objective. Drives major weight shifts in Benna's scorer.
  --   awareness  → favor cheap impressions, broad surfaces
  --   clicks     → favor high-CTR placements (citations, chips)
  --   signups    → favor placements with proven signup conversion
  --   conversion → favor placements with proven purchase conversion
  --   install    → favor mobile + rewarded video (for AI app UA)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_objective'
  ) then
    alter table public.products
      add column boost_objective text default 'awareness'
        check (boost_objective in (
          'awareness',
          'clicks',
          'signups',
          'conversion',
          'install'
        ));
  end if;

  -- Spectrum 1: Pacing. 0.0 = slow burn, 1.0 = aggressive front-load.
  -- Fed into Benna's pacing controller.
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_pacing'
  ) then
    alter table public.products
      add column boost_pacing numeric(3,2) default 0.50
        check (boost_pacing >= 0 and boost_pacing <= 1);
  end if;

  -- Spectrum 2: Reach. 0.0 = niche (high-intent only), 1.0 = broad.
  -- Lowers Benna's confidence floor as it approaches 1.0.
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_reach'
  ) then
    alter table public.products
      add column boost_reach numeric(3,2) default 0.50
        check (boost_reach >= 0 and boost_reach <= 1);
  end if;

  -- Spectrum 3: Brand Safety. 0.0 = aggressive (all placements ok),
  -- 1.0 = max conservative (skip interruptive formats).
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_brand_safety'
  ) then
    alter table public.products
      add column boost_brand_safety numeric(3,2) default 0.50
        check (boost_brand_safety >= 0 and boost_brand_safety <= 1);
  end if;

  -- Spectrum 4: Creative refresh rate. 0.0 = steady (let winners run),
  -- 1.0 = aggressive (constant rotation, max bandit exploration).
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_creative_refresh'
  ) then
    alter table public.products
      add column boost_creative_refresh numeric(3,2) default 0.50
        check (boost_creative_refresh >= 0 and boost_creative_refresh <= 1);
  end if;

  -- Spectrum 5: Confidence threshold. 0.0 = bid on anything Benna
  -- scores >0, 1.0 = only bid on Benna's top-decile matches.
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_confidence_floor'
  ) then
    alter table public.products
      add column boost_confidence_floor numeric(3,2) default 0.30
        check (boost_confidence_floor >= 0 and boost_confidence_floor <= 1);
  end if;
end $$;


-- ── 2. Boost lifecycle ──────────────────────────────────────────────
-- The product's "boost" is the activation/budget/lifecycle layer.
-- Replaces what campaigns used to track per-row.

do $$ begin
  -- Status of the product's ad-boost activation.
  --   inactive  → product exists but advertiser hasn't activated boost
  --   active    → Benna currently allocating budget
  --   paused    → advertiser manually paused; resumable
  --   depleted  → budget exhausted; auto-pauses
  --   archived  → permanently off
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_status'
  ) then
    alter table public.products
      add column boost_status text default 'inactive'
        check (boost_status in (
          'inactive', 'active', 'paused', 'depleted', 'archived'
        ));
  end if;

  -- Daily budget cap in cents. 0 = no daily cap (only lifetime cap).
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_daily_budget_cents'
  ) then
    alter table public.products
      add column boost_daily_budget_cents int default 0;
  end if;

  -- Lifetime budget cap in cents. 0 = unlimited (advertiser tops up).
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_lifetime_budget_cents'
  ) then
    alter table public.products
      add column boost_lifetime_budget_cents int default 0;
  end if;

  -- Total spent on this product's boost, in cents. Updated by the
  -- auction/impression pipeline. Floor for "depleted" status check.
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_spent_cents'
  ) then
    alter table public.products
      add column boost_spent_cents int default 0;
  end if;

  -- Timestamp boost was first activated. Drives initial bandit-arm
  -- cold-start logic and reporting time-windows.
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'boost_activated_at'
  ) then
    alter table public.products
      add column boost_activated_at timestamptz;
  end if;
end $$;


-- ── 3. Creative library reference ───────────────────────────────────
-- The Pilot model REQUIRES advertisers to upload multiple creative
-- variants Benna can rotate over. Existing hero_images + feature_blocks
-- partially cover this, but we need structured variants.
--
-- For now, just add a flag indicating whether the product has enough
-- creative variants to activate boost. The full creative_library table
-- comes in migration 27.

do $$ begin
  -- Minimum variant counts Benna needs for healthy bandit allocation.
  -- Frontend onboarding enforces this; this field is the persisted truth.
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'creative_library_ready'
  ) then
    alter table public.products
      add column creative_library_ready boolean default false;
  end if;
end $$;


-- ── 4. Indexes ──────────────────────────────────────────────────────
-- Active-boost lookups are the hot path during auction.

create index if not exists products_active_boost_idx
  on public.products(boost_status, boost_activated_at)
  where boost_status = 'active';

create index if not exists products_objective_idx
  on public.products(boost_objective)
  where boost_status = 'active';


-- ── 5. Sanity check ─────────────────────────────────────────────────
-- After running this migration, the products table will have 11 new
-- columns related to the Pilot model. All existing products will have
-- boost_status = 'inactive', meaning none of them auto-enter the new
-- auction pool until an advertiser explicitly activates boost.
--
-- The old campaigns table is UNTOUCHED. Existing campaigns continue
-- to work; the new model lives in parallel until the Pilot Console UI
-- (next session) lets advertisers opt into it.

-- Verify with:
--   select column_name, data_type, column_default
--   from information_schema.columns
--   where table_name = 'products' and column_name like 'boost_%'
--   order by ordinal_position;
