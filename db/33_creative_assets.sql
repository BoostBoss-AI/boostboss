-- =====================================================================
-- 33_creative_assets.sql — global creative asset library per advertiser
-- =====================================================================
--
-- One reusable, Google-Ads-style asset library per advertiser. The
-- library feeds all 37 placements across the 4 doors (browser, extension,
-- computer/MCP, mobile). Benna assembles each impression by combining
-- assets from the library at render time — the advertiser fills the
-- library ONCE instead of authoring 37 separate ads.
--
-- 4 placement formats consume the library:
--   text_card (8 placements)  → brand.name + short headline + short body + CTA
--   native    (19 placements) → logo + medium headline + medium body + CTA + 16:9 image
--   image     (8 placements)  → aspect-best banner image
--   video     (2 placements)  → landscape OR portrait video + endcard
--
-- Pivots later: campaigns will inherit from this row; campaign-level
-- overrides stay in campaigns.creative_* arrays added in migration 31.
-- See [[advertiser-pilot-model]].
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- ── 1. Table ─────────────────────────────────────────────────────────
create table if not exists public.creative_assets (
  id                    uuid primary key default gen_random_uuid(),
  advertiser_id         uuid not null unique
                        references public.advertisers(id) on delete cascade,

  -- ── Brand kit (1× per advertiser) ────────────────────────────────
  brand_name            text,
  brand_logo_url        text,          -- 1:1 square, ≥512×512
  brand_favicon_url     text,          -- 32×32
  brand_color           text,          -- hex e.g. '#FF2D78'
  brand_domain          text,          -- for 'sponsored by yourdomain.com' line

  -- ── Headlines (1–10 variants per length) ─────────────────────────
  headlines_short       text[] default '{}'::text[],   -- ≤30 char  (chips, citations, banners)
  headlines_medium      text[] default '{}'::text[],   -- ≤55 char  (cards, native, hero, loading)
  headlines_long        text[] default '{}'::text[],   -- ≤90 char  (interstitials, side panels, onboarding)

  -- ── Body copy (1–10 variants per length) ─────────────────────────
  body_short            text[] default '{}'::text[],   -- ≤80 char  (chip subtitles)
  body_medium           text[] default '{}'::text[],   -- ≤140 char (card descriptions, citations)
  body_long             text[] default '{}'::text[],   -- ≤280 char (interstitial copy, sidebar detail)

  -- ── CTA labels (1–5 variants) ────────────────────────────────────
  cta_labels            text[] default '{}'::text[],   -- ≤20 char each — 'Try free', 'Get started'

  -- ── Images by aspect ratio ───────────────────────────────────────
  -- 1:1 reuses brand_logo_url (no separate slot). Other ratios are
  -- variant arrays so the advertiser can A/B different imagery; Benna
  -- picks per impression. Each entry is a public Supabase Storage URL.
  images_16_9           text[] default '{}'::text[],   -- 1280×720+ — card images, splash, hero, new-tab
  images_9_16           text[] default '{}'::text[],   -- 720×1280+ — mobile interstitial, portrait inline
  images_3_1            text[] default '{}'::text[],   -- 900×300+  — bottom banner, window banner, status_line
  images_2_1            text[] default '{}'::text[],   -- 1200×600+ — loading-screen panel

  -- ── Videos (only consumed by mobile rewarded + pre-roll) ─────────
  video_landscape_url   text,          -- 16:9 MP4, 15–30s, ≤20MB
  video_portrait_url    text,          -- 9:16 MP4, 15–30s, ≤20MB
  video_poster_url      text,          -- single poster shown before play

  -- ── Voucher / promo (optional — endcard on rewarded + interstitial) ──
  voucher_value_text    text,          -- 'Get $10 off your first order'
  voucher_code          text,          -- 'BBSAVE10' (optional)
  voucher_redemption_url text,         -- where the click on the voucher leads

  -- ── Derived: library_ready boolean (true when min viable assets present) ──
  -- Used by the dashboard to show a 'ready to serve' chip vs a 'finish
  -- setup' nudge. Computed by trigger below — never set directly.
  library_ready         boolean default false,

  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists creative_assets_advertiser_id_idx
  on public.creative_assets(advertiser_id);


-- ── 2. RLS — advertiser reads/writes only their own row ──────────────
alter table public.creative_assets enable row level security;

drop policy if exists "creative_assets advertiser self-select" on public.creative_assets;
create policy "creative_assets advertiser self-select"
  on public.creative_assets
  for select
  using (advertiser_id = auth.uid());

drop policy if exists "creative_assets advertiser self-insert" on public.creative_assets;
create policy "creative_assets advertiser self-insert"
  on public.creative_assets
  for insert
  with check (advertiser_id = auth.uid());

drop policy if exists "creative_assets advertiser self-update" on public.creative_assets;
create policy "creative_assets advertiser self-update"
  on public.creative_assets
  for update
  using (advertiser_id = auth.uid());

-- Service role bypasses RLS naturally — the /api/creative-assets endpoint
-- runs under service_role and does its own auth check via Bearer JWT.


-- ── 3. library_ready trigger ─────────────────────────────────────────
-- Minimum viable library = brand name + brand logo + ≥1 headline (any
-- length) + ≥1 CTA. That covers the text_card + native formats which
-- are 27 of 37 placements. Image/video are optional augmentations.
create or replace function public.compute_creative_assets_ready()
returns trigger
language plpgsql
as $$
begin
  new.library_ready := (
    coalesce(trim(new.brand_name), '') <> ''
    and coalesce(new.brand_logo_url, '') <> ''
    and (
      coalesce(array_length(new.headlines_short, 1), 0) > 0
      or coalesce(array_length(new.headlines_medium, 1), 0) > 0
      or coalesce(array_length(new.headlines_long, 1), 0) > 0
    )
    and coalesce(array_length(new.cta_labels, 1), 0) > 0
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists creative_assets_ready_trigger on public.creative_assets;
create trigger creative_assets_ready_trigger
  before insert or update on public.creative_assets
  for each row
  execute function public.compute_creative_assets_ready();


-- ── 4. Supabase Storage bucket ───────────────────────────────────────
-- Public-read bucket for image + video uploads. Writes restricted to
-- the authed advertiser's own /{advertiser_id}/ folder via the policy
-- below. Public reads so ad creatives can be referenced from publisher
-- SDKs without signed URLs.
insert into storage.buckets (id, name, public)
values ('creative-assets', 'creative-assets', true)
on conflict (id) do nothing;

-- Read policy — anyone can fetch (public CDN behavior)
drop policy if exists "creative-assets public read" on storage.objects;
create policy "creative-assets public read"
  on storage.objects
  for select
  using (bucket_id = 'creative-assets');

-- Write policy — authed users can write to their own folder only.
-- Path convention: creative-assets/{advertiser_id}/{filename}
drop policy if exists "creative-assets advertiser self-write" on storage.objects;
create policy "creative-assets advertiser self-write"
  on storage.objects
  for insert
  with check (
    bucket_id = 'creative-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "creative-assets advertiser self-update" on storage.objects;
create policy "creative-assets advertiser self-update"
  on storage.objects
  for update
  using (
    bucket_id = 'creative-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "creative-assets advertiser self-delete" on storage.objects;
create policy "creative-assets advertiser self-delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'creative-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- Verify with:
--   select advertiser_id, brand_name, library_ready,
--          array_length(headlines_short, 1) as n_short,
--          array_length(headlines_medium, 1) as n_med,
--          array_length(cta_labels, 1) as n_ctas
--   from public.creative_assets
--   limit 10;
--
--   select * from storage.buckets where id = 'creative-assets';
