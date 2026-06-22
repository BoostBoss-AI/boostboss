-- =====================================================================
-- 28_pilot_creative_variants_FIX.sql — corrects the function signature
-- =====================================================================
--
-- The first run of 28_pilot_creative_variants.sql declared
-- compute_creative_library_ready(text[], text[], text) but products.hero_images
-- is actually JSONB. Postgres rejected the function at the backfill UPDATE.
--
-- This fix:
--   1. Drops the old function + trigger function (so the new signature can
--      take effect)
--   2. Recreates both with hero_images as JSONB
--   3. Recreates the trigger (was dropped along with its function)
--   4. Re-runs the backfill
--
-- The text[] columns added by the first run (creative_headlines,
-- creative_body_copy, creative_cta_labels) are unaffected.
--
-- Safe to run on a fresh DB too — the IF EXISTS guards are no-ops.
-- =====================================================================

-- ── 0. Add the columns if the failed original transaction rolled them back
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'creative_headlines'
  ) then
    alter table public.products
      add column creative_headlines text[] default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'creative_body_copy'
  ) then
    alter table public.products
      add column creative_body_copy text[] default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'creative_cta_labels'
  ) then
    alter table public.products
      add column creative_cta_labels text[] default '{}';
  end if;
end $$;

-- Drop in dependency order: trigger → trigger function → ready function
drop trigger  if exists trg_products_creative_ready on public.products;
drop function if exists public.products_recompute_creative_ready();
drop function if exists public.compute_creative_library_ready(text[], text[], text);
drop function if exists public.compute_creative_library_ready(text[], jsonb,  text);


-- ── compute_creative_library_ready (JSONB-aware) ────────────────────
-- Same semantics as before: 3+ headlines and 1+ image (hero_images OR
-- the legacy single image_url). hero_images is JSONB containing an array
-- of URL strings — we count its top-level length.
create or replace function public.compute_creative_library_ready(
  p_headlines      text[],
  p_hero_images    jsonb,
  p_image_url      text
) returns boolean
language plpgsql
immutable
as $$
declare
  v_headline_count int;
  v_image_count    int;
begin
  v_headline_count := coalesce(array_length(p_headlines, 1), 0);

  -- JSONB array length. Null jsonb → 0. Non-array jsonb → 0 (defensive).
  v_image_count :=
    case
      when p_hero_images is null            then 0
      when jsonb_typeof(p_hero_images) = 'array'
        then jsonb_array_length(p_hero_images)
      else 0
    end
    + case when p_image_url is not null and p_image_url <> '' then 1 else 0 end;

  return v_headline_count >= 3 and v_image_count >= 1;
end;
$$;


-- ── Trigger function — keep readiness in sync ───────────────────────
create or replace function public.products_recompute_creative_ready()
returns trigger
language plpgsql
as $$
begin
  new.creative_library_ready := public.compute_creative_library_ready(
    new.creative_headlines,
    new.hero_images,
    new.image_url
  );
  return new;
end;
$$;

create trigger trg_products_creative_ready
  before insert or update of creative_headlines, hero_images, image_url
  on public.products
  for each row
  execute function public.products_recompute_creative_ready();


-- ── Backfill — recompute for all existing rows ──────────────────────
-- Pre-Pilot products will correctly receive creative_library_ready=false
-- since they have empty creative_headlines arrays.
update public.products
   set creative_library_ready = public.compute_creative_library_ready(
     creative_headlines, hero_images, image_url
   );


-- Verify with:
--   select id, name,
--          coalesce(array_length(creative_headlines, 1), 0) as n_head,
--          case when jsonb_typeof(hero_images) = 'array'
--               then jsonb_array_length(hero_images)
--               else 0 end                                 as n_img,
--          creative_library_ready
--   from public.products
--   limit 10;
