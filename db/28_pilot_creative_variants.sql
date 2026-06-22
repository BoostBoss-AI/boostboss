-- =====================================================================
-- 28_pilot_creative_variants.sql — creative variants for Pilot bandit
-- =====================================================================
--
-- The Pilot model gives Benna multiple creative variants to test instead
-- of forcing the advertiser to pick one. Multi-arm bandit (rolled out in
-- a later migration) reads from these arrays. For now we just store them.
--
-- We deliberately reuse the existing product fields for images + video:
--   hero_images       text[]  — image variants (already exists)
--   hero_video_url    text    — single video URL (already exists)
--
-- And add 3 new arrays for the text-side variants:
--   creative_headlines     — alternative headlines
--   creative_body_copy     — alternative body text
--   creative_cta_labels    — alternative CTA button labels
--
-- The product's existing name + description still serve as the canonical
-- fallback if a variant array is empty.
--
-- Idempotent — uses IF NOT EXISTS guards. Safe to re-run.
-- =====================================================================

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


-- ── compute_creative_library_ready ──────────────────────────────────
-- Returns true if the product has enough variant headroom for Benna's
-- bandit to actually learn. Backend calls this from normalizeProduct
-- to keep creative_library_ready in sync without trusting the client.
--
-- Minimums (v0 — tune later based on real bandit performance):
--   3+ headline variants  (gives bandit 3 arms minimum)
--   1+ image (in hero_images OR image_url)
--   1+ CTA label (or fall back to default "Learn more")
--
-- A CTA label fallback is provided in code, so we only require it
-- exists if the advertiser cared to vary it. Headlines + image are
-- the load-bearing variant counts.
-- NOTE: products.hero_images is JSONB (an array of URL strings), NOT
-- text[]. The original draft of this function assumed text[] and broke
-- the backfill — the FIX migration 28_pilot_creative_variants_FIX.sql
-- corrects deployed databases. This file is now correct for fresh
-- deploys too.
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


-- ── Trigger — keep creative_library_ready in sync ───────────────────
-- Whenever any creative field changes on the product, recompute the
-- readiness flag. Backend can still write the flag directly (validated
-- in normalizeProduct) but the trigger guarantees DB consistency.

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

drop trigger if exists trg_products_creative_ready on public.products;
create trigger trg_products_creative_ready
  before insert or update of creative_headlines, hero_images, image_url
  on public.products
  for each row
  execute function public.products_recompute_creative_ready();


-- ── Backfill — recompute for all existing rows ──────────────────────
-- Pre-Pilot products have empty creative_headlines arrays and will
-- correctly receive creative_library_ready=false after this update.
update public.products
   set creative_library_ready = public.compute_creative_library_ready(
     creative_headlines, hero_images, image_url
   )
 where true;


-- Verify with:
--   select id, name,
--          array_length(creative_headlines, 1) as n_head,
--          array_length(hero_images, 1)        as n_img,
--          creative_library_ready
--   from public.products
--   limit 10;
